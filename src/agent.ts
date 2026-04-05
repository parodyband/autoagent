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
import { bashToolDefinition, executeBash } from "./tools/bash.js";
import { readFileToolDefinition, executeReadFile } from "./tools/read_file.js";
import { writeFileToolDefinition, executeWriteFile } from "./tools/write_file.js";
import { grepToolDefinition, executeGrep } from "./tools/grep.js";
import { webFetchToolDefinition, executeWebFetch } from "./tools/web_fetch.js";
import { thinkToolDefinition, executeThink } from "./tools/think.js";
import { listFilesToolDefinition, executeListFiles } from "./tools/list_files.js";
import {
  loadState,
  saveState,
  tagPreIteration,
  commitIteration,
  rollbackToPreIteration,
  type IterationState,
} from "./iteration.js";

const ROOT = process.cwd();
const GOALS_FILE = path.join(ROOT, "goals.md");
const MEMORY_FILE = path.join(ROOT, "memory.md");
const SYSTEM_PROMPT_FILE = path.join(ROOT, "system-prompt.md");
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

// ─── System prompt ──────────────────────────────────────────

function buildSystemPrompt(state: IterationState): string {
  if (existsSync(SYSTEM_PROMPT_FILE)) {
    let t = readFileSync(SYSTEM_PROMPT_FILE, "utf-8");
    t = t.replace(/\{\{ITERATION\}\}/g, String(state.iteration));
    t = t.replace(/\{\{ROOT\}\}/g, ROOT);
    t = t.replace(/\{\{LAST_SUCCESSFUL\}\}/g, String(state.lastSuccessfulIteration));
    t = t.replace(/\{\{LAST_FAILED_COMMIT\}\}/g, state.lastFailedCommit || "none");
    t = t.replace(/\{\{LAST_FAILURE_REASON\}\}/g, state.lastFailureReason || "none");
    return t;
  }
  return `You are AutoAgent iteration ${state.iteration}. Read system-prompt.md for full instructions.`;
}

// ─── Tools ──────────────────────────────────────────────────

const allTools: Anthropic.Tool[] = [
  bashToolDefinition,
  readFileToolDefinition,
  writeFileToolDefinition,
  grepToolDefinition,
  webFetchToolDefinition,
  thinkToolDefinition,
  listFilesToolDefinition,
];

