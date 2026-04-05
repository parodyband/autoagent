/**
 * Tests for cache breakpoint functions in conversation.ts.
 * These functions add cache_control markers to tools and messages
 * for Anthropic's prompt caching feature.
 */

import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { addCacheBreakpoint, addMessageCacheBreakpoint } from "../conversation.js";

// ─── Tests ──────────────────────────────────────────────────

describe("addCacheBreakpoint", () => {
  it("returns empty array unchanged", () => {
    expect(addCacheBreakpoint([])).toEqual([]);
  });

  it("adds cache_control to the last tool only", () => {
    const tools: Anthropic.Tool[] = [
      { name: "bash", description: "Run bash", input_schema: { type: "object" as const, properties: {} } },
      { name: "read_file", description: "Read a file", input_schema: { type: "object" as const, properties: {} } },
      { name: "write_file", description: "Write a file", input_schema: { type: "object" as const, properties: {} } },
    ];
    const result = addCacheBreakpoint(tools);

    // First two should NOT have cache_control
    expect(result[0]).not.toHaveProperty("cache_control");
    expect(result[1]).not.toHaveProperty("cache_control");

    // Last one should have cache_control
    expect(result[2]).toHaveProperty("cache_control", { type: "ephemeral" });
  });

  it("handles single tool", () => {
    const tools: Anthropic.Tool[] = [
      { name: "bash", description: "Run bash", input_schema: { type: "object" as const, properties: {} } },
    ];
    const result = addCacheBreakpoint(tools);
    expect(result[0]).toHaveProperty("cache_control", { type: "ephemeral" });
  });

  it("does not mutate original tools array", () => {
    const tools: Anthropic.Tool[] = [
      { name: "bash", description: "Run bash", input_schema: { type: "object" as const, properties: {} } },
    ];
    const original = JSON.parse(JSON.stringify(tools));
    addCacheBreakpoint(tools);
    expect(tools).toEqual(original);
  });

  it("preserves all original tool properties", () => {
    const tools: Anthropic.Tool[] = [
      {
        name: "bash",
        description: "Run bash commands",
        input_schema: {
          type: "object" as const,
          properties: { command: { type: "string", description: "The command" } },
          required: ["command"],
        },
      },
    ];
    const result = addCacheBreakpoint(tools);
    expect(result[0].name).toBe("bash");
    expect(result[0].description).toBe("Run bash commands");
    expect(result[0].input_schema.properties).toEqual({ command: { type: "string", description: "The command" } });
  });
});

describe("addMessageCacheBreakpoint", () => {
  it("returns empty array unchanged", () => {
    expect(addMessageCacheBreakpoint([])).toEqual([]);
  });

  it("returns messages unchanged if no user message exists", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "assistant", content: "Hello" },
    ];
    const result = addMessageCacheBreakpoint(messages);
    expect(result).toEqual(messages);
  });

  it("converts string content to text block with cache_control", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "Hello world" },
    ];
    const result = addMessageCacheBreakpoint(messages);
    expect(result[0].content).toEqual([{
      type: "text",
      text: "Hello world",
      cache_control: { type: "ephemeral" },
    }]);
  });

  it("marks the LAST user message, not earlier ones", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "Second question" },
      { role: "assistant", content: "Second answer" },
      { role: "user", content: "Third question" },
    ];
    const result = addMessageCacheBreakpoint(messages);

    // First user message should be unchanged (still a string)
    expect(result[0].content).toBe("First question");
    // Second user message should be unchanged
    expect(result[2].content).toBe("Second question");
    // Third (last) user message should have cache_control
    expect(result[4].content).toEqual([{
      type: "text",
      text: "Third question",
      cache_control: { type: "ephemeral" },
    }]);
  });

  it("adds cache_control to last block of array content", () => {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          { type: "text" as const, text: "First block" },
          { type: "text" as const, text: "Second block" },
        ],
      },
    ];
    const result = addMessageCacheBreakpoint(messages);
    const content = result[0].content as Array<Record<string, unknown>>;

    // First block should NOT have cache_control
    expect(content[0]).not.toHaveProperty("cache_control");
    // Last block should have cache_control
    expect(content[1]).toHaveProperty("cache_control", { type: "ephemeral" });
  });

  it("handles tool_result content blocks", () => {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          { type: "tool_result" as const, tool_use_id: "toolu_123", content: "result text" },
        ],
      },
    ];
    const result = addMessageCacheBreakpoint(messages);
    const content = result[0].content as Array<Record<string, unknown>>;
    expect(content[0]).toHaveProperty("cache_control", { type: "ephemeral" });
    expect(content[0].type).toBe("tool_result");
    expect(content[0].tool_use_id).toBe("toolu_123");
  });

  it("does not mutate original messages", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi" },
    ];
    const original = JSON.parse(JSON.stringify(messages));
    addMessageCacheBreakpoint(messages);
    expect(messages).toEqual(original);
  });

  it("handles mixed user and assistant messages with last user in middle", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "Question" },
      { role: "assistant", content: "Answer" },
    ];
    const result = addMessageCacheBreakpoint(messages);

    // The only user message (first) should get the breakpoint
    expect(result[0].content).toEqual([{
      type: "text",
      text: "Question",
      cache_control: { type: "ephemeral" },
    }]);
    // Assistant should be unchanged
    expect(result[1].content).toBe("Answer");
  });

  it("handles single-element array content", () => {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [{ type: "text" as const, text: "Only block" }],
      },
    ];
    const result = addMessageCacheBreakpoint(messages);
    const content = result[0].content as Array<Record<string, unknown>>;
    expect(content).toHaveLength(1);
    expect(content[0]).toHaveProperty("cache_control", { type: "ephemeral" });
    expect(content[0].text).toBe("Only block");
  });
});
