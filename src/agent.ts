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
import { readFileSync, existsSync, appendFileSync, writeFileSync, unlinkSync } from "fs";
import { Logger, createLogger } from "./logging.js";
import { spawn as spawnProcess } from "child_process";
import path from "path";
import "dotenv/config";
import { executeBash } from "./tools/bash.js";
import { createDefaultRegistry } from "./tool-registry.js";
import { loadState, tagPreIteration, type IterationState } from "./iteration.js";
import { buildInitialMessage } from "./messages.js";
import { orient, formatOrientation } from "./orientation.js";
import { fingerprintRepo } from "./repo-context.js";
import { rankFiles, formatRankedFiles } from "./file-ranker.js";
import { parseMemory, getSection, serializeMemory } from "./memory.js";
import { ToolCache } from "./tool-cache.js";
import { ToolTimingTracker } from "./tool-timing.js";
import { finalizeIteration as runFinalization, emitOnceSummary } from "./finalization.js";
import { runConversation, type IterationCtx } from "./conversation.js";
import { loadExperts, pickExpert, buildExpertPrompt, saveExpertState } from "./experts.js";
import {
  countConsecutiveFailures,
  resuscitate,
  handleIterationFailure,
  type ResuscitationConfig,
} from "./resuscitation.js";
import { computeTurnBudget } from "./turn-budget.js";
import { shouldDecompose, decomposeTasks, formatSubtasks } from "./task-decomposer.js";
import { runVerification, formatVerificationResults } from "./verification.js";

const ROOT = process.cwd();
const GOALS_FILE = path.join(ROOT, "goals.md");
const TASK_FILE = path.join(ROOT, "TASK.md");
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
    console.error(`  ${msg}`);
    try { appendFileSync(AGENT_LOG_FILE, line, "utf-8"); } catch {}
  }
}

// ─── File readers ───────────────────────────────────────────

function readGoals(iteration: number): string {
  // Task mode: if TASK.md exists, use it as the goal for this iteration.
  // Create TASK.md with a plain-text description of what you want done.
  // The agent will execute it and delete TASK.md when complete.
  if (existsSync(TASK_FILE)) {
    const taskContent = readFileSync(TASK_FILE, "utf-8").trim();
    log(iteration, `[TASK MODE] Running user task from TASK.md`);
    return [
      `# AutoAgent Task Mode — Iteration ${iteration}`,
      ``,
      `PREDICTION_TURNS: 11`,
      ``,
      `## Goal: User Task`,
      ``,
      taskContent,
      ``,
      `---`,
      ``,
      `When this task is complete, delete TASK.md and write a short summary`,
      `of what was done to memory.md under "## Session Log".`,
    ].join("\n");
  }
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
    const count = ctx.cache.serialize(CACHE_FILE, ctx.agentHome);
    ctx.log(`Cache persisted: ${count} entries to ${path.basename(CACHE_FILE)}`);
  } catch (err) {
    ctx.log(`Cache persist error (non-fatal): ${err instanceof Error ? err.message : err}`);
  }


  // Task mode: delete TASK.md BEFORE finalization so it's excluded from the
  // git commit and gone before any restart. Previously this was after
  // runFinalization(), but restart() calls process.exit() so the deletion
  // never executed in normal (non --once) mode — causing infinite re-execution.
  if (ctx.taskMode && existsSync(TASK_FILE)) {
    unlinkSync(TASK_FILE);
    ctx.log(`[TASK MODE] TASK.md deleted after successful iteration`);
  }

  // --once mode: never restart regardless of what callers request
  const effectiveRestart = ctx.once ? false : doRestart;

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
    agentHome: ROOT,
    metricsFile: METRICS_FILE,
    log: (msg: string) => log(ctx.iter, msg),
    logger,
    restart,
    predictedTurns: ctx.predictedTurns,
    once: ctx.once,
    failed: ctx.failed,
  }, effectiveRestart);

  // --once mode: exit after finalization with appropriate exit code
  if (ctx.once) {
    const exitCode = ctx.failed ? 1 : 0;
    ctx.log(`--once mode: exiting after single iteration (exit ${exitCode})`);
    process.exit(exitCode);
  }
}

// ─── Restart ────────────────────────────────────────────────

function restart(): never {
  const extraArgs: string[] = [];
  const repoIdx = process.argv.indexOf("--repo");
  if (repoIdx !== -1 && process.argv[repoIdx + 1]) {
    extraArgs.push("--repo", process.argv[repoIdx + 1]);
  }
  const child = spawnProcess(
    process.execPath,
    [path.join(ROOT, "node_modules/.bin/tsx"), path.join(ROOT, "src/agent.ts"), ...extraArgs],
    { stdio: "inherit", cwd: ROOT, detached: true, env: process.env }
  );
  child.unref();
  process.exit(0);
}

