/**
 * Central model configuration — reads from env vars with sensible defaults.
 *
 *   MODEL_OPUS   – used for architect/meta experts
 *   MODEL_SONNET – used for main agent loop, engineer expert
 *   MODEL_HAIKU  – used for lightweight tasks (dream, planning, init, subagent)
 */

export const MODEL_OPUS   = process.env.MODEL_OPUS   ?? "claude-opus-4-6";
export const MODEL_SONNET = process.env.MODEL_SONNET  ?? "claude-sonnet-4-6";
export const MODEL_HAIKU  = process.env.MODEL_HAIKU   ?? "claude-haiku-4-5";

/** Shorthand alias map for /model and --model commands. */
export const MODEL_ALIASES: Record<string, string> = {
  haiku:  MODEL_HAIKU,
  sonnet: MODEL_SONNET,
  opus:   MODEL_OPUS,
};
