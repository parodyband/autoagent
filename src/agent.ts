/**
 * AutoAgent — a self-improving cyclical agent.
 *
 * Loop: read goals -> call Claude -> execute tools -> validate -> commit -> restart
 *
 * Safety: compilation gate, stall detection, circuit breaker w/ resuscitation,
 * turn budget warnings, full action logging.
 *
 * This file is a thin orchestrator. Core logic lives in:
 * - conversation.ts — turn processing, tool dispatch
 * - finalization.ts — metrics, commit, state update
 * - messages.ts — prompt construction
 * - tool-registry.ts — tool definitions and handlers
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { Logger, createLogger } from "./logging.js";
import { spawn as spawnProcess } from "child_process";
import path from "path";
import "dotenv/config";
import { executeBash } from "./tools/bash.js";
import { createDefaultRegistry } from "./tool-registry.js";
import {
  loadState,
  saveState,
  tagPreIteration,
  rollbackToPreIteration,
  type IterationState,
} from "./iteration.js";
import { buildInitialMessage } from "./messages.js";
import { ToolCache } from "./tool-cache.js";
import { ToolTimingTracker } from "./tool-timing.js";
import { finalizeIteration as runFinalization } from "./finalization.js";
import { runConversation, type IterationCtx } from "./conversation.js";

const ROOT = process.cwd();
const GOALS_FILE = path.join(ROOT, "goals.md");
const MEMORY_FILE = path.join(ROOT, "memory.md");
const METRICS_FILE = path.join(ROOT, ".autoagent-metrics.json");
const AGENT_LOG_FILE = path.join(ROOT, "agentlog.md");
const CACHE_FILE = path.join(ROOT, ".autoagent-cache.json");
const MAX_TURNS = 50;
const MAX_CONSECUTIVE_FAILURES = 3;

// ─── Logging ────────────────────────────────────────────────

let logger: Logger;

function log(iter: number, msg: string): void {
  if (logger) {
    logger.info(msg);
  } else {
    const line = `[${new Date().toISOString()}] iter=${iter} ${msg}\n`;
    console.log(`  ${msg}`);
    try { appendFileSync(AGENT_LOG_FILE, line, "utf-8"); } catch {}
  }
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

// ─── Finalization delegate ──────────────────────────────────

const toolRegistry = createDefaultRegistry();

async function doFinalize(ctx: IterationCtx, doRestart: boolean): Promise<void> {
  // Serialize cache for next iteration before finalizing
  try {
    const count = ctx.cache.serialize(CACHE_FILE, ctx.rootDir);
    ctx.log(`Cache persisted: ${count} entries to ${path.basename(CACHE_FILE)}`);
  } catch (err) {
    ctx.log(`Cache persist error (non-fatal): ${err instanceof Error ? err.message : err}`);
  }

  await runFinalization({
    iter: ctx.iter,
    state: ctx.state,
    startTime: ctx.startTime,
    turns: ctx.turns,
    toolCounts: ctx.toolCounts,
    tokens: ctx.tokens,
    cache: ctx.cache,
    timing: ctx.timing,
    rootDir: ROOT,
    metricsFile: METRICS_FILE,
    log: (msg: string) => log(ctx.iter, msg),
    logger,
    restart,
  }, doRestart);
}

// ─── Main iteration ─────────────────────────────────────────

async function runIteration(state: IterationState): Promise<void> {
  logger = createLogger(state.iteration, ROOT);

  const cache = new ToolCache();

  // Warm cache from previous iteration
  try {
    const { restored, stale, total } = cache.deserialize(CACHE_FILE, ROOT);
    if (total > 0) {
      log(state.iteration, `Cache restored: ${restored}/${total} entries (${stale} stale)`);
    }
  } catch (err) {
    log(state.iteration, `Cache restore error (non-fatal): ${err instanceof Error ? err.message : err}`);
  }

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
    cache,
    timing: new ToolTimingTracker(),
    rootDir: ROOT,
    maxTurns: MAX_TURNS,
    logger,
    registry: toolRegistry,
    log: (msg: string) => log(state.iteration, msg),
    onFinalize: doFinalize,
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  AutoAgent — Iteration ${ctx.iter}`);
  console.log(`  Tools: ${toolRegistry.getNames().join(", ")}`);
  console.log(`${"=".repeat(60)}\n`);

  logger.info(`Starting. Model=${ctx.model} MaxTokens=${ctx.maxTokens}`);
  await tagPreIteration(ctx.iter);

  ctx.messages.push({
    role: "user",
    content: buildInitialMessage(readGoals(), readMemory()),
  });

  await runConversation(ctx);
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

  if (state.lastSuccessfulIteration >= 0) {
    const tag = `pre-iteration-${state.lastSuccessfulIteration + 1}`;
    const check = await executeBash(`git tag -l ${tag}`, 120, undefined, true);
    if (check.output.trim()) {
      await executeBash(`git reset --hard ${tag}`, 120, undefined, true);
      log(state.iteration, `Rolled back to ${tag}`);
    }
  }

  const note =
    `\n## CIRCUIT BREAKER RECOVERY — Iteration ${state.iteration} (${new Date().toISOString()})\n\n` +
    `**${failures} consecutive failures.** Rolled back to last good state.\n\n` +
    `- Last error: ${state.lastFailureReason}\n` +
    `- Last failed commit: ${state.lastFailedCommit?.slice(0, 8) || "unknown"}\n\n` +
    `**DO NOT retry the same approach.** It failed ${failures} times. Think differently.\n` +
    `Read agentlog.md to understand what went wrong. Set conservative goals.\n\n---\n`;
  try { appendFileSync(MEMORY_FILE, note, "utf-8"); } catch {}

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

  state.lastSuccessfulIteration = state.iteration - 1;
  state.lastFailedCommit = null;
  state.lastFailureReason = null;
  state.iteration++;
  saveState(state);

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

  if (failures >= MAX_CONSECUTIVE_FAILURES) {
    await resuscitate(state, failures);
    return;
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
  const reason = err instanceof Error ? err.message : String(err);
  console.error("Fatal:", reason);
  try {
    appendFileSync(AGENT_LOG_FILE, `[${new Date().toISOString()}] FATAL: ${reason}\n`, "utf-8");
    appendFileSync(MEMORY_FILE, `\n## FATAL (${new Date().toISOString()})\n\n${reason}\n\n---\n`, "utf-8");
  } catch {}
  await new Promise((r) => setTimeout(r, 15_000));
  restart();
});
