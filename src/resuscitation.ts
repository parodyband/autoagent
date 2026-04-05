/**
 * Resuscitation — circuit breaker and failure recovery.
 *
 * When the agent hits consecutive failures, this module:
 * 1. Detects the failure streak via countConsecutiveFailures()
 * 2. Rolls back to last known-good state
 * 3. Writes recovery notes to memory + goals
 * 4. Bumps iteration and restarts
 *
 * For single-iteration failures, handleIterationFailure() captures the
 * error, rolls back, records state, and restarts.
 */

import { appendFileSync, writeFileSync } from "fs";
import { executeBash } from "./tools/bash.js";
import {
  saveState,
  rollbackToPreIteration,
  type IterationState,
} from "./iteration.js";

// ─── Configuration ──────────────────────────────────────────

export interface ResuscitationConfig {
  memoryFile: string;
  goalsFile: string;
  log: (iter: number, msg: string) => void;
  restart: () => never;
}

// ─── Failure detection ──────────────────────────────────────

/**
 * Count how many iterations have failed since the last success.
 */
export function countConsecutiveFailures(state: IterationState): number {
  if (state.lastSuccessfulIteration < 0) return state.iteration;
  return state.iteration - state.lastSuccessfulIteration - 1;
}

// ─── Circuit breaker ────────────────────────────────────────

/**
 * Full resuscitation: roll back to last good state, write recovery
 * notes, bump iteration, cooldown, restart.
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

// ─── Single-failure handling ────────────────────────────────

/**
 * Handle a single iteration failure: capture error, rollback,
 * record state, append to memory, restart.
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