// ─── Main iteration ─────────────────────────────────────────

async function runIteration(state: IterationState, workDir: string = ROOT, onceMode = false): Promise<void> {
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

  // Pick which expert runs this iteration
  const experts = loadExperts(ROOT);
  let expert = pickExpert(state.iteration, experts);

  // Task mode: force Engineer expert so user tasks always get code execution
  const taskMode = existsSync(TASK_FILE);
  if (taskMode) {
    const engineerExpert = experts.find(e => e.name === "Engineer") ?? expert;
    expert = engineerExpert;
    log(state.iteration, `[TASK MODE] Expert overridden to Engineer`);
  }

  // Parse predicted turns from goals before they get rewritten
  const goalsContent = readGoals(state.iteration);
  const predMatch = goalsContent.match(/PREDICTION_TURNS:\s*(\d+)/);
  const rawPrediction = predMatch ? parseInt(predMatch[1], 10) : null;

  // Compute adaptive turn budget from historical metrics + calibration
  const turnBudget = computeTurnBudget(METRICS_FILE, rawPrediction, MAX_TURNS, 10, workDir);

  // Don't double-calibrate: computeTurnBudget already applies calibration to the
  // budget internally. ctx.predictedTurns stays as the raw expert prediction so that
  // future calibration ratios compare actual vs. what the expert wrote, not vs. an
  // already-inflated number. (The old code multiplied raw * calibration here AND inside
  // computeTurnBudget, causing oscillation: over-correct → low ratio → under-correct → repeat.)
  const predictedTurns = rawPrediction;
  log(state.iteration, `Turn budget: ${turnBudget.recommended}/${turnBudget.hardMax} (calibration=${turnBudget.calibration.toFixed(2)}x, predicted=${predictedTurns})`);

  // Compute next expert so current expert can write properly-targeted goals
  const nextExpert = pickExpert(state.iteration + 1, experts);
  const goalsWithRotation = goalsContent +
    `\n\nNext expert (iteration ${state.iteration + 1}): **${nextExpert.name}** — write goals.md targeting this expert.`;

  const ctx: IterationCtx = {
    client: new Anthropic(),
    model: expert.model,
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
    rootDir: workDir,
    agentHome: ROOT,
    maxTurns: MAX_TURNS,
    logger,
    registry: toolRegistry,
    log: (msg: string) => log(state.iteration, msg),
    onFinalize: doFinalize,
    compressionConfig: null, // Disabled — prompt caching handles token cost
    predictedTurns,
    turnBudget,
    taskMode,
    once: onceMode,
  };

  console.error(`\n${"=".repeat(60)}`);
  console.error(`  AutoAgent — Iteration ${ctx.iter}`);
  console.error(`  Expert: ${expert.name} (${expert.model})`);
  console.error(`${"=".repeat(60)}\n`);

  logger.info(`Starting. Expert=${expert.name} Model=${expert.model}`);
  await tagPreIteration(ctx.iter);
  saveExpertState(ROOT, expert.name, ctx.iter);

  // Orient: detect changes since last iteration (run in target repo if --repo)
  const orientReport = await orient(1000, true, workDir);
  const orientationText = formatOrientation(orientReport);

  // Fingerprint the working repo (only injected when operating on an external repo)
  const repoContextText = workDir !== ROOT ? fingerprintRepo(workDir) : undefined;
  if (repoContextText) {
    log(state.iteration, `Repo fingerprint generated (${repoContextText.length} chars)`);
  }

  // Rank files by importance (only for external repos)
  const keyFilesText = workDir !== ROOT ? formatRankedFiles(rankFiles(workDir)) : undefined;
  if (keyFilesText) {
    log(state.iteration, `Key files ranked (${keyFilesText.length} chars)`);
  }

  // Expert gets its own system prompt
  ctx.systemPromptBuilder = (s, r) => buildExpertPrompt(expert, s, r);

  // Task decomposition: if TASK.md is complex, break it into subtasks and inject
  let subtasksText: string | undefined;
  if (taskMode) {
    const rawTask = existsSync(TASK_FILE) ? readFileSync(TASK_FILE, "utf-8").trim() : "";
    if (rawTask && shouldDecompose(rawTask)) {
      const callClaude = async (prompt: string): Promise<string> => {
        const resp = await ctx.client.messages.create({
          model: expert.model,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });
        const block = resp.content[0];
        return block.type === "text" ? block.text : "";
      };
      try {
        const subtasks = await decomposeTasks(rawTask, callClaude);
        subtasksText = formatSubtasks(subtasks);
        log(state.iteration, `Task decomposed into ${subtasks.length} subtasks`);
      } catch (err) {
        log(state.iteration, `Task decomposition failed (non-fatal): ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // Build initial message with goals, memory, orientation, repo context, key files, and subtasks
  const initialContent = buildInitialMessage(goalsWithRotation, readMemory(), orientationText || undefined, repoContextText || undefined, keyFilesText || undefined, subtasksText || undefined);
  ctx.messages.push({
    role: "user",
    content: initialContent,
  });

  await runConversation(ctx);

  // Pre-finalization verification: run test/build commands in the target repo (advisory only)
  // Uses closure variables workDir and repoContextText — never runs on autoagent's own repo.
  if (workDir !== ROOT && repoContextText) {
    try {
      const verResults = await runVerification(workDir, repoContextText);
      if (verResults.length > 0) {
        const summary = formatVerificationResults(verResults);
        log(state.iteration, `Verification: ${verResults.filter(r => r.passed).length}/${verResults.length} checks passed`);
        if (summary) {
          ctx.messages.push({ role: "user", content: summary });
        }
      }
    } catch (err) {
      log(state.iteration, `Verification error (non-fatal): ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ─── Entry point ────────────────────────────────────────────

const resusConfig: ResuscitationConfig = {
  memoryFile: MEMORY_FILE,
  goalsFile: GOALS_FILE,
  log,
  restart,
};

function printHelp(): void {
  console.log(`
AutoAgent — a self-improving AI coding agent

USAGE
  npx tsx src/agent.ts [OPTIONS]

OPTIONS
  -h, --help              Print this help message and exit
  --once                  Run exactly one iteration and exit (no restart)
                          Exits 0 on success, 1 on failure. Useful for CI/CD.
  --repo <path>           Operate on an external repository at <path>
                          (agent state stays in the current directory)
  --task "<description>"  Run a one-shot task described inline
                          (writes a temporary TASK.md and starts the agent)

TASK.MD MODE
  Create a file named TASK.md in the project root with a plain-text
  description of what you want done. AutoAgent will execute the task
  and delete TASK.md when complete.

EXAMPLES
  npx tsx src/agent.ts
  npx tsx src/agent.ts --repo /path/to/project
  npx tsx src/agent.ts --task "Add input validation to the login form"
`);
}

async function main(): Promise<void> {
  // Handle --help / -h before anything else
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  // Parse --once flag (run single iteration, no restart)
  const onceMode = process.argv.includes("--once");

  // Parse --repo /path flag (external repo to operate on)
  let WORK_DIR = ROOT; // defaults to AGENT_HOME
  const repoFlagIdx = process.argv.indexOf("--repo");
  if (repoFlagIdx !== -1) {
    const repoPath = process.argv[repoFlagIdx + 1];
    if (!repoPath || repoPath.startsWith("--")) {
      console.error("Error: --repo requires a path argument, e.g. --repo /path/to/project");
      process.exit(1);
    }
    const resolved = path.resolve(repoPath);
    if (!existsSync(resolved)) {
      console.error(`Error: --repo path does not exist: ${resolved}`);
      process.exit(1);
    }
    const { statSync } = await import("fs");
    if (!statSync(resolved).isDirectory()) {
      console.error(`Error: --repo path is not a directory: ${resolved}`);
      process.exit(1);
    }
    WORK_DIR = resolved;
    console.error(`Repo mode: operating on ${WORK_DIR}`);
  }

  // Parse --task "description" CLI flag
  const taskFlagIdx = process.argv.indexOf("--task");
  if (taskFlagIdx !== -1) {
    const taskDescription = process.argv[taskFlagIdx + 1];
    if (!taskDescription || taskDescription.startsWith("--")) {
      console.error("Error: --task requires a description argument, e.g. --task \"Fix the bug in parser.ts\"");
      process.exit(1);
    }
    if (existsSync(TASK_FILE)) {
      console.error("Error: TASK.md already exists. Complete or remove the pending task first.");
      process.exit(1);
    }
    writeFileSync(TASK_FILE, taskDescription + "\n", "utf-8");
    console.error(`Created TASK.md with task: ${taskDescription}`);
  }

  if (!existsSync(AGENT_LOG_FILE)) {
    writeFileSync(AGENT_LOG_FILE, "# AutoAgent Log\n\n", "utf-8");
  }

  console.error("AutoAgent starting...");

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

  const iterStartTime = new Date();
  try {
    await runIteration(state, WORK_DIR, onceMode);
  } catch (err) {
    if (onceMode) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("--once iteration failed:", reason);
      // Emit failure JSON to stdout so callers can parse it
      await emitOnceSummary({
        success: false,
        iteration: state.iteration,
        turns: 0,
        startTime: iterStartTime,
        exitCode: 1,
        tokensUsed: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        commitSha: "",
      });
      process.exit(1);
    }
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
