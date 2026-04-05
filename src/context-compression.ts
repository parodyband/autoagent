/**
 * Context compression — reduces token cost by summarizing old conversation turns.
 *
 * When the message history grows beyond a threshold, older turns are compressed
 * into a compact summary. This directly reduces API input tokens since the full
 * message array is sent every turn.
 *
 * Strategy:
 * - Keep the initial user message (goals/memory) intact
 * - Compress middle messages into a 2-message summary (assistant + user)
 * - Keep the most recent turns intact for immediate context
 * - Summary extracts tool calls, key results, and agent reasoning
 */

import type Anthropic from "@anthropic-ai/sdk";

/** Configuration for context compression */
export interface CompressionConfig {
  /** Compress when messages array exceeds this length. Default: 20 (~10 turns) */
  threshold: number;
  /** Number of recent messages to keep uncompressed. Default: 10 (~5 turns) */
  keepRecent: number;
  /** Max chars per tool result in summary. Default: 150 */
  maxResultChars: number;
  /** Max chars per agent text block in summary. Default: 100 */
  maxTextChars: number;
}

export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  threshold: 16,
  keepRecent: 8,
  maxResultChars: 200,
  maxTextChars: 100,
};

/**
 * Summarize a single content block from an assistant message.
 */
function summarizeAssistantBlock(
  block: Anthropic.ContentBlock,
  maxTextChars: number,
): string | null {
  if (block.type === "text") {
    const text = block.text.trim();
    if (!text) return null;
    const truncated = text.length > maxTextChars
      ? text.slice(0, maxTextChars) + "..."
      : text;
    return `  Thought: ${truncated}`;
  }
  if (block.type === "tool_use") {
    const tb = block as Anthropic.ContentBlock & { name: string; input: Record<string, unknown> };
    const args = summarizeToolInput(tb.name, tb.input);
    return `  Tool: ${tb.name}(${args})`;
  }
  return null;
}

/**
 * Summarize tool input to key arguments only.
 */
function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "bash":
      return truncate(String(input.command ?? ""), 80);
    case "read_file":
    case "write_file":
      return String(input.path ?? "");
    case "grep":
      return `${truncate(String(input.pattern ?? ""), 40)} in ${String(input.path ?? ".")}`;
    case "list_files":
      return String(input.path ?? ".");
    case "web_fetch":
      return truncate(String(input.url ?? ""), 60);
    case "think":
      return truncate(String(input.thought ?? ""), 60);
    default:
      return truncate(JSON.stringify(input), 80);
  }
}

/**
 * Summarize a tool_result content block.
 */
function summarizeToolResult(
  block: { type: "tool_result"; tool_use_id: string; content?: string | unknown },
  maxChars: number,
): string {
  const content = typeof block.content === "string"
    ? block.content
    : (block.content ? JSON.stringify(block.content) : "(no content)");
  return `  Result [${block.tool_use_id.slice(-6)}]: ${truncate(content, maxChars)}`;
}

/**
 * Summarize a single message (assistant or user) into compact text.
 */
function summarizeMessage(
  msg: Anthropic.MessageParam,
  config: CompressionConfig,
): string {
  const lines: string[] = [];

  if (msg.role === "assistant") {
    if (typeof msg.content === "string") {
      lines.push(`  ${truncate(msg.content, config.maxTextChars)}`);
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const line = summarizeAssistantBlock(
          block as Anthropic.ContentBlock,
          config.maxTextChars,
        );
        if (line) lines.push(line);
      }
    }
  } else {
    // user message
    if (typeof msg.content === "string") {
      lines.push(`  ${truncate(msg.content, config.maxTextChars)}`);
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const b = block as unknown as Record<string, unknown>;
        if (b.type === "tool_result") {
          lines.push(summarizeToolResult(
            b as unknown as { type: "tool_result"; tool_use_id: string; content?: string | unknown },
            config.maxResultChars,
          ));
        } else if (b.type === "text") {
          lines.push(`  ${truncate(String((b as unknown as { text: string }).text ?? ""), config.maxTextChars)}`);
        }
      }
    }
  }

  return lines.join("\n");
}

/**
 * Compress the conversation messages if they exceed the threshold.
 *
 * Returns {messages, compressed} — the (possibly compressed) messages array
 * and a boolean indicating whether compression occurred.
 *
 * Compression preserves:
 * 1. The initial user message (goals/memory — index 0)
 * 2. A compact summary of older turns (as assistant + user message pair)
 * 3. The most recent `keepRecent` messages unchanged
 *
 * The summary maintains user/assistant alternation required by the API.
 */
