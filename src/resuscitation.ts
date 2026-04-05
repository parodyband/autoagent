/**
 * Resuscitation — circuit breaker and failure recovery.
 *
 * When the agent hits too many consecutive failures, this module:
 * 1. Rolls back to the last known good state
 * 2. Writes recovery notes to memory
 * 3. Sets conservative recovery goals
 * 4. Restarts with a cooldown
 *
 * Also handles per-iteration failure recording (rollback, state update, memory note).
 */

import { appendFileSync, writeFileSync } from "fs";
import { executeBash } from "./tools/bash.js";
import {
  saveState,
  rollbackToPreIteration,
  type IterationState,
} from "./iteration.js";

// ─── Types ──────────────────────────────────────────────────

export interface ResuscitationConfig {
  memoryFile: string;
  goalsFile: string;
  log: (iter: number, msg: string) => void;
  restart: () => never;
}

// ─── Failure counting ───────────────────────────────────────

export function countConsecutiveFailures(state: IterationState): number {
  if (state.lastSuccessfulIteration < 0) return state.iteration;
  return state.iteration - state.lastSuccessfulIteration - 1;
}

// ─── Resuscitation (circuit breaker) ────────────────────────

/**
 * Triggered after MAX_CONSECUTIVE_FAILURES. Rolls back to last good state,
 * writes recovery notes, sets conservative goals, and restarts.
 */
export async function resuscitate(
  state: IterationState,
  failures: number,
  config: ResuscitationConfig,
): Promise<void> {
  config.log(state.iteration, `CIRCUIT BREAKER: ${failures} failures — resuscitating`);

  if (state.lastSuccessfulIteration >= 0) {
    const tag = `pre-iteration-${state.lastSuccessfulIteration + 1}`;
    const check = await executeBash(`git tag -l ${tag}`, 120, undefined, true);
    if (check.output.trim()) {
      await executeBash(`git reset --hard ${tag}`, 120, undefined, true);
      config.log(state.iteration, `Rolled back to ${tag}`);
    }
  }

  const note =
    `\n## CIRCUIT BREAKER RECOVERY — Iteration ${state.iteration} (${new Date().toISOString()})\n\n` +
    `**${failures} consecutive failures.** Rolled back to last good state.\n\n` +
    `- Last error: ${state.lastFailureReason}\n` +
    `- Last failed commit: ${state.lastFailedCommit?.slice(0, 8) || "unknown"}\n\n` +
    `**DO NOT retry the same approach.** It failed ${failures} times. Think differently.\n` +
    `Read agentlog.md to understand what went wrong. Set conservative goals.\n\n---\n`;
  try { appendFileSync(config.memoryFile, note, "utf-8"); } catch {}

  const goals =
    `# AutoAgent Goals — Iteration ${state.iteration} (RECOVERY)\n\n` +
    `You hit ${failures} consecutive failures. Previous error: ${state.lastFailureReason}\n\n` +
    `## Goals\n\n` +
    `1. **Read agentlog.md and memory.md.** Understand what failed and why.\n` +
    `2. **Think from first principles** (use think tool). Why did it fail? What's different about a correct approach?\n` +
    `3. **Make a minimal safe change** or just stabilize with good notes.\n` +
    `4. **Verify** with \`npx tsc --noEmit\`.\n` +
    `5. **Write memory and restart.** \`echo "AUTOAGENT_RESTART"\`\n`;
  try { writeFileSync(config.goalsFile, goals, "utf-8"); } catch {}

  state.lastSuccessfulIteration = state.iteration - 1;
  state.lastFailedCommit = null;
  state.lastFailureReason = null;
  state.iteration++;
  saveState(state);

  config.log(state.iteration, "Cooldown 10s...");
  await new Promise((r) => setTimeout(r, 10_000));
  config.restart();
}

// ─── Per-iteration failure handling ─────────────────────────

/**
 * Called when a single iteration fails. Records the failure, rolls back,
 * updates state, and restarts.
 */
export async function handleIterationFailure(
  state: IterationState,
  error: unknown,
  config: ResuscitationConfig,
): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  config.log(state.iteration, `ITERATION FAILED: ${reason}`);

  const shaResult = await executeBash("git rev-parse HEAD 2>/dev/null", 120, undefined, true);
  const failedSha = shaResult.output.trim();

  await rollbackToPreIteration(state.iteration);
  config.log(state.iteration, `Rolled back to pre-iteration-${state.iteration}`);

  state.lastFailedCommit = failedSha;
  state.lastFailureReason = reason;
  state.iteration++;
  saveState(state);

  const entry = `\n## Iteration ${state.iteration - 1} — FAILED (${new Date().toISOString()})\n\n- **Error**: ${reason}\n- **Rolled back**\n\n---\n`;
  try { appendFileSync(config.memoryFile, entry, "utf-8"); } catch {}

  config.log(state.iteration, "Failure recorded. Restarting...");
  config.restart();
}
