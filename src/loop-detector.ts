/**
 * Loop/Stall Detection Circuit Breaker
 *
 * Detects when the agent is stuck in a repetitive loop:
 * 1. Repeated tool calls: same tool + args 3+ times in last 5 rounds
 * 2. Error loops: same error message 3+ consecutive times
 * 3. Oscillation: agent alternating between two states
 */

import type Anthropic from "@anthropic-ai/sdk";

export interface LoopDetectorResult {
  loopDetected: boolean;
  loopType: "repeated-tool" | "error-loop" | "oscillation" | null;
  description: string;
}

/** Extract tool calls from a message */
function getToolCalls(
  msg: Anthropic.MessageParam
): Array<{ name: string; inputKey: string }> {
  if (msg.role !== "assistant") return [];
  const content = Array.isArray(msg.content) ? msg.content : [];
  return content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({
      name: b.name,
      inputKey: JSON.stringify(b.input ?? {}),
    }));
}

/** Extract error texts from tool result messages */
function getErrors(msg: Anthropic.MessageParam): string[] {
  if (msg.role !== "user") return [];
  const content = Array.isArray(msg.content) ? msg.content : [];
  return content
    .filter((b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result")
    .filter((b) => b.is_error === true)
    .map((b) => {
      if (typeof b.content === "string") return b.content;
      if (Array.isArray(b.content)) {
        return b.content
          .filter((c): c is Anthropic.TextBlockParam => c.type === "text")
          .map((c) => c.text)
          .join(" ");
      }
      return "";
    })
    .filter(Boolean);
}

/** Build a fingerprint string for a set of tool calls in a round */
function roundFingerprint(
  msgs: Anthropic.MessageParam[],
  idx: number
): string {
  const calls = getToolCalls(msgs[idx]);
  return calls.map((c) => `${c.name}:${c.inputKey}`).join("|");
}

export function detectLoop(
  messages: Anthropic.MessageParam[]
): LoopDetectorResult {
  const noLoop: LoopDetectorResult = {
    loopDetected: false,
    loopType: null,
    description: "",
  };

  if (messages.length < 3) return noLoop;

  const assistantMsgs = messages.filter((m) => m.role === "assistant");

  // ── 1. Oscillation: alternating between two round fingerprints ─────────────
  // Check oscillation FIRST — it's a more specific pattern than repeated-tool.
  // Look at last 6 assistant messages: if they alternate A B A B A B → oscillation
  if (assistantMsgs.length >= 4) {
    const lastN = assistantMsgs.slice(-6);
    const fingerprints = lastN.map((_, i) =>
      roundFingerprint(
        messages,
        messages.findIndex((m) => m === lastN[i])
      )
    );

    // Need at least 4 fingerprints with tool calls to detect oscillation
    const nonEmpty = fingerprints.filter((f) => f.length > 0);
    if (nonEmpty.length >= 4) {
      let oscillates = true;
      for (let i = 2; i < nonEmpty.length; i++) {
        if (nonEmpty[i] !== nonEmpty[i - 2]) {
          oscillates = false;
          break;
        }
      }
      // Also check that the two alternating states are actually different
      if (oscillates && nonEmpty[0] !== nonEmpty[1]) {
        return {
          loopDetected: true,
          loopType: "oscillation",
          description: `Agent is oscillating between two states repeatedly (${nonEmpty.length} rounds)`,
        };
      }
    }
  }

  // ── 2. Error loops: same error 3+ consecutive times ───────────────────────
  // Walk through user messages (tool results) looking for consecutive errors
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length >= 3) {
    const recentUser = userMsgs.slice(-6);
    let consecutiveErrorKey = "";
    let consecutiveCount = 0;
    let maxKey = "";
    let maxCount = 0;

    for (const msg of recentUser) {
      const errors = getErrors(msg);
      if (errors.length > 0) {
        const normalized = errors[0].trim().slice(0, 200);
        if (normalized === consecutiveErrorKey) {
          consecutiveCount++;
        } else {
          consecutiveErrorKey = normalized;
          consecutiveCount = 1;
        }
        if (consecutiveCount > maxCount) {
          maxCount = consecutiveCount;
          maxKey = normalized;
        }
      } else {
        consecutiveErrorKey = "";
        consecutiveCount = 0;
      }
    }

    if (maxCount >= 3) {
      return {
        loopDetected: true,
        loopType: "error-loop",
        description: `Same error repeated ${maxCount} consecutive times: "${maxKey.slice(0, 80)}..."`,
      };
    }
  }

  // ── 3. Repeated identical tool calls ──────────────────────────────────────
  // Look at the last 5 assistant messages and count identical tool+args combos
  const recent = assistantMsgs.slice(-5);

  const callCounts = new Map<string, number>();
  for (const msg of recent) {
    for (const call of getToolCalls(msg)) {
      const key = `${call.name}:${call.inputKey}`;
      callCounts.set(key, (callCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, count] of callCounts) {
    if (count >= 3) {
      const toolName = key.split(":")[0];
      return {
        loopDetected: true,
        loopType: "repeated-tool",
        description: `Tool "${toolName}" called with identical arguments ${count} times in the last ${recent.length} rounds`,
      };
    }
  }

  return noLoop;
}
