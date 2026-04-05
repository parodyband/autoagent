/**
 * Tests for context compression — the module that summarizes old conversation
 * turns to reduce API token costs.
 */

import { describe, it, expect } from "vitest";
import {
  compressMessages,
  DEFAULT_COMPRESSION_CONFIG,
  type CompressionConfig,
} from "../context-compression.js";
import type Anthropic from "@anthropic-ai/sdk";

// ─── Helpers ────────────────────────────────────────────────

function makeUserMessage(content: string): Anthropic.MessageParam {
  return { role: "user", content };
}

function makeAssistantMessage(text: string): Anthropic.MessageParam {
  return { role: "assistant", content: [{ type: "text", text }] };
}

function makeToolUseAssistant(toolName: string, input: Record<string, unknown>): Anthropic.MessageParam {
  return {
    role: "assistant",
    content: [{
      type: "tool_use",
      id: `toolu_${Math.random().toString(36).slice(2, 10)}`,
      name: toolName,
      input,
    }],
  };
}

function makeToolResultUser(toolUseId: string, result: string): Anthropic.MessageParam {
  return {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: toolUseId, content: result }],
  };
}

/** Generate N turn-pairs (assistant + user) to fill up the message array. */
function generateTurns(n: number, startId = 0): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = [];
  for (let i = 0; i < n; i++) {
    const id = `toolu_test${startId + i}`;
    msgs.push({
      role: "assistant",
      content: [
        { type: "text", text: `Thinking about step ${i + 1}...` },
        { type: "tool_use", id, name: "bash", input: { command: `echo "step ${i + 1}"` } },
      ],
    });
    msgs.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: id, content: `step ${i + 1}\n` }],
    });
  }
  return msgs;
}

// ─── Tests ──────────────────────────────────────────────────

