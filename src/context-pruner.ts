/**
 * Scored context pruner — replaces the blunt legacy compaction with a
 * score-based approach that prioritises large, old, re-fetchable tool results.
 */

/** Tools whose results can safely be re-fetched (no side-effects). */
const REFETCHABLE_TOOLS = new Set([
  "read_file",
  "grep",
  "list_files",
  "web_search",
  "web_fetch",
  "tree_sitter_map",
]);

export interface ToolResultMeta {
  /** Index of the user message that contains this tool_result block. */
  msgIndex: number;
  /** Index of the block within msg.content[]. */
  blockIndex: number;
  /** ID of the tool_use call that produced this result. */
  toolUseId: string;
  /** Name of the tool that produced this result. */
  toolName: string;
  /** Number of assistant turns since this result appeared. */
  age: number;
  /** Character length of the result content. */
  size: number;
  /** Whether the result can be safely re-fetched. */
  refetchable: boolean;
  /** Computed prune score — higher = more pruneable. */
  score: number;
}

/**
 * Compute a prune score for a single tool result.
 * score = age * 10 + (size / 500) + (refetchable ? 50 : 0)
 * Higher score → better candidate for pruning.
 */
export function scoreToolResult(
  age: number,
  size: number,
  refetchable: boolean,
): number {
  return age * 10 + size / 500 + (refetchable ? 50 : 0);
}

type ApiMessage = {
  role: string;
  content: unknown;
};

type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
};

type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: Array<{ type: string; text?: string }> | string;
};

function getContentSize(
  content: Array<{ type: string; text?: string }> | string,
): number {
  if (typeof content === "string") return content.length;
  return content.reduce((sum, b) => sum + (b.text?.length ?? 0), 0);
}

/**
 * Walk messages and collect metadata for every tool_result block.
 * `currentTurn` is the total number of messages (used to compute age).
 */
function collectToolResults(
  messages: ApiMessage[],
  currentTurn: number,
): ToolResultMeta[] {
  // Build a map from tool_use_id → tool name by scanning all assistant messages.
  const toolNameMap = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const block of msg.content as unknown[]) {
      if (
        typeof block === "object" &&
        block !== null &&
        (block as { type: string }).type === "tool_use"
      ) {
        const tu = block as ToolUseBlock;
        toolNameMap.set(tu.id, tu.name);
      }
    }
  }

  // Find assistant turn indices (oldest first).
  const assistantTurnByMsgIndex: number[] = new Array(messages.length).fill(-1);
  let assistantCount = 0;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "assistant") {
      assistantTurnByMsgIndex[i] = assistantCount++;
    }
  }

  // Total assistant turns seen so far.
  const totalAssistantTurns = assistantCount;

  // For each user message, figure out which assistant turn just preceded it.
  // A tool_result in user message i has "age" = totalAssistantTurns - (last assistant turn before i).
  const results: ToolResultMeta[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;

    // Find the most recent assistant turn that precedes this user message.
    let precedingAssistantTurn = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].role === "assistant") {
        precedingAssistantTurn = assistantTurnByMsgIndex[j] + 1; // 1-indexed turn number
        break;
      }
    }
    const age = totalAssistantTurns - precedingAssistantTurn;

    const blocks = msg.content as unknown[];
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      if (
        typeof block !== "object" ||
        block === null ||
        (block as { type: string }).type !== "tool_result"
      )
        continue;

      const tr = block as ToolResultBlock;
      const toolName = toolNameMap.get(tr.tool_use_id) ?? "unknown";
      const size = getContentSize(tr.content);
      const refetchable = REFETCHABLE_TOOLS.has(toolName);
      const score = scoreToolResult(age, size, refetchable);

      results.push({
        msgIndex: i,
        blockIndex: bi,
        toolUseId: tr.tool_use_id,
        toolName,
        age,
        size,
        refetchable,
        score,
      });
    }
  }

  return results;
}

/**
 * Scored pruning — replaces legacy compaction.
 *
 * @param messages  The mutable apiMessages array (modified in place).
 * @param currentTurn  Total message count (used for age calculation).
 * @param targetTokens  Target token savings (chars ÷ 4 ≈ tokens).
 * @returns Number of characters pruned.
 */
export function scoredPrune(
  messages: ApiMessage[],
  currentTurn: number,
  targetTokens: number,
): number {
  const PROTECT_LAST_N_TURNS = 3;

  const candidates = collectToolResults(messages, currentTurn);

  // Count total assistant turns.
  let totalAssistantTurns = 0;
  for (const m of messages) {
    if (m.role === "assistant") totalAssistantTurns++;
  }

  // Filter out results from the last N assistant turns (protect recent context).
  const pruneable = candidates.filter((r) => r.age > PROTECT_LAST_N_TURNS);

  // Sort by score descending.
  pruneable.sort((a, b) => b.score - a.score);

  let charsSaved = 0;
  const targetChars = targetTokens * 4; // 4 chars ≈ 1 token

  for (const meta of pruneable) {
    if (charsSaved >= targetChars) break;

    const msg = messages[meta.msgIndex];
    if (!Array.isArray(msg.content)) continue;
    const block = (msg.content as unknown[])[meta.blockIndex] as ToolResultBlock;

    // Skip already-pruned blocks.
    const currentSize = getContentSize(block.content);
    if (currentSize < 50) continue; // already tiny

    const placeholder = meta.refetchable
      ? `[Pruned: ${meta.toolName} — ${meta.size} chars, re-fetchable]`
      : `[Pruned: ${meta.toolName} — ${meta.size} chars]`;

    if (Array.isArray(block.content)) {
      block.content = [{ type: "text", text: placeholder }];
    } else {
      block.content = placeholder;
    }

    charsSaved += meta.size - placeholder.length;
  }

  return charsSaved;
}