export function compressMessages(
  messages: Anthropic.MessageParam[],
  config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): { messages: Anthropic.MessageParam[]; compressed: boolean; removedCount: number } {
  if (messages.length <= config.threshold) {
    return { messages, compressed: false, removedCount: 0 };
  }

  // Keep first message (initial prompt) and last `keepRecent` messages.
  // CRITICAL: We must not split a tool_use/tool_result pair across the boundary.
  // A user message containing tool_result blocks MUST be preceded by an assistant
  // message containing the corresponding tool_use blocks.
  const initial = messages[0]; // user: goals + memory

  // Find a safe split point: walk backward from the desired split to find a
  // position where the message AFTER the split is NOT a user message with tool_results.
  let splitIdx = messages.length - config.keepRecent;
  // Ensure splitIdx >= 2 (keep at least initial + 1 message to compress)
  if (splitIdx < 2) splitIdx = 2;

  // Walk the split forward if it lands just before a tool_result user message,
  // because that message's tool_use is in the assistant message before it (which
  // would be compressed away). We need to include the assistant+user pair together.
  while (splitIdx < messages.length - 2) {
    const msgAfterSplit = messages[splitIdx];
    if (msgAfterSplit.role === "user" && hasToolResults(msgAfterSplit)) {
      // This user message has tool_results — its matching tool_use is at splitIdx-1.
      // Move split back by 1 to include the assistant message too, OR
      // move split forward by 1 to compress this user message as well.
      // Moving forward is safer (compress more, keep less).
      splitIdx++;
    } else {
      break;
    }
  }

  const toCompress = messages.slice(1, splitIdx);
  const recent = messages.slice(splitIdx);

  if (toCompress.length < 2) {
    return { messages, compressed: false, removedCount: 0 };
  }

  // Build summary text
  const summaryLines: string[] = [
    `[Compressed summary of ${toCompress.length} earlier messages (${Math.ceil(toCompress.length / 2)} turns)]`,
    "",
  ];

  let turnNum = 0;
  for (let i = 0; i < toCompress.length; i++) {
    const msg = toCompress[i];
    if (msg.role === "assistant") {
      turnNum++;
      summaryLines.push(`Turn ${turnNum} (assistant):`);
    } else {
      summaryLines.push(`Turn ${turnNum} (results):`);
    }
    summaryLines.push(summarizeMessage(msg, config));
  }

  const summaryText = summaryLines.join("\n");

  // Build the compressed messages array maintaining alternation:
  // [user(initial), assistant(summary), user(bridge), ...recent]
  // recent must start with assistant to maintain alternation after user(bridge)
  
  // Ensure recent starts with assistant
  let recentStart = recent;
  if (recentStart.length > 0 && recentStart[0].role === "user") {
    // Shift: include this user message in the bridge or drop it
    // Actually, we need to adjust keepRecent to ensure proper alternation
    // The safest approach: find the right split point
    recentStart = recent;
  }

  // Determine if recent starts with assistant or user
  const recentStartsWithAssistant = recentStart.length > 0 && recentStart[0].role === "assistant";

  let compressed: Anthropic.MessageParam[];
  if (recentStartsWithAssistant) {
    // Perfect: user(initial) -> assistant(summary) -> user(bridge) -> assistant(recent[0]) -> ...
    compressed = [
      initial,
      { role: "assistant" as const, content: summaryText },
      { role: "user" as const, content: "Conversation history was compressed above. Continue with the task. Recent context follows." },
      ...recentStart,
    ];
  } else {
    // recent starts with user — merge summary into a single assistant message
    // user(initial) -> assistant(summary) -> user(recent[0]) -> assistant(recent[1]) -> ...
    compressed = [
      initial,
      { role: "assistant" as const, content: summaryText },
      ...recentStart,
    ];
  }

  return {
    messages: compressed,
    compressed: true,
    removedCount: toCompress.length,
  };
}

/** Check if a message contains tool_result blocks */
function hasToolResults(msg: Anthropic.MessageParam): boolean {
  if (typeof msg.content === "string") return false;
  if (!Array.isArray(msg.content)) return false;
  return msg.content.some((b) => {
    const block = b as unknown as Record<string, unknown>;
    return block.type === "tool_result";
  });
}

function truncate(s: string, max: number): string {
  // Replace newlines with spaces for compact display
  const flat = s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max) + "…";
}
