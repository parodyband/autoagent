/**
 * Tests for priority-based context pruning in Orchestrator.
 *
 * We test pruneStaleToolResults() directly by constructing an Orchestrator
 * with pre-populated apiMessages and sessionTokensIn above the threshold.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Orchestrator } from "../src/orchestrator.js";

// Helper: build a tool_use block for an assistant message
function toolUse(id: string, name: string, input: Record<string, unknown> = {}) {
  return { type: "tool_use" as const, id, name, input };
}

// Helper: build a tool_result block for a user message
function toolResult(tool_use_id: string, text: string) {
  return {
    type: "tool_result" as const,
    tool_use_id,
    content: [{ type: "text" as const, text }],
  };
}

// Build a pair of messages (assistant tool_use + user tool_result)
function toolPair(id: string, toolName: string, resultText: string) {
  return {
    assistantMsg: { role: "assistant" as const, content: [toolUse(id, toolName)] },
    userMsg: { role: "user" as const, content: [toolResult(id, resultText)] },
  };
}

/**
 * Build an Orchestrator with controlled message history.
 * Returns the orchestrator and exposes its private apiMessages array via casting.
 */
function buildOrchestrator(messages: Array<{ role: string; content: unknown }>, tokenCount: number) {
  const orc = new Orchestrator({ apiKey: "test-key" });
  // Inject messages directly
  (orc as unknown as { apiMessages: unknown[] }).apiMessages = messages;
  // Set token count above threshold
  (orc as unknown as { sessionTokensIn: number }).sessionTokensIn = tokenCount;
  return orc;
}

// Make a long string (>100 chars) to pass the skip-short-text filter
const LONG_TEXT = "x".repeat(200);

describe("pruneStaleToolResults", () => {
  /**
   * Build 10 pairs of (assistant + user) messages so the first pairs fall
   * outside the last-8-assistant-turns window.
   */
  function buildMessageSet(overrides?: {
    tool0Name?: string;
    tool0Text?: string;
    tool1Name?: string;
    tool1Text?: string;
  }) {
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [];

    // Turn 0: read_file (candidate for early pruning)
    const p0 = toolPair("id-rf", overrides?.tool0Name ?? "read_file", overrides?.tool0Text ?? LONG_TEXT);
    messages.push(p0.assistantMsg, p0.userMsg);

    // Turn 1: bash (high value — prune last)
    const p1 = toolPair("id-bash", overrides?.tool1Name ?? "bash", overrides?.tool1Text ?? LONG_TEXT);
    messages.push(p1.assistantMsg, p1.userMsg);

    // Turns 2–9: plain assistant/user messages to fill the "last 8" window
    for (let i = 2; i <= 9; i++) {
      messages.push(
        { role: "assistant", content: [{ type: "text", text: `turn ${i}` }] },
        { role: "user", content: [{ type: "text", text: `user ${i}` }] },
      );
    }

    return messages;
  }

  it("prunes read_file results before bash results (priority ordering)", () => {
    const messages = buildMessageSet();
    const orc = buildOrchestrator(messages, 85_000);

    (orc as unknown as { pruneStaleToolResults: () => void }).pruneStaleToolResults();

    // read_file result (turn 0) should be pruned
    const rfResult = (messages[1].content as ReturnType<typeof toolResult>[])[0];
    expect(rfResult.content[0].text).toMatch(/\[pruned/);

    // bash result (turn 0 as well, but priority 2) should also be pruned
    const bashResult = (messages[3].content as ReturnType<typeof toolResult>[])[0];
    expect(bashResult.content[0].text).toMatch(/\[pruned/);
  });

  it("never prunes tool results containing error indicators", () => {
    const errorText = "Error: compilation failed — unexpected token\n" + "x".repeat(200);
    const messages = buildMessageSet({ tool0Text: errorText });
    const orc = buildOrchestrator(messages, 85_000);

    (orc as unknown as { pruneStaleToolResults: () => void }).pruneStaleToolResults();

    // The error-containing result must NOT be pruned
    const rfResult = (messages[1].content as ReturnType<typeof toolResult>[])[0];
    expect(rfResult.content[0].text).toBe(errorText);
  });

  it("fires at 80K tokens (MICRO_COMPACT_THRESHOLD), not just 120K", () => {
    const messages = buildMessageSet();
    const orc = buildOrchestrator(messages, 80_001);

    (orc as unknown as { pruneStaleToolResults: () => void }).pruneStaleToolResults();

    const rfResult = (messages[1].content as ReturnType<typeof toolResult>[])[0];
    expect(rfResult.content[0].text).toMatch(/\[pruned/);
  });

  it("preserves the last 8 assistant turns untouched", () => {
    // Build messages where ALL tool pairs are inside the last-8 window
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [];

    // 8 tool pairs (all within the fresh window)
    for (let i = 0; i < 8; i++) {
      const p = toolPair(`id-rf-${i}`, "read_file", LONG_TEXT);
      messages.push(p.assistantMsg, p.userMsg);
    }

    const orc = buildOrchestrator(messages, 85_000);
    (orc as unknown as { pruneStaleToolResults: () => void }).pruneStaleToolResults();

    // None should be pruned — all are in the last 8 turns
    for (let i = 0; i < 8; i++) {
      const resultMsg = messages[i * 2 + 1] as { role: "user"; content: ReturnType<typeof toolResult>[] };
      expect(resultMsg.content[0].content[0].text).toBe(LONG_TEXT);
    }
  });

  it("handles empty tool result content arrays gracefully", () => {
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
      { role: "assistant", content: [toolUse("id-empty", "grep")] },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "id-empty", content: [] }],
      },
      // Pad with 8 more assistant turns to push the pair outside the window
      ...Array.from({ length: 8 }, (_, i) => [
        { role: "assistant" as const, content: [{ type: "text", text: `turn ${i}` }] },
        { role: "user" as const, content: [{ type: "text", text: `reply ${i}` }] },
      ]).flat(),
    ];

    const orc = buildOrchestrator(messages, 85_000);
    // Should not throw
    expect(() => {
      (orc as unknown as { pruneStaleToolResults: () => void }).pruneStaleToolResults();
    }).not.toThrow();
  });

  it("shouldPruneStaleTool returns true at 80K tokens", () => {
    const orc = buildOrchestrator([], 80_001);
    const result = (orc as unknown as { shouldPruneStaleTool: () => boolean }).shouldPruneStaleTool();
    expect(result).toBe(true);
  });

  it("shouldPruneStaleTool returns false below 80K tokens", () => {
    const orc = buildOrchestrator([], 79_999);
    const result = (orc as unknown as { shouldPruneStaleTool: () => boolean }).shouldPruneStaleTool();
    expect(result).toBe(false);
  });
});
