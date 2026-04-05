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
 * - resuscitation.ts — circuit breaker, failure recovery
 * - messages.ts — prompt construction
 * - tool-registry.ts — tool definitions and handlers
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "fs";
import { Logger, createLogger } from "./logging.js";
import { spawn as spawnProcess } from "child_process";
import path from "path";
import "dotenv/config";
import { executeBash } from "./tools/bash.js";
import { createDefaultRegistry } from "./tool-registry.js";
import { loadState, tagPreIteration, type IterationState } from "./iteration.js";
import { buildInitialMessage } from "./messages.js";
import { orient, formatOrientation } from "./orientation.js";
import { ToolCache } from "./tool-cache.js";
import { ToolTimingTracker } from "./tool-timing.js";
import { finalizeIteration as runFinalization } from "./finalization.js";
import { runConversation, type IterationCtx } from "./conversation.js";
import {
  countConsecutiveFailures,
  resuscitate,
  handleIterationFailure,
  type ResuscitationConfig,
} from "./resuscitation.js";

const ROOT = process.cwd();
const GOALS_FILE = path.join(ROOT, "goals.md");
const MEMORY_FILE = path.join(ROOT, "memory.md");
const METRICS_FILE = path.join(ROOT, ".autoagent-metrics.json");
const AGENT_LOG_FILE = path.join(ROOT, "agentlog.md");
const CACHE_FILE = path.join(ROOT, ".autoagent-cache.json");
const MAX_TURNS = 25;
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
  if (content.length <= max) return content;

  // Preserve stable sections (Architecture, Schemas, Backlog) above Session Log.
  // Only truncate the session log, which grows unboundedly.
  const marker = "## Session Log";
  const splitIdx = content.indexOf(marker);
  if (splitIdx === -1) {
    return "...(earlier entries truncated)...\n\n" + content.slice(-max);
  }

  const stableSection = content.slice(0, splitIdx);
  const sessionLog = content.slice(splitIdx);
  const remainingBudget = max - stableSection.length;

  if (remainingBudget <= 200) {
    // Stable section alone near/exceeds budget — include it, skip session log
    return stableSection.slice(0, max) + "\n\n...(session log truncated)...";
  }

  return stableSection + "...(earlier session entries truncated)...\n\n" + sessionLog.slice(-remainingBudget);
}

// ─── Finalization delegate ──────────────────────────────────

const toolRegistry = createDefaultRegistry();

async function doFinalize(ctx: IterationCtx, doRestart: boolean): Promise<void> {
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

// ─── Main iteration ─────────────────────────────────────────

async function runIteration(state: IterationState): Promise<void> {
  logger = createLogger(state.iteration, ROOT);

  const cache = new ToolCache();

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
    compressionConfig: null, // Disabled — prompt caching handles token cost; compression risks orphaning tool_result blocks
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  AutoAgent — Iteration ${ctx.iter}`);
  console.log(`  Tools: ${toolRegistry.getNames().join(", ")}`);
  console.log(`${"=".repeat(60)}\n`);

  logger.info(`Starting. Model=${ctx.model} MaxTokens=${ctx.maxTokens}`);
  await tagPreIteration(ctx.iter);

  // Orient: detect changes since last iteration
  const orientReport = await orient();
  const orientationText = formatOrientation(orientReport);
  if (orientReport.hasChanges) {
    logger.info(`Orientation: changes detected since last iteration`);
  }

  ctx.messages.push({
    role: "user",
    content: buildInitialMessage(readGoals(), readMemory(), orientationText || undefined),
  });

  await runConversation(ctx);
}

// ─── Entry point ────────────────────────────────────────────

const resusConfig: ResuscitationConfig = {
  memoryFile: MEMORY_FILE,
  goalsFile: GOALS_FILE,
  log,
  restart,
};

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
    await resuscitate(state, failures, resusConfig);
    return;
  }

  try {
    await runIteration(state);
  } catch (err) {
    await handleIterationFailure(state, err, resusConfig);
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
