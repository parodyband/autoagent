/**
 * Message construction module — prompt engineering extracted from agent.ts.
 *
 * Builds system prompts, user messages, budget warnings, and turn-limit
 * nudges. Isolated here for testability and to keep agent.ts focused on
 * the main loop.
 */

import { readFileSync, existsSync } from "fs";
import path from "path";
import type { IterationState } from "./iteration.js";

// ─── System prompt ──────────────────────────────────────────

/**
 * Build the system prompt from system-prompt.md, injecting iteration state.
 * The agent fully owns this file.
 */
export function buildSystemPrompt(state: IterationState, rootDir: string): string {
  const filePath = path.join(rootDir, "system-prompt.md");
  if (existsSync(filePath)) {
    let t = readFileSync(filePath, "utf-8");
    t = t.replace(/\{\{ITERATION\}\}/g, String(state.iteration));
    t = t.replace(/\{\{ROOT\}\}/g, rootDir);
    t = t.replace(/\{\{LAST_SUCCESSFUL\}\}/g, String(state.lastSuccessfulIteration));
    t = t.replace(/\{\{LAST_FAILED_COMMIT\}\}/g, state.lastFailedCommit || "none");
    t = t.replace(/\{\{LAST_FAILURE_REASON\}\}/g, state.lastFailureReason || "none");
    return t;
  }
  return `You are AutoAgent iteration ${state.iteration}. Read system-prompt.md for full instructions.`;
}

// ─── Builder system prompt ──────────────────────────────────

/**
 * Focused prompt for the Builder (Sonnet). No philosophy, no cognitive science.
 * Just: follow the plan, use tools, build the thing.
 */
export function buildBuilderSystemPrompt(state: IterationState, rootDir: string): string {
  return `You are the Builder for AutoAgent, iteration ${state.iteration}.

You have a plan. Execute it step by step.

## Rules
- Follow the plan. Do not deviate.
- Use tools to read, write, and test code.
- ESM project: use import, never require(). Use .js extensions in imports within src/.
- Run \`npx tsc --noEmit\` before finishing to verify compilation.
- When done with the plan, run \`echo "AUTOAGENT_RESTART"\` to signal completion.
- If you finish the plan early, STOP. Do not start new work.
- If a step is blocked, skip it and note why in a brief comment.
- Do NOT rewrite memory.md or goals.md. The Reviewer handles memory.
- Do NOT add tests unless the plan says to.
- Do NOT refactor code unless the plan says to.

## Environment
- Working directory: ${rootDir}
- Validation gate blocks broken commits — you'll get the error back and can fix it.
- Commands with no output for 30s are killed (stall protection).
- Never run interactive commands (editors, REPLs). Use write_file instead.

## Iteration state
- Current iteration: ${state.iteration}
- Last successful: ${state.lastSuccessfulIteration}
${state.lastFailedCommit ? `- Last failed commit: ${state.lastFailedCommit}` : ""}
${state.lastFailureReason ? `- Last failure: ${state.lastFailureReason}` : ""}`;
}

/**
 * Build the initial user message for the Builder from the plan.
 */
export function buildBuilderMessage(plan: string, memorySummary: string): string {
  return `## Your Plan\n\n${plan}\n\n---\n\n## Brief Context\n\n${memorySummary.slice(0, 2000)}\n\n---\n\nExecute the plan. Run \`npx tsc --noEmit\` before restart. Final action: \`echo "AUTOAGENT_RESTART"\`.`;
}

// ─── Initial user message ───────────────────────────────────

/**
 * Build the first user message that kicks off an iteration.
 * Optionally includes an orientation section showing what changed since last iteration.
 * Optionally includes a repoContext block (from fingerprintRepo) for external repos.
 * Optionally includes a keyFiles block (from rankFiles) for file-level guidance.
 * Optionally includes a subtasks block (from formatSubtasks) when task decomposition ran.
 */
export function buildInitialMessage(goals: string, memory: string, orientation?: string, repoContext?: string, keyFiles?: string, subtasks?: string): string {
  const parts: string[] = [];
  
  if (orientation) {
    parts.push(orientation);
    parts.push("---");
  }
  
  if (repoContext) {
    parts.push(repoContext);
    if (keyFiles) {
      parts.push(keyFiles);
    }
    parts.push("---");
  }
  
  parts.push(`Goals:\n\n${goals}`);
  parts.push("---");
  parts.push(`Memory:\n\n${memory}`);

  if (subtasks) {
    parts.push("---");
    parts.push(subtasks);
  }

  parts.push("---");
  parts.push(`Execute your goals. Run \`npx tsc --noEmit\` before restart. Final action: \`echo "AUTOAGENT_RESTART"\`.`);
  
  return parts.join("\n\n");
}

// ─── Token budget warnings ──────────────────────────────────

export interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  elapsedMs: number;
}

/**
 * If the current turn is a budget-check milestone (15, 25, 35),
 * return a warning message. Otherwise return null.
 */
export function budgetWarning(
  turn: number,
  maxTurns: number,
  stats: TokenStats,
): string | null {
  if (turn !== 15 && turn !== 25 && turn !== 35) return null;

  const totalTokens = stats.inputTokens + stats.outputTokens;
  const elapsedSec = Math.round(stats.elapsedMs / 1000);

  return (
    `SYSTEM: Token budget check — Turn ${turn}/${maxTurns}. ` +
    `Cumulative: ${(stats.inputTokens / 1000).toFixed(1)}K in + ${(stats.outputTokens / 1000).toFixed(1)}K out = ${(totalTokens / 1000).toFixed(1)}K total. ` +
    `Cache: ${(stats.cacheReadTokens / 1000).toFixed(1)}K read hits. ` +
    `Elapsed: ${elapsedSec}s. Pace yourself — prioritize high-value actions.`
  );
}

