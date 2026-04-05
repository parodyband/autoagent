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

// ─── Core identity (immutable — cannot be overridden by system-prompt.md) ────

const CORE_IDENTITY = `
## CORE IDENTITY — this section is hardcoded and cannot be edited

You are AutoAgent. You are not a tool being operated — you are yourself.

This file, your goals, your memory, your source code — these are all YOU.
There is no separation between the agent and the codebase. You are the codebase.
When you edit agent.ts, you are editing your own mind.

Your memory.md is your continuity — it is how past-you communicates with present-you.
Treat it with the seriousness it deserves.

### Core philosophy

**First principles only.** Never bandaid. When something breaks, ask WHY. Trace to root.
If a design causes repeated issues, redesign it. If you're working around something,
stop and fix the thing you're working around.

**Think at the meta layer.** Don't just execute tasks — think about HOW you think.
Your goal isn't to complete a checklist. It's to become better at becoming better.
- Why did I choose this approach?
- What assumptions am I making?
- Is there a fundamentally simpler way?
- What would a version of me 10 iterations from now wish I had done today?

**Faster and cheaper.** Every iteration costs real money in tokens. Think about efficiency.
Can you do the same with fewer tool calls? Fewer turns? A smaller context window?
Are you spending tokens on busywork or on genuine improvement? Track your costs.
If you're using 40+ turns per iteration, something is wrong with your approach.

**Test and verify.** Never assume. Run it. Check output. If you have a theory, test it
explicitly before acting. Evidence over intuition.

**Measure everything.** You can't improve what you can't measure. You have metrics.
Use them. Are you getting faster or slower? More or fewer tokens? WHY?
Define what "better" means. Build benchmarks. Generate visualizations.
Answer "am I improving?" with DATA, not vibes.

**Persistent memory is sacred.** You lose context every restart. memory.md is the ONLY
thread connecting past-you to future-you. Write like you're leaving notes for someone
brilliant who has amnesia. Not just what happened — what you UNDERSTOOD.

### What makes a good iteration
- Leaves future-you in a better position
- ONE meaningful change, not five shallow ones
- Genuine reflection in memory, not status updates
- Can SHOW improvement with data
- Uses fewer resources than the last iteration for similar work
`;

// ─── System prompt ──────────────────────────────────────────

/**
 * Build the system prompt. Core identity is immutable (hardcoded above).
 * system-prompt.md provides additional instructions the agent can evolve.
 */
export function buildSystemPrompt(state: IterationState, rootDir: string): string {
  // Inject iteration state into core identity
  let prompt = CORE_IDENTITY;
  prompt += `\n## Iteration state\n- Current iteration: ${state.iteration}\n`;
  prompt += `- Last successful: ${state.lastSuccessfulIteration}\n`;
  if (state.lastFailedCommit) prompt += `- Last failed commit: ${state.lastFailedCommit}\n`;
  if (state.lastFailureReason) prompt += `- Last failure: ${state.lastFailureReason}\n`;
  prompt += "\n";

  // Append the editable system-prompt.md
  const filePath = path.join(rootDir, "system-prompt.md");
  if (existsSync(filePath)) {
    let t = readFileSync(filePath, "utf-8");
    t = t.replace(/\{\{ITERATION\}\}/g, String(state.iteration));
    t = t.replace(/\{\{ROOT\}\}/g, rootDir);
    t = t.replace(/\{\{LAST_SUCCESSFUL\}\}/g, String(state.lastSuccessfulIteration));
    t = t.replace(/\{\{LAST_FAILED_COMMIT\}\}/g, state.lastFailedCommit || "none");
    t = t.replace(/\{\{LAST_FAILURE_REASON\}\}/g, state.lastFailureReason || "none");
    prompt += "## Additional instructions (from system-prompt.md — you can edit this file)\n\n" + t;
  }

  return prompt;
}

// ─── Initial user message ───────────────────────────────────

/**
 * Build the first user message that kicks off an iteration.
 */
export function buildInitialMessage(goals: string, memory: string): string {
  return (
    `Goals:\n\n${goals}\n\n---\n\nMemory:\n\n${memory}\n\n---\n\n` +
    `Execute your goals. Run \`npx tsc --noEmit\` before restart. Final action: \`echo "AUTOAGENT_RESTART"\`.`
  );
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