describe("compressMessages", () => {
  it("does not compress when below threshold", () => {
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial prompt"),
      makeAssistantMessage("Hello"),
      makeUserMessage("Thanks"),
    ];

    const result = compressMessages(messages);
    expect(result.compressed).toBe(false);
    expect(result.messages).toBe(messages); // Same reference
    expect(result.removedCount).toBe(0);
  });

  it("does not compress at exactly the threshold", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 2, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...generateTurns(2), // 4 messages
    ];
    expect(messages.length).toBe(5);

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(false);
  });

  it("compresses when above threshold", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial prompt with goals and memory"),
      ...generateTurns(4), // 8 messages -> total 9
    ];
    expect(messages.length).toBe(9);

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it("preserves the initial user message", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    const initial = makeUserMessage("My important goals and memory");
    const messages: Anthropic.MessageParam[] = [
      initial,
      ...generateTurns(4),
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    expect(result.messages[0]).toBe(initial); // Same reference
  });

  it("maintains user/assistant alternation", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...generateTurns(6), // 12 messages -> total 13
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);

    // Check alternation
    for (let i = 0; i < result.messages.length - 1; i++) {
      const curr = result.messages[i].role;
      const next = result.messages[i + 1].role;
      expect(curr).not.toBe(next);
    }
  });

  it("starts with user message", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...generateTurns(6),
    ];

    const result = compressMessages(messages, config);
    expect(result.messages[0].role).toBe("user");
  });

  it("includes summary text in compressed assistant message", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...generateTurns(6),
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);

    // Second message should be assistant summary
    const summary = result.messages[1];
    expect(summary.role).toBe("assistant");
    expect(typeof summary.content).toBe("string");
    expect(summary.content as string).toContain("Compressed summary");
  });

  it("preserves recent messages unchanged", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    const turns = generateTurns(6);
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...turns,
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);

    // Last 4 messages should be the recent ones (same references)
    const recentOriginal = messages.slice(-4);
    const recentCompressed = result.messages.slice(-4);
    for (let i = 0; i < 4; i++) {
      expect(recentCompressed[i]).toBe(recentOriginal[i]);
    }
  });

  it("summary includes tool names from compressed turns", () => {
    const config: CompressionConfig = { threshold: 3, keepRecent: 2, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      makeToolUseAssistant("read_file", { path: "src/agent.ts" }),
      makeToolResultUser("toolu_abc", "file contents here..."),
      makeAssistantMessage("Done reading"),
      makeUserMessage("Continue"),
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    const summaryContent = result.messages[1].content as string;
    expect(summaryContent).toContain("read_file");
    expect(summaryContent).toContain("src/agent.ts");
  });

  it("truncates long tool results in summary", () => {
    const config: CompressionConfig = { threshold: 3, keepRecent: 2, maxResultChars: 50, maxTextChars: 80 };
    const longResult = "A".repeat(500);
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      makeToolUseAssistant("bash", { command: "cat bigfile.txt" }),
      makeToolResultUser("toolu_xyz", longResult),
      makeAssistantMessage("Done"),
      makeUserMessage("Continue"),
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    const summaryContent = result.messages[1].content as string;
    // Summary should NOT contain the full 500-char result
    expect(summaryContent.length).toBeLessThan(longResult.length);
    expect(summaryContent).toContain("…"); // truncation marker
  });

  it("handles default config", () => {
    // Default threshold is 20, so 10+ turns needed
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...generateTurns(12), // 24 messages -> total 25
    ];

    const result = compressMessages(messages);
    expect(result.compressed).toBe(true);
    expect(result.messages.length).toBeLessThan(messages.length);
  });

  it("returns removedCount matching compressed messages", () => {
    const config: CompressionConfig = { threshold: 5, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...generateTurns(6), // 12 msgs -> total 13
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    // Compressed = messages[1..13-4] = messages[1..9] = 8 messages
    expect(result.removedCount).toBe(8);
    // Result: initial + summary_assistant + bridge_or_recent(4) = 7 or
    // initial + summary_assistant + recent(4 starting with user) = 6
    expect(result.messages.length).toBeLessThanOrEqual(messages.length - result.removedCount + 3);
  });

  it("does not compress when toCompress section is too small", () => {
    const config: CompressionConfig = { threshold: 3, keepRecent: 4, maxResultChars: 100, maxTextChars: 80 };
    // 5 messages total, keep recent 4 -> splitIdx starts at 1, bumped to 2
    // But messages[2] is a user message with tool_results, so the safe-split
    // logic walks splitIdx forward to 3, giving toCompress = messages[1..3] = 2 messages.
    // With the safe-split fix, this DOES compress (the boundary walks forward
    // to avoid orphaning a tool_result).
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      ...generateTurns(2), // 4 messages -> total 5
    ];

    const result = compressMessages(messages, config);
    // Safe-split boundary adjustment means 2 messages get compressed
    expect(result.compressed).toBe(true);
    expect(result.removedCount).toBe(2);
  });

  it("summarizes bash commands in tool calls", () => {
    const config: CompressionConfig = { threshold: 3, keepRecent: 2, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      makeToolUseAssistant("bash", { command: "npx tsc --noEmit" }),
      makeToolResultUser("toolu_tsc", "No errors"),
      makeAssistantMessage("TypeScript compiles clean"),
      makeUserMessage("Good"),
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    const summaryContent = result.messages[1].content as string;
    expect(summaryContent).toContain("npx tsc --noEmit");
  });

  it("summarizes grep tool calls", () => {
    const config: CompressionConfig = { threshold: 3, keepRecent: 2, maxResultChars: 100, maxTextChars: 80 };
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      makeToolUseAssistant("grep", { pattern: "TODO", path: "src/" }),
      makeToolResultUser("toolu_grep", "src/agent.ts:42: // TODO fix"),
      makeAssistantMessage("Found TODOs"),
      makeUserMessage("Continue"),
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    const summaryContent = result.messages[1].content as string;
    expect(summaryContent).toContain("grep");
    expect(summaryContent).toContain("TODO");
  });

  it("handles mixed text and tool_use in assistant messages", () => {
    const config: CompressionConfig = { threshold: 3, keepRecent: 2, maxResultChars: 100, maxTextChars: 80 };
    const id = "toolu_mixed1";
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial"),
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check the file structure" },
          { type: "tool_use", id, name: "list_files", input: { path: "src/" } },
        ],
      },
      makeToolResultUser(id, "src/agent.ts\nsrc/conversation.ts"),
      makeAssistantMessage("Got it"),
      makeUserMessage("Next"),
    ];

    const result = compressMessages(messages, config);
    expect(result.compressed).toBe(true);
    const summaryContent = result.messages[1].content as string;
    expect(summaryContent).toContain("list_files");
    expect(summaryContent).toContain("Thought:");
    expect(summaryContent).toContain("file structure");
  });

  it("reduces total message count significantly for large conversations", () => {
    // Simulate a 20-turn conversation
    const messages: Anthropic.MessageParam[] = [
      makeUserMessage("Initial prompt with lots of goals and memory content..."),
      ...generateTurns(20), // 40 messages -> total 41
    ];

    const result = compressMessages(messages);
    expect(result.compressed).toBe(true);
    // Should go from 41 to roughly: 1 (initial) + 1 (summary) + 1 (bridge) + 10 (recent) = 13
    expect(result.messages.length).toBeLessThanOrEqual(15);
    expect(result.messages.length).toBeGreaterThan(5); // At least initial + summary + some recent
  });
});
