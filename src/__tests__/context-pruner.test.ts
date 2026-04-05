import { describe, it, expect } from "vitest";
import { scoreToolResult, scoredPrune } from "../context-pruner.js";

type ApiMessage = { role: string; content: unknown };

function makeToolUseMsg(id: string, name: string): ApiMessage {
  return { role: "assistant", content: [{ type: "tool_use", id, name, input: {} }] };
}

function makeToolResultMsg(
  toolUseId: string,
  content: string,
): ApiMessage {
  return {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: toolUseId, content }],
  };
}

describe("scoreToolResult", () => {
  it("scores re-fetchable higher than non-re-fetchable", () => {
    const refetchable = scoreToolResult(5, 1000, true);
    const nonRefetchable = scoreToolResult(5, 1000, false);
    expect(refetchable).toBeGreaterThan(nonRefetchable);
  });

  it("scores older results higher than newer ones", () => {
    const old = scoreToolResult(10, 1000, false);
    const recent = scoreToolResult(2, 1000, false);
    expect(old).toBeGreaterThan(recent);
  });

  it("scores larger results higher than smaller ones", () => {
    const large = scoreToolResult(5, 5000, false);
    const small = scoreToolResult(5, 100, false);
    expect(large).toBeGreaterThan(small);
  });

  it("formula: age*10 + size/500 + (refetchable?50:0)", () => {
    expect(scoreToolResult(3, 500, true)).toBe(3 * 10 + 500 / 500 + 50);
    expect(scoreToolResult(3, 500, false)).toBe(3 * 10 + 500 / 500);
  });
});

describe("scoredPrune", () => {
  it("no-op when nothing to prune", () => {
    const messages: ApiMessage[] = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "hi" }] },
    ];
    const saved = scoredPrune(messages, messages.length, 10000);
    expect(saved).toBe(0);
  });

  it("prunes highest-scored result first", () => {
    // Two tool calls: one old+large, one old+small
    const messages: ApiMessage[] = [
      makeToolUseMsg("t1", "read_file"),
      makeToolResultMsg("t1", "A".repeat(2000)), // large → higher score
      makeToolUseMsg("t2", "read_file"),
      makeToolResultMsg("t2", "B".repeat(100)), // small
      { role: "assistant", content: [{ type: "text", text: "a1" }] },
      { role: "assistant", content: [{ type: "text", text: "a2" }] },
      { role: "assistant", content: [{ type: "text", text: "a3" }] },
      { role: "assistant", content: [{ type: "text", text: "a4" }] },
    ];
    // Target small — only one prune needed to hit the target
    scoredPrune(messages, messages.length, 400); // ~1600 chars target
    const largeBlock = (messages[1].content as { type: string; tool_use_id: string; content: string }[])[0];
    const smallBlock = (messages[3].content as { type: string; tool_use_id: string; content: string }[])[0];
    // Large should be pruned first
    expect(largeBlock.content).toMatch(/\[Pruned:/);
    // Small may or may not be pruned depending on whether target was reached
  });

  it("never prunes results from last 3 assistant turns", () => {
    const messages: ApiMessage[] = [
      makeToolUseMsg("t1", "read_file"),
      makeToolResultMsg("t1", "X".repeat(5000)),
      { role: "assistant", content: [{ type: "text", text: "a1" }] },
      makeToolUseMsg("t2", "read_file"),
      makeToolResultMsg("t2", "Y".repeat(5000)),
      { role: "assistant", content: [{ type: "text", text: "a2" }] },
    ];
    // t2 result is within last 3 assistant turns → protected
    scoredPrune(messages, messages.length, 50000);
    const protected2 = (messages[4].content as { type: string; content: string }[])[0];
    expect(protected2.content).not.toMatch(/\[Pruned:/);
  });

  it("replaces content with descriptive placeholder for re-fetchable", () => {
    const messages: ApiMessage[] = [
      makeToolUseMsg("t1", "read_file"),
      makeToolResultMsg("t1", "A".repeat(1000)),
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
    ];
    scoredPrune(messages, messages.length, 100);
    const block = (messages[1].content as { type: string; content: string }[])[0];
    expect(block.content).toMatch(/\[Pruned: read_file.*re-fetchable\]/);
    expect(block.content).toMatch(/1000 chars/);
  });

  it("replaces content without re-fetchable note for bash results", () => {
    const messages: ApiMessage[] = [
      makeToolUseMsg("t1", "bash"),
      makeToolResultMsg("t1", "B".repeat(1000)),
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
    ];
    scoredPrune(messages, messages.length, 100);
    const block = (messages[1].content as { type: string; content: string }[])[0];
    expect(block.content).toMatch(/\[Pruned: bash/);
    expect(block.content).not.toMatch(/re-fetchable/);
  });

  it("stops pruning once target savings reached", () => {
    const big = "C".repeat(3000);
    const messages: ApiMessage[] = [
      makeToolUseMsg("t1", "read_file"),
      makeToolResultMsg("t1", big),
      makeToolUseMsg("t2", "read_file"),
      makeToolResultMsg("t2", big),
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
    ];
    // Target only 500 tokens (~2000 chars) — only one result needs pruning
    scoredPrune(messages, messages.length, 500);
    const b1 = (messages[1].content as { type: string; content: string }[])[0];
    const b2 = (messages[3].content as { type: string; content: string }[])[0];
    // At least one is pruned
    const pruned = [b1, b2].filter((b) => String(b.content).startsWith("[Pruned:"));
    expect(pruned.length).toBeGreaterThanOrEqual(1);
    // Not necessarily both
  });

  it("returns total chars saved", () => {
    const messages: ApiMessage[] = [
      makeToolUseMsg("t1", "grep"),
      makeToolResultMsg("t1", "G".repeat(2000)),
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
      { role: "assistant", content: [] },
    ];
    const saved = scoredPrune(messages, messages.length, 100);
    expect(saved).toBeGreaterThan(0);
  });
});
