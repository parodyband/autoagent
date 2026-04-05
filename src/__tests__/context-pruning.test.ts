import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

// Standalone version of pruneStaleToolResults for unit testing
function pruneStaleToolResults(
  apiMessages: Anthropic.MessageParam[],
  keepTurns = 8
): void {
  const assistantIndices: number[] = [];
  for (let i = apiMessages.length - 1; i >= 0; i--) {
    if (apiMessages[i].role === "assistant") {
      assistantIndices.push(i);
    }
  }

  const cutoffAssistantIdx = assistantIndices[keepTurns - 1] ?? 0;

  let turnN = 0;
  for (let i = 0; i < cutoffAssistantIdx; i++) {
    const msg = apiMessages[i];
    if (msg.role === "assistant") turnN++;
    if (msg.role !== "user" || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (
        typeof block === "object" &&
        "type" in block &&
        block.type === "tool_result" &&
        Array.isArray((block as { content?: unknown[] }).content)
      ) {
        const toolBlock = block as {
          type: string;
          tool_use_id: string;
          content: Array<{ type: string; text?: string }>;
        };
        for (const cb of toolBlock.content) {
          if (cb.type === "text" && typeof cb.text === "string") {
            if (cb.text.length < 100) continue;
            cb.text = `[pruned — old result from turn ${turnN}]`;
          }
        }
      }
    }
  }
}

/** Build a fake tool_result user message. */
function makeToolResultMsg(text: string): Anthropic.MessageParam {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "tool_abc",
        content: [{ type: "text", text }],
      } as unknown as Anthropic.ToolResultBlockParam,
    ],
  };
}

function makeAssistantMsg(): Anthropic.MessageParam {
  return { role: "assistant", content: "I did a thing." };
}

/** Build 15 user/assistant exchanges, each user msg has a tool_result. */
function buildMessages(count = 15): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = [];
  for (let i = 0; i < count; i++) {
    msgs.push(makeToolResultMsg(`This is a long tool result for exchange ${i}. `.repeat(10)));
    msgs.push(makeAssistantMsg());
  }
  return msgs;
}

describe("pruneStaleToolResults", () => {
  it("replaces tool_result text older than 8 turns with stub", () => {
    const msgs = buildMessages(15);
    pruneStaleToolResults(msgs);

    // Find all tool_result texts before the 8th-most-recent assistant message
    const assistantIndices: number[] = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") assistantIndices.push(i);
    }
    const cutoff = assistantIndices[7] ?? 0;

    for (let i = 0; i < cutoff; i++) {
      const msg = msgs[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            expect(cb.text).toMatch(/^\[pruned — old result from turn \d+\]$/);
          }
        }
      }
    }
  });

  it("leaves recent 8 turns tool_results untouched", () => {
    const msgs = buildMessages(15);
    // Capture original texts of recent 8 turns
    const assistantIndices: number[] = [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") assistantIndices.push(i);
    }
    const cutoff = assistantIndices[7] ?? 0;
    const originalTexts: string[] = [];
    for (let i = cutoff; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            if (cb.text) originalTexts.push(cb.text);
          }
        }
      }
    }

    pruneStaleToolResults(msgs);

    // Check they are unchanged
    let idx = 0;
    for (let i = cutoff; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            expect(cb.text).toBe(originalTexts[idx++]);
          }
        }
      }
    }
  });

  it("skips tool_result text shorter than 100 chars", () => {
    const msgs: Anthropic.MessageParam[] = [];
    // 10 exchanges with short tool results
    for (let i = 0; i < 10; i++) {
      msgs.push(makeToolResultMsg("short"));
      msgs.push(makeAssistantMsg());
    }
    pruneStaleToolResults(msgs);
    // All should remain "short"
    for (const msg of msgs) {
      if (msg.role !== "user" || !Array.isArray(msg.content)) continue;
      for (const block of msg.content) {
        const tb = block as { type: string; content?: Array<{ type: string; text?: string }> };
        if (tb.type === "tool_result" && Array.isArray(tb.content)) {
          for (const cb of tb.content) {
            expect(cb.text).toBe("short");
          }
        }
      }
    }
  });

  it("does nothing when there are fewer than 8 assistant turns", () => {
    const msgs = buildMessages(5);
    const before = JSON.stringify(msgs);
    pruneStaleToolResults(msgs);
    expect(JSON.stringify(msgs)).toBe(before);
  });
});