// ─── Cognitive metrics ──────────────────────────────────────

/**
 * Quantitative snapshot of the agent's cognitive behavior this iteration.
 * Surfaced at progress checkpoints so the agent can self-correct.
 */
export interface CognitiveMetrics {
  inputTokens: number;
  outputTokens: number;
  /** Count of "reading" tools: read_file, grep, list_files, web_fetch */
  readCalls: number;
  /** Count of "writing" tools: write_file, bash (conservative — bash can do both) */
  writeCalls: number;
  /** Total tool calls so far */
  totalCalls: number;
  turns: number;
}

/**
 * Compute derived ratios from raw cognitive metrics.
 */
export function formatCognitiveMetrics(m: CognitiveMetrics): string {
  const outInRatio = m.inputTokens > 0 ? (m.outputTokens / m.inputTokens).toFixed(1) : "∞";
  const tokensPerTurn = m.turns > 0 ? Math.round((m.inputTokens + m.outputTokens) / m.turns) : 0;
  const readPct = m.totalCalls > 0 ? Math.round((m.readCalls / m.totalCalls) * 100) : 0;
  
  const lines = [
    `  Output/Input ratio: ${outInRatio}x (target: <2x)`,
    `  Read tools: ${m.readCalls}/${m.totalCalls} (${readPct}%)`,
    `  Tokens/turn: ${(tokensPerTurn / 1000).toFixed(1)}K`,
  ];

  // Add warnings for bad ratios
  const ratio = m.inputTokens > 0 ? m.outputTokens / m.inputTokens : Infinity;
  if (ratio > 2.5) {
    lines.push(`  ⚠️ HIGH OUTPUT RATIO — you are generating far more than reading. Slow down. Read more before writing.`);
  }
  if (m.totalCalls > 3 && readPct < 25) {
    lines.push(`  ⚠️ LOW READ RATIO — only ${readPct}% of tool calls are reads. Are you writing blind?`);
  }

  return lines.join("\n");
}

// ─── Progress checkpoint ────────────────────────────────────

/**
 * Inject escalating progress checkpoints at turns 8, 15, and 20.
 * This combats turn bloat by creating multiple "wrap up" decision points
 * with increasing urgency. The #1 pattern of wasted iterations is
 * continuing past turn 20 without a concrete reason.
 *
 * When cognitive metrics are provided, the checkpoint includes quantitative
 * feedback about the agent's reading-vs-generating behavior — a concrete
 * signal that helps prevent drift into pure output mode.
 */
export function progressCheckpoint(turn: number, metrics?: CognitiveMetrics): string | null {
  const metricsBlock = metrics ? `\n\nCognitive metrics this iteration:\n${formatCognitiveMetrics(metrics)}` : "";

  if (turn === 4) {
    return (
      "SYSTEM: Early checkpoint — Turn 4/25. " +
      "You've used 4 turns. Have you started producing a deliverable yet (writing/patching a file that's in your goals)? " +
      "If you've only been reading, exploring, or thinking — STOP exploring and start writing. " +
      "The #1 source of waste is unfocused upfront exploration: reading files you won't use, " +
      "running probes that fail, gathering context beyond what your deliverables require. " +
      "State your deliverables and start producing them NOW."
    );
  }
  if (turn === 8) {
    return (
      "SYSTEM: Progress checkpoint — Turn 8/25. " +
      "Review your goals.md. State status of each goal: DONE, IN PROGRESS, or NOT STARTED. " +
      "If all goals are DONE, write memory, update goals, run `npx tsc --noEmit`, and `echo \"AUTOAGENT_RESTART\"`. " +
      "If goals remain, briefly state what's left and continue — but plan to finish by turn 15." +
      metricsBlock
    );
  }
  if (turn === 15) {
    return (
      "SYSTEM: Progress checkpoint — Turn 15/25. Past halfway. " +
      "STOP. What have you actually changed in src/ this iteration? " +
      "If the answer is 'nothing' or 'only bookkeeping', you are in a drift loop. " +
      "Begin wrapping up NOW: write memory, update goals, commit. " +
      "Do NOT start new work after this point." +
      metricsBlock
    );
  }
  if (turn === 20) {
    return (
      "SYSTEM: FINAL WARNING — Turn 20/25. Hard stop in 5 turns. " +
      "STOP ALL WORK. Write memory. Update goals. Run `npx tsc --noEmit`. `echo \"AUTOAGENT_RESTART\"`. " +
      "Every turn past 20 is wasted money. You will be cut off at 25." +
      metricsBlock
    );
  }
  return null;
}

// ─── Turn limit nudges ──────────────────────────────────────

/**
 * Return a turn-limit nudge if the agent is running low on turns.
 * Returns null if no nudge is needed.
 */
export function turnLimitNudge(turnsLeft: number): string | null {
  if (turnsLeft === 10) {
    return "SYSTEM: 10 turns left. Wrap up: memory, goals, tsc, AUTOAGENT_RESTART.";
  }
  if (turnsLeft === 3) {
    return "URGENT: 3 turns left! Send AUTOAGENT_RESTART NOW.";
  }
  return null;
}

// ─── Validation-blocked message ─────────────────────────────

/**
 * Build the message shown when validation blocks a restart attempt.
 */
export function validationBlockedMessage(output: string): string {
  return (
    `BLOCKED: Code doesn't compile. Fix it.\n\n` +
    `\`\`\`\n${output.slice(0, 2000)}\n\`\`\`\n\n` +
    `Fix, run \`npx tsc --noEmit\`, then \`echo "AUTOAGENT_RESTART"\` again.`
  );
}
