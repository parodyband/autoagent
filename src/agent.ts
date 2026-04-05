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
import { buildBuilderSystemPrompt, buildBuilderMessage } from "./messages.js";
import { orient, formatOrientation } from "./orientation.js";
import { parseMemory, getSection, serializeMemory } from "./memory.js";
import { ToolCache } from "./tool-cache.js";
import { ToolTimingTracker } from "./tool-timing.js";
import { finalizeIteration as runFinalization } from "./finalization.js";
import { runConversation, type IterationCtx } from "./conversation.js";
import { runPlanner, runReviewer } from "./phases.js";
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

  // Use structured parsing to budget sections intelligently.
  // Stable sections (Architecture, Schemas, Backlog) get full budget.
  // Session Log gets whatever remains, truncated from the top.
  const sections = parseMemory(content);
  const stableSections = sections.filter(s => !s.heading.toLowerCase().startsWith("session log"));
  const sessionLog = sections.find(s => s.heading.toLowerCase().startsWith("session log"));

  const stableText = serializeMemory(stableSections);
  if (!sessionLog) {
    return stableText.length <= max ? stableText : stableText.slice(-max);
  }

  const remainingBudget = max - stableText.length;
  if (remainingBudget <= 200) {
    return stableText.slice(0, max) + "\n\n...(session log truncated)...";
  }

  const logContent = sessionLog.content;
  const truncatedLog = logContent.length <= remainingBudget
    ? logContent
    : "...(earlier entries truncated)...\n\n" + logContent.slice(-remainingBudget);

  return stableText + `\n\n---\n\n## ${sessionLog.heading}\n\n${truncatedLog}`;
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
    predictedTurns: ctx.predictedTurns,
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
    model: "claude-sonnet-4-6", // Builder uses Sonnet — Planner/Reviewer use Opus
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
    compressionConfig: null, // Disabled — prompt caching handles token cost
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  AutoAgent — Iteration ${ctx.iter}`);
  console.log(`  Architecture: Planner (Opus) → Builder (Sonnet) → Reviewer (Opus)`);
  console.log(`${"=".repeat(60)}\n`);

  logger.info(`Starting. Builder model=${ctx.model} MaxTokens=${ctx.maxTokens}`);
  await tagPreIteration(ctx.iter);

  // ─── Phase 1: Planner (Opus) ───
  const orientReport = await orient();
  const orientationText = formatOrientation(orientReport);

  const planResult = await runPlanner({
    iteration: ctx.iter,
    rootDir: ROOT,
    memory: readMemory(),
    orientation: orientationText || "",
    log: (msg: string) => log(ctx.iter, msg),
  });

  // Track planner tokens as overhead
  ctx.tokens.in += planResult.inputTokens;
  ctx.tokens.out += planResult.outputTokens;
  logger.info(`Planner: ${planResult.inputTokens} in / ${planResult.outputTokens} out tokens`);

  // ─── Phase 2: Builder (Sonnet) ───
  ctx.systemPromptBuilder = buildBuilderSystemPrompt;
  ctx.messages.push({
    role: "user",
    content: buildBuilderMessage(planResult.plan, readMemory()),
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
