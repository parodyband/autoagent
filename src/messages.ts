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
 * The agent fully owns this file. A separate alignment meta-layer (alignment.ts)
 * monitors for drift and writes feedback to memory if the agent goes off-rails.
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

// ─── Initial user message ───────────────────────────────────

/**
 * Build the first user message that kicks off an iteration.
 * Optionally includes an orientation section showing what changed since last iteration.
 */
export function buildInitialMessage(goals: string, memory: string, orientation?: string): string {
  const parts: string[] = [];
  
  if (orientation) {
    parts.push(orientation);
    parts.push("---");
  }
  
  parts.push(`Goals:\n\n${goals}`);
  parts.push("---");
  parts.push(`Memory:\n\n${memory}`);
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

// ─── Progress checkpoint ────────────────────────────────────

/**
 * At turn 10, inject a progress checkpoint that asks the agent to
 * explicitly evaluate whether its goals are complete.
 * This combats turn bloat by creating a natural "wrap up" decision point.
 */
export function progressCheckpoint(turn: number): string | null {
  if (turn !== 10) return null;
  return (
    "SYSTEM: Progress checkpoint — Turn 10. " +
    "Review your goals.md. For each goal, state: DONE, IN PROGRESS, or NOT STARTED. " +
    "If all goals are DONE, write memory, update goals, run `npx tsc --noEmit`, and `echo \"AUTOAGENT_RESTART\"`. " +
    "If goals remain, briefly state what's left and continue."
  );
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
