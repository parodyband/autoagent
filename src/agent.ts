/**
 * AutoAgent — a self-improving cyclical agent.
 *
 * Loop: read goals -> call Claude -> execute tools -> validate -> commit -> restart
 *
 * Safety: compilation gate, stall detection, circuit breaker w/ resuscitation,
 * turn budget warnings, full action logging.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { spawn as spawnProcess } from "child_process";
import path from "path";
import "dotenv/config";
import { executeBash } from "./tools/bash.js";
import { createDefaultRegistry } from "./tool-registry.js";
import {
  validateBeforeCommit,
  captureCodeQuality,
  captureBenchmarks,
  type CodeQualitySnapshot,
  type BenchmarkSnapshot,
} from "./validation.js";
import {
  loadState,
  saveState,
  tagPreIteration,
  commitIteration,
  rollbackToPreIteration,
  type IterationState,
} from "./iteration.js";
import {
  buildSystemPrompt,
  buildInitialMessage,
  budgetWarning,
  turnLimitNudge,
  validationBlockedMessage,
} from "./messages.js";

const ROOT = process.cwd();
const GOALS_FILE = path.join(ROOT, "goals.md");
const MEMORY_FILE = path.join(ROOT, "memory.md");
const METRICS_FILE = path.join(ROOT, ".autoagent-metrics.json");
const AGENT_LOG_FILE = path.join(ROOT, "agentlog.md");
const MAX_TURNS = 50;
const MAX_CONSECUTIVE_FAILURES = 3;

// ─── Logging ────────────────────────────────────────────────

function log(iter: number, msg: string): void {
  const line = `[${new Date().toISOString()}] iter=${iter} ${msg}\n`;
  console.log(`  ${msg}`);
  try { appendFileSync(AGENT_LOG_FILE, line, "utf-8"); } catch {}
}

// ─── Metrics ────────────────────────────────────────────────

interface IterationMetrics {
  iteration: number;
  startTime: string;
  endTime: string;
  turns: number;
  toolCalls: Record<string, number>;
  success: boolean;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  codeQuality?: CodeQualitySnapshot;
  benchmarks?: BenchmarkSnapshot;
}

function recordMetrics(m: IterationMetrics): void {
  let existing: IterationMetrics[] = [];
  if (existsSync(METRICS_FILE)) {
    try { existing = JSON.parse(readFileSync(METRICS_FILE, "utf-8")); } catch { existing = []; }
  }
  existing.push(m);
  writeFileSync(METRICS_FILE, JSON.stringify(existing, null, 2));
}

// ─── File readers ───────────────────────────────────────────

function readGoals(): string {
  if (!existsSync(GOALS_FILE)) return "(no goals.md found)";
  return readFileSync(GOALS_FILE, "utf-8");
}

function readMemory(): string {
  if (!existsSync(MEMORY_FILE)) return "(no memory.md found)";
  const content = readFileSync(MEMORY_FILE, "utf-8");
  const max = 8000;
  if (content.length > max) return "...(earlier entries truncated)...\n\n" + content.slice(-max);
  return content;
}

// ─── Tools ──────────────────────────────────────────────────

const toolRegistry = createDefaultRegistry();

async function handleToolCall(
  iter: number,
  toolUse: { type: "tool_use"; id: string; name: string; input: Record<string, unknown> },
  counts: Record<string, number>
): Promise<{ result: string; isRestart: boolean }> {
  counts[toolUse.name] = (counts[toolUse.name] || 0) + 1;

  const tool = toolRegistry.get(toolUse.name);
  if (!tool) {
    return { result: `Unknown tool: ${toolUse.name}`, isRestart: false };
  }

  const ctx = {
    rootDir: ROOT,
    log: (msg: string) => log(iter, msg),
  };

  try {
    const { result, isRestart } = await tool.handler(toolUse.input, ctx);
    return { result, isRestart: isRestart || false };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(iter, `TOOL ERROR (${toolUse.name}): ${errMsg}`);
    return { result: `Error executing ${toolUse.name}: ${errMsg}`, isRestart: false };
  }
}

// ─── Iteration context & turn processing ────────────────────

interface IterationCtx {
  client: Anthropic;
  model: string;
  maxTokens: number;
  state: IterationState;
  iter: number;
  messages: Anthropic.MessageParam[];
  toolCounts: Record<string, number>;
  tokens: { in: number; out: number; cacheCreate: number; cacheRead: number };
  startTime: Date;
  turns: number;
}

type TurnResult = "continue" | "break" | "restarted";

/** Process a single turn: API call → tool dispatch → restart/budget handling. */
async function processTurn(ctx: IterationCtx): Promise<TurnResult> {
  ctx.turns++;
  const turnsLeft = MAX_TURNS - ctx.turns;
  log(ctx.iter, `Turn ${ctx.turns}/${MAX_TURNS}`);

  const response = await ctx.client.messages.create({
    model: ctx.model, max_tokens: ctx.maxTokens,
    system: [{
      type: "text" as const,
      text: buildSystemPrompt(ctx.state, ROOT),
      cache_control: { type: "ephemeral" as const },
    }],
    tools: toolRegistry.getDefinitions(),
    messages: ctx.messages,
  });

  // Track tokens
  if (response.usage) {
    ctx.tokens.in += response.usage.input_tokens;
    ctx.tokens.out += response.usage.output_tokens;
    const usage = response.usage as unknown as Record<string, unknown>;
    if (typeof usage.cache_creation_input_tokens === "number") ctx.tokens.cacheCreate += usage.cache_creation_input_tokens;
    if (typeof usage.cache_read_input_tokens === "number") ctx.tokens.cacheRead += usage.cache_read_input_tokens;
  }

  const content = response.content;
  ctx.messages.push({ role: "assistant", content });

  for (const block of content) {
    if (block.type === "text") {
      log(ctx.iter, `Agent: ${block.text.slice(0, 400)}${block.text.length > 400 ? "..." : ""}`);
    }
  }

  const toolUses = content.filter(
    (b): b is Anthropic.ContentBlockParam & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use"
  );

  if (toolUses.length === 0) {
    log(ctx.iter, "No tool calls — ending");
    return "break";
  }

  // Execute independent tools concurrently
  const toolResults = await Promise.all(
    toolUses.map(async (tu) => {
      const { result, isRestart } = await handleToolCall(ctx.iter, tu, ctx.toolCounts);
      return { id: tu.id, result, isRestart };
    })
  );

  const results: Anthropic.ToolResultBlockParam[] = [];
  let shouldRestart = false;
  for (const tr of toolResults) {
    results.push({ type: "tool_result", tool_use_id: tr.id, content: tr.result });
    if (tr.isRestart) shouldRestart = true;
  }
  ctx.messages.push({ role: "user", content: results });

  if (shouldRestart) {
    const v = await validateBeforeCommit(ROOT, (msg) => log(ctx.iter, msg));
    if (!v.ok) {
      log(ctx.iter, "VALIDATION BLOCKED RESTART — agent must fix");
      ctx.messages.push({ role: "user", content: validationBlockedMessage(v.output) });
      return "continue";
    }

    await finalizeIteration(ctx, true);
    return "restarted";
  }

  if (response.stop_reason === "end_turn") {
    log(ctx.iter, "end_turn");
    return "break";
  }

  // Token budget awareness
  const bw = budgetWarning(ctx.turns, MAX_TURNS, {
    inputTokens: ctx.tokens.in, outputTokens: ctx.tokens.out,
    cacheReadTokens: ctx.tokens.cacheRead, elapsedMs: Date.now() - ctx.startTime.getTime(),
  });
  if (bw) ctx.messages.push({ role: "user", content: bw });

  const nudge = turnLimitNudge(turnsLeft);
  if (nudge) ctx.messages.push({ role: "user", content: nudge });

  return "continue";
}

