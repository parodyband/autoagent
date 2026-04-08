/**
 * Token Estimator
 *
 * Fast heuristic-based token estimation for context window management.
 * Uses chars/4 baseline with a 1.2x multiplier for code-heavy text.
 */

/**
 * Estimates token count for a plain text string.
 * - Baseline: chars / 4
 * - Code multiplier: 1.2x if >30% of characters are non-alpha (punctuation, symbols, digits)
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;

  const nonAlpha = (text.match(/[^a-zA-Z\s]/g) ?? []).length;
  const ratio = nonAlpha / text.length;
  const multiplier = ratio > 0.3 ? 1.2 : 1.0;

  return Math.ceil((text.length / 4) * multiplier);
}

type MessageContent = string | Array<{ type: string; text?: string; [key: string]: unknown }>;

interface Message {
  role: string;
  content: MessageContent;
}

/**
 * Extracts the text from a message content field (string or block array).
 */
function extractText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => (block.type === "text" && block.text ? block.text : ""))
    .join("");
}

/**
 * Estimates total token count for an array of messages.
 * Adds 4 tokens overhead per message for role/structure tokens.
 */
export function estimateMessageTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    const text = extractText(msg.content);
    total += estimateTokens(text) + 4; // 4 tokens overhead per message
  }
  return total;
}

/**
 * Returns true if estimated token usage exceeds threshold * maxTokens.
 *
 * @param messages   Conversation messages
 * @param maxTokens  Context window size (e.g. 200000 for Claude)
 * @param threshold  Fraction of maxTokens that triggers compaction (default 0.8)
 */
export function shouldCompact(
  messages: Message[],
  maxTokens: number,
  threshold = 0.8
): boolean {
  const estimated = estimateMessageTokens(messages);
  return estimated > threshold * maxTokens;
}
