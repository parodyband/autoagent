/**
 * Context-window management — conversation truncation for long tasks.
 *
 * When the agent runs many turns, the conversation grows unbounded.
 * Past ~50 turns, token bloat degrades response quality and increases cost.
 *
 * This module provides:
 * - `shouldTruncate(messages, tokenEstimate?)` — check if truncation is needed
 * - `summarizeOldTurns(messages, keepRecent)` — replace old turns with a summary
 */

import { executeSubagent } from "./tools/subagent.js";

// ─── Types ──────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── Constants ──────────────────────────────────────────────

/** Estimated chars per token (rough approximation) */
const CHARS_PER_TOKEN = 4;

/** Token threshold above which we recommend truncation */
const TOKEN_THRESHOLD = 80_000;

/** Message count threshold above which we recommend truncation */
const MESSAGE_THRESHOLD = 40;

/** Default number of recent messages to keep verbatim */
const DEFAULT_KEEP_RECENT = 10;

// ─── Public API ─────────────────────────────────────────────

/**
 * Returns true if the conversation should be truncated.
 *
 * Triggers when:
 * - Estimated token count > 80,000 (rough: 4 chars = 1 token), OR
 * - messages.length > 40
 *
 * @param messages  The current conversation messages
 * @param tokenEstimate  Optional pre-computed token estimate (overrides char-based heuristic)
 */
export function shouldTruncate(
  messages: Message[],
  tokenEstimate?: number,
): boolean {
  if (messages.length > MESSAGE_THRESHOLD) return true;

  const tokens =
    tokenEstimate !== undefined
      ? tokenEstimate
      : estimateTokens(messages);

  return tokens > TOKEN_THRESHOLD;
}

/**
 * Summarize old turns in the conversation, keeping only the most recent ones
 * verbatim. Older turns are condensed into a single system message by a
 * fast sub-agent.
 *
 * If `messages.length <= keepRecent`, the array is returned unchanged.
 *
 * The inserted summary message has role `"system"` and begins with
 * `"[Conversation summary — turns 1-N]"`.
 *
 * @param messages    Full conversation message array
 * @param keepRecent  How many recent messages to preserve verbatim (default 10)
 */
export async function summarizeOldTurns(
  messages: Message[],
  keepRecent: number = DEFAULT_KEEP_RECENT,
): Promise<Message[]> {
  if (messages.length <= keepRecent) return messages;

  const oldMessages = messages.slice(0, messages.length - keepRecent);
  const recentMessages = messages.slice(messages.length - keepRecent);
  const oldCount = oldMessages.length;

  const prompt = buildSummaryPrompt(oldMessages);
  const result = await executeSubagent(prompt, "fast", 512);

  const summaryText = result.response.trim();

  const summaryMessage: Message = {
    role: "system",
    content: `[Conversation summary — turns 1-${oldCount}]\n\n${summaryText}`,
  };

  return [summaryMessage, ...recentMessages];
}

// ─── Internal helpers ────────────────────────────────────────

/**
 * Build the prompt sent to the sub-agent for summarization.
 * Explicitly asks it to preserve files modified, commands run,
 * errors encountered, and current task state.
 */
function buildSummaryPrompt(messages: Message[]): string {
  const conversationText = messages
    .map((m, i) => `[${i + 1}] ${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `You are summarizing a conversation between an AI agent and its tools.
Produce a concise summary (≤200 words) that preserves ALL of the following:
1. Files that were CREATED or MODIFIED (exact paths)
2. Commands that were RUN (key bash commands)
3. Errors or failures encountered
4. Current task state — what has been completed, what is still pending

Conversation to summarize:
${conversationText}

Write only the summary. No preamble, no explanation.`;
}

/**
 * Estimate total tokens in a message array using 4 chars ≈ 1 token heuristic.
 */
function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}