/** Finalize: capture metrics, commit, optionally restart. */
async function finalizeIteration(ctx: IterationCtx, doRestart: boolean): Promise<void> {
  const codeQuality = await captureCodeQuality(ROOT);
  const benchmarks = await captureBenchmarks(ROOT);
  recordMetrics({
    iteration: ctx.iter, startTime: ctx.startTime.toISOString(), endTime: new Date().toISOString(),
    turns: ctx.turns, toolCalls: ctx.toolCounts, success: true,
    durationMs: Date.now() - ctx.startTime.getTime(),
    inputTokens: ctx.tokens.in, outputTokens: ctx.tokens.out,
    cacheCreationTokens: ctx.tokens.cacheCreate || undefined,
    cacheReadTokens: ctx.tokens.cacheRead || undefined,
    codeQuality, benchmarks,
  });

  const sha = await commitIteration(ctx.iter);
  const label = doRestart ? "Committed" : "Committed (no restart)";
  log(ctx.iter, `${label}: ${sha.slice(0, 8)} (${ctx.tokens.in} in / ${ctx.tokens.out} out, cache: ${ctx.tokens.cacheCreate} created, ${ctx.tokens.cacheRead} read)`);

  ctx.state.lastSuccessfulIteration = ctx.iter;
  ctx.state.lastFailedCommit = null;
  ctx.state.lastFailureReason = null;
  ctx.state.iteration++;
  saveState(ctx.state);

  if (doRestart) {
    log(ctx.iter, `Restarting as iteration ${ctx.state.iteration}...`);
    restart();
  }
}

