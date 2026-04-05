import { describe, it, expect } from "vitest";
import { pruneStaleToolResults } from "../src/orchestrator.js";
import type Anthropic from "@anthropic-ai/sdk";

function makeToolUseMsg(id: string, name: string): Anthropic.MessageParam {
  return {
    role: "assistant",
    content: [{ type: "tool_use", id, name, input: {} }],
  };
}

function makeToolResultMsg(id: string, content: string): Anthropic.MessageParam {
  return {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: id, content }],
  };
}

describe("pruneStaleToolResults", () => {
  it("does not mutate original messages", () => {
    const longResult = "x".repeat(200);
    const messages: Anthropic.MessageParam[] = [
      makeToolUseMsg("id1", "read_file"),
      makeToolResultMsg("id1", longResult),
      makeToolUseMsg("id2", "read_file"),
      makeToolResultMsg("id2", longResult),
      makeToolUseMsg("id3", "read_file"),
      makeToolResultMsg("id3", longResult),
    ];
    const original = JSON.stringify(messages);
    pruneStaleToolResults(messages);
    expect(JSON.stringify(messages)).toBe(original);
  });

  it("truncates tool results 2+ turns old", () => {
    const longResult = "a".repeat(200);
    // Turn 0: id1/read_file result (old — 2 turns ago)
    // Turn 1: id2/read_file result (old — 1 turn ago) 
    // Turn 2: id3/read_file result (current turn)
    const messages: Anthropic.MessageParam[] = [
      makeToolUseMsg("id1", "read_file"),
      makeToolResultMsg("id1", longResult),
      makeToolUseMsg("id2", "read_file"),
      makeToolResultMsg("id2", longResult),
      makeToolUseMsg("id3", "read_file"),
      makeToolResultMsg("id3", longResult),
    ];
    const pruned = pruneStaleToolResults(messages);
    // id1 is 2 turns ago → truncated
    const oldResult = pruned[1].content as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(oldResult[0].content).toContain("[Result truncated");
    expect(oldResult[0].content).toContain("200 chars");
    // id3 is current turn → kept full
    const newResult = pruned[5].content as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(newResult[0].content).toBe(longResult);
  });

  it("never truncates bash results", () => {
    const longResult = "b".repeat(200);
    const messages: Anthropic.MessageParam[] = [
      makeToolUseMsg("id1", "bash"),
      makeToolResultMsg("id1", longResult),
      makeToolUseMsg("id2", "read_file"),
      makeToolResultMsg("id2", longResult),
      makeToolUseMsg("id3", "read_file"),
      makeToolResultMsg("id3", longResult),
    ];
    const pruned = pruneStaleToolResults(messages);
    // id1 is bash → never truncated even though 2+ turns old
    const bashResult = pruned[1].content as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(bashResult[0].content).toBe(longResult);
    // id2 is read_file 1 turn ago → kept full
    const prevResult = pruned[3].content as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(prevResult[0].content).toBe(longResult);
  });

  it("never truncates write_file results", () => {
    const longResult = "c".repeat(200);
    const messages: Anthropic.MessageParam[] = [
      makeToolUseMsg("id1", "write_file"),
      makeToolResultMsg("id1", longResult),
      makeToolUseMsg("id2", "read_file"),
      makeToolResultMsg("id2", longResult),
      makeToolUseMsg("id3", "read_file"),
      makeToolResultMsg("id3", longResult),
    ];
    const pruned = pruneStaleToolResults(messages);
    const writeResult = pruned[1].content as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(writeResult[0].content).toBe(longResult);
  });

  it("does not truncate short results even if old", () => {
    const shortResult = "short";
    const messages: Anthropic.MessageParam[] = [
      makeToolUseMsg("id1", "read_file"),
      makeToolResultMsg("id1", shortResult),
      makeToolUseMsg("id2", "read_file"),
      makeToolResultMsg("id2", shortResult),
      makeToolUseMsg("id3", "read_file"),
      makeToolResultMsg("id3", shortResult),
    ];
    const pruned = pruneStaleToolResults(messages);
    const oldResult = pruned[1].content as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(oldResult[0].content).toBe(shortResult);
  });
});