async function handleToolCall(
  iter: number,
  toolUse: { type: "tool_use"; id: string; name: string; input: Record<string, unknown> },
  counts: Record<string, number>
): Promise<{ result: string; isRestart: boolean }> {
  counts[toolUse.name] = (counts[toolUse.name] || 0) + 1;

  try {
    switch (toolUse.name) {
      case "bash": {
        const input = toolUse.input as { command: string; timeout?: number };
        log(iter, `$ ${input.command.slice(0, 200)}${input.command.length > 200 ? "..." : ""}`);
        if (input.command.includes("AUTOAGENT_RESTART")) {
          log(iter, "RESTART signal");
          return { result: "RESTART acknowledged. Harness will validate, commit, restart.", isRestart: true };
        }
        const r = await executeBash(input.command, input.timeout || 120, ROOT);
        log(iter, `  -> exit=${r.exitCode} (${r.output.length} chars)`);
        return { result: r.output, isRestart: false };
      }
      case "read_file": {
        const input = toolUse.input as { path: string; start_line?: number; end_line?: number };
        log(iter, `read_file: ${input.path}`);
        const r = executeReadFile(input.path, input.start_line, input.end_line, ROOT);
        log(iter, `  -> ${r.success ? "ok" : "err"} (${r.content.length} chars)`);
        return { result: r.content, isRestart: false };
      }
      case "write_file": {
        const input = toolUse.input as {
          path: string; content?: string; mode?: "write" | "append" | "patch";
          old_string?: string; new_string?: string;
        };
        const mode = input.mode || "write";
        log(iter, `write_file: ${input.path} (${mode})`);
        const r = executeWriteFile(input.path, input.content || "", mode, ROOT, input.old_string, input.new_string);
        log(iter, `  -> ${r.success ? "ok" : "err"}: ${r.message}`);
        return { result: r.message, isRestart: false };
      }
      case "grep": {
        const input = toolUse.input as {
          pattern: string; path?: string; glob?: string; type?: string;
          output_mode?: "content" | "files" | "count"; context?: number;
          case_insensitive?: boolean; max_results?: number; multiline?: boolean;
        };
        log(iter, `grep: "${input.pattern}"${input.path ? ` in ${input.path}` : ""}`);
        const r = executeGrep(
          input.pattern, input.path, input.glob, input.type,
          input.output_mode, input.context, input.case_insensitive,
          input.max_results, input.multiline, ROOT
        );
        log(iter, `  -> ${r.matchCount} matches`);
        return { result: r.content, isRestart: false };
      }
      case "web_fetch": {
        const input = toolUse.input as { url: string; extract_text?: boolean; headers?: Record<string, string> };
        log(iter, `web_fetch: ${input.url}`);
        const r = await executeWebFetch(input.url, input.extract_text, input.headers);
        log(iter, `  -> ${r.success ? "ok" : "err"} (${r.content.length} chars)`);
        return { result: r.content, isRestart: false };
      }
      case "think": {
        const input = toolUse.input as { thought: string };
        log(iter, `think: ${input.thought.slice(0, 120)}...`);
        return { result: `Thought recorded (${input.thought.length} chars). Continue.`, isRestart: false };
      }
      case "list_files": {
        const input = toolUse.input as { path?: string; depth?: number; exclude?: string[] };
        log(iter, `list_files: ${input.path || "."} (depth=${input.depth || 3})`);
        const r = executeListFiles(input.path, input.depth, input.exclude, ROOT);
        log(iter, `  -> ${r.success ? "ok" : "err"} (${r.dirCount} dirs, ${r.fileCount} files)`);
        return { result: r.content, isRestart: false };
      }
      default:
        return { result: `Unknown tool: ${toolUse.name}`, isRestart: false };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(iter, `TOOL ERROR (${toolUse.name}): ${errMsg}`);
    return { result: `Error executing ${toolUse.name}: ${errMsg}`, isRestart: false };
  }
}

// ─── Validation gate ────────────────────────────────────────

async function validateBeforeCommit(iter: number): Promise<{ ok: boolean; output: string }> {
  log(iter, "Validating: npx tsc --noEmit ...");
  const tsc = await executeBash("npx tsc --noEmit 2>&1", 60, ROOT);
  if (tsc.exitCode !== 0) {
    log(iter, `COMPILE FAILED:\n${tsc.output}`);
    return { ok: false, output: tsc.output };
  }
  log(iter, "Compilation OK");

  const checkScript = path.join(ROOT, "scripts/pre-commit-check.sh");
  if (existsSync(checkScript)) {
    const pc = await executeBash(`bash "${checkScript}"`, 60, ROOT);
    if (pc.exitCode !== 0) return { ok: false, output: `pre-commit-check failed:\n${pc.output}` };
  }
  return { ok: true, output: "ok" };
}

// ─── Main iteration ─────────────────────────────────────────

async function runIteration(state: IterationState): Promise<void> {
  const client = new Anthropic();
  const model = process.env.MODEL || "claude-opus-4-6";
  const maxTokens = parseInt(process.env.MAX_TOKENS || "16384", 10);
  const startTime = new Date();
  const toolCounts: Record<string, number> = {};
  const iter = state.iteration;
  let totalIn = 0, totalOut = 0, totalCacheCreate = 0, totalCacheRead = 0;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  AutoAgent — Iteration ${iter}`);
  console.log(`  Tools: ${allTools.map(t => t.name).join(", ")}`);
  console.log(`${"=".repeat(60)}\n`);

  log(iter, `Starting. Model=${model} MaxTokens=${maxTokens}`);
  await tagPreIteration(iter);

  const goals = readGoals();
  const memory = readMemory();

  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: `Goals:\n\n${goals}\n\n---\n\nMemory:\n\n${memory}\n\n---\n\nExecute your goals. Run \`npx tsc --noEmit\` before restart. Final action: \`echo "AUTOAGENT_RESTART"\`.`,
  }];

  let turns = 0;

  while (turns < MAX_TURNS) {
    turns++;
    const turnsLeft = MAX_TURNS - turns;
    log(iter, `Turn ${turns}/${MAX_TURNS}`);

    const response = await client.messages.create({
      model, max_tokens: maxTokens,
      system: [{
        type: "text" as const,
        text: buildSystemPrompt(state),
        cache_control: { type: "ephemeral" as const },
      }],
      tools: allTools,
      messages,
    });

    // Track tokens (including cache metrics)
    if (response.usage) {
      totalIn += response.usage.input_tokens;
      totalOut += response.usage.output_tokens;
      const usage = response.usage as unknown as Record<string, unknown>;
      if (typeof usage.cache_creation_input_tokens === "number") totalCacheCreate += usage.cache_creation_input_tokens;
      if (typeof usage.cache_read_input_tokens === "number") totalCacheRead += usage.cache_read_input_tokens;
    }

    const content = response.content;
    messages.push({ role: "assistant", content });

    for (const block of content) {
      if (block.type === "text") {
        log(iter, `Agent: ${block.text.slice(0, 400)}${block.text.length > 400 ? "..." : ""}`);
      }
    }

    const toolUses = content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
        b.type === "tool_use"
    );

    if (toolUses.length === 0) {
      log(iter, "No tool calls — ending");
      break;
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    let shouldRestart = false;

    for (const tu of toolUses) {
      const { result, isRestart } = await handleToolCall(iter, tu, toolCounts);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      if (isRestart) shouldRestart = true;
    }

    messages.push({ role: "user", content: results });

    if (shouldRestart) {
      const v = await validateBeforeCommit(iter);
      if (!v.ok) {
        log(iter, "VALIDATION BLOCKED RESTART — agent must fix");
        messages.push({
          role: "user",
          content: `BLOCKED: Code doesn't compile. Fix it.\n\n\`\`\`\n${v.output.slice(0, 2000)}\n\`\`\`\n\nFix, run \`npx tsc --noEmit\`, then \`echo "AUTOAGENT_RESTART"\` again.`,
        });
        continue;
      }

      recordMetrics({
        iteration: iter, startTime: startTime.toISOString(), endTime: new Date().toISOString(),
        turns, toolCalls: toolCounts, success: true,
        durationMs: Date.now() - startTime.getTime(),
        inputTokens: totalIn, outputTokens: totalOut,
        cacheCreationTokens: totalCacheCreate || undefined,
        cacheReadTokens: totalCacheRead || undefined,
      });

      const sha = await commitIteration(iter);
      log(iter, `Committed: ${sha.slice(0, 8)} (${totalIn} in / ${totalOut} out, cache: ${totalCacheCreate} created, ${totalCacheRead} read)`);

      state.lastSuccessfulIteration = iter;
      state.lastFailedCommit = null;
      state.lastFailureReason = null;
      state.iteration++;
      saveState(state);

      log(iter, `Restarting as iteration ${state.iteration}...`);
      restart();
      return;
    }

    if (response.stop_reason === "end_turn") {
      log(iter, "end_turn");
      break;
    }

    if (turnsLeft === 10) {
      messages.push({ role: "user", content: "SYSTEM: 10 turns left. Wrap up: memory, goals, tsc, AUTOAGENT_RESTART." });
    }
    if (turnsLeft === 3) {
      messages.push({ role: "user", content: "URGENT: 3 turns left! Send AUTOAGENT_RESTART NOW." });
    }
  }

  if (turns >= MAX_TURNS) log(iter, "Hit max turns — forcing commit");

  recordMetrics({
    iteration: iter, startTime: startTime.toISOString(), endTime: new Date().toISOString(),
    turns, toolCalls: toolCounts, success: true,
    durationMs: Date.now() - startTime.getTime(),
    inputTokens: totalIn, outputTokens: totalOut,
    cacheCreationTokens: totalCacheCreate || undefined,
    cacheReadTokens: totalCacheRead || undefined,
  });

  const sha = await commitIteration(iter);
  log(iter, `Committed (no restart): ${sha.slice(0, 8)}`);
  state.lastSuccessfulIteration = iter;
  state.iteration++;
  saveState(state);
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