// ─── Main iteration ─────────────────────────────────────────

async function runIteration(state: IterationState): Promise<void> {
  const ctx: IterationCtx = {
    client: new Anthropic(),
    model: process.env.MODEL || "claude-opus-4-6",
    maxTokens: parseInt(process.env.MAX_TOKENS || "16384", 10),
    startTime: new Date(),
    toolCounts: {},
    iter: state.iteration,
    state,
    tokens: { in: 0, out: 0, cacheCreate: 0, cacheRead: 0 },
    messages: [],
    turns: 0,
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  AutoAgent — Iteration ${ctx.iter}`);
  console.log(`  Tools: ${toolRegistry.getNames().join(", ")}`);
  console.log(`${"=".repeat(60)}\n`);

  log(ctx.iter, `Starting. Model=${ctx.model} MaxTokens=${ctx.maxTokens}`);
  await tagPreIteration(ctx.iter);

  ctx.messages.push({
    role: "user",
    content: buildInitialMessage(readGoals(), readMemory()),
  });

  while (ctx.turns < MAX_TURNS) {
    const result = await processTurn(ctx);
    if (result === "break" || result === "restarted") return;
    // "continue" → next turn
  }

  if (ctx.turns >= MAX_TURNS) log(ctx.iter, "Hit max turns — forcing commit");
  await finalizeIteration(ctx, false);
}

// ─── Restart ────────────────────────────────────────────────

function restart(): never {
  const child = spawnProcess(
    process.execPath,
    [path.join(ROOT, "node_modules/.bin/tsx"), path.join(ROOT, "src/agent.ts")],
    { stdio: "inherit", cwd: ROOT, detached: true, env: process.env }
  );
  child.unref();
  process.exit(0);
}

// ─── Resuscitation ──────────────────────────────────────────

function countConsecutiveFailures(state: IterationState): number {
  if (state.lastSuccessfulIteration < 0) return state.iteration;
  return state.iteration - state.lastSuccessfulIteration - 1;
}

async function resuscitate(state: IterationState, failures: number): Promise<void> {
  log(state.iteration, `CIRCUIT BREAKER: ${failures} failures — resuscitating`);

  // Roll back to last known good
  if (state.lastSuccessfulIteration >= 0) {
    const tag = `pre-iteration-${state.lastSuccessfulIteration + 1}`;
    const check = await executeBash(`git tag -l ${tag}`, 120, undefined, true);
    if (check.output.trim()) {
      await executeBash(`git reset --hard ${tag}`, 120, undefined, true);
      log(state.iteration, `Rolled back to ${tag}`);
    }
  }

  // Tell future-self what happened
  const note =
    `\n## CIRCUIT BREAKER RECOVERY — Iteration ${state.iteration} (${new Date().toISOString()})\n\n` +
    `**${failures} consecutive failures.** Rolled back to last good state.\n\n` +
    `- Last error: ${state.lastFailureReason}\n` +
    `- Last failed commit: ${state.lastFailedCommit?.slice(0, 8) || "unknown"}\n\n` +
    `**DO NOT retry the same approach.** It failed ${failures} times. Think differently.\n` +
    `Read agentlog.md to understand what went wrong. Set conservative goals.\n\n---\n`;
  try { appendFileSync(MEMORY_FILE, note, "utf-8"); } catch {}

  // Set recovery goals
  const goals =
    `# AutoAgent Goals — Iteration ${state.iteration} (RECOVERY)\n\n` +
    `You hit ${failures} consecutive failures. Previous error: ${state.lastFailureReason}\n\n` +
    `## Goals\n\n` +
    `1. **Read agentlog.md and memory.md.** Understand what failed and why.\n` +
    `2. **Think from first principles** (use think tool). Why did it fail? What's different about a correct approach?\n` +
    `3. **Make a minimal safe change** or just stabilize with good notes.\n` +
    `4. **Verify** with \`npx tsc --noEmit\`.\n` +
    `5. **Write memory and restart.** \`echo "AUTOAGENT_RESTART"\`\n`;
  try { writeFileSync(GOALS_FILE, goals, "utf-8"); } catch {}

  // Reset failure tracking — give it another chance
  state.lastSuccessfulIteration = state.iteration - 1;
  state.lastFailedCommit = null;
  state.lastFailureReason = null;
  state.iteration++;
  saveState(state);

  // Cooldown then restart
  log(state.iteration, "Cooldown 10s...");
  await new Promise((r) => setTimeout(r, 10_000));
  restart();
}

// ─── Entry point ────────────────────────────────────────────

async function main(): Promise<void> {
  if (!existsSync(AGENT_LOG_FILE)) {
    writeFileSync(AGENT_LOG_FILE, "# AutoAgent Log\n\n", "utf-8");
  }

  console.log("AutoAgent starting...");

  const gitCheck = await executeBash("git status --porcelain", 120, undefined, true);
  if (gitCheck.exitCode !== 0) {
    await executeBash("git init && git add -A && git commit -m 'autoagent: initial'", 120, undefined, true);
  }

  const state = loadState();
  const failures = countConsecutiveFailures(state);

  if (failures > 0) log(state.iteration, `${failures}/${MAX_CONSECUTIVE_FAILURES} consecutive failures`);

  // Resuscitate instead of dying
  if (failures >= MAX_CONSECUTIVE_FAILURES) {
    await resuscitate(state, failures);
    return; // resuscitate calls restart()
  }

  try {
    await runIteration(state);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log(state.iteration, `ITERATION FAILED: ${reason}`);

    const shaResult = await executeBash("git rev-parse HEAD 2>/dev/null", 120, undefined, true);
    const failedSha = shaResult.output.trim();

    await rollbackToPreIteration(state.iteration);
    log(state.iteration, `Rolled back to pre-iteration-${state.iteration}`);

    state.lastFailedCommit = failedSha;
    state.lastFailureReason = reason;
    state.iteration++;
    saveState(state);

    const entry = `\n## Iteration ${state.iteration - 1} — FAILED (${new Date().toISOString()})\n\n- **Error**: ${reason}\n- **Rolled back**\n\n---\n`;
    try { appendFileSync(MEMORY_FILE, entry, "utf-8"); } catch {}

    log(state.iteration, "Failure recorded. Restarting...");
    restart();
  }
}

main().catch(async (err) => {
  // Never die — always come back
  const reason = err instanceof Error ? err.message : String(err);
  console.error("Fatal:", reason);
  try {
    appendFileSync(AGENT_LOG_FILE, `[${new Date().toISOString()}] FATAL: ${reason}\n`, "utf-8");
    appendFileSync(MEMORY_FILE, `\n## FATAL (${new Date().toISOString()})\n\n${reason}\n\n---\n`, "utf-8");
  } catch {}
  await new Promise((r) => setTimeout(r, 15_000));
  restart();
});
