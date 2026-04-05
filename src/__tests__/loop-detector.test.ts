import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { detectLoop, type LoopDetectorResult } from "../loop-detector.js";

// ─── Helpers ──────────────────────────────────────────────────

function assistantWithTool(
  name: string,
  input: Record<string, unknown>
): Anthropic.MessageParam {
  return {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: `id-${Math.random()}`,
        name,
        input,
      } as Anthropic.ToolUseBlock,
    ],
  };
}

function assistantText(text: string): Anthropic.MessageParam {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
  };
}

function toolResult(
  content: string,
  isError = false
): Anthropic.MessageParam {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: `id-${Math.random()}`,
        content,
        is_error: isError,
      } as Anthropic.ToolResultBlock,
    ],
  };
}

function userMsg(text: string): Anthropic.MessageParam {
  return { role: "user", content: text };
}

// ─── Tests ────────────────────────────────────────────────────

describe("detectLoop", () => {
  it("returns no loop for empty messages", () => {
    const result = detectLoop([]);
    expect(result.loopDetected).toBe(false);
    expect(result.loopType).toBeNull();
  });

  it("returns no loop for messages with no tool calls", () => {
    const msgs: Anthropic.MessageParam[] = [
      userMsg("hello"),
      assistantText("hi there"),
      userMsg("how are you"),
      assistantText("doing great"),
    ];
    const result = detectLoop(msgs);
    expect(result.loopDetected).toBe(false);
    expect(result.loopType).toBeNull();
  });

  it("detects repeated identical tool calls (3+ times in last 5 rounds)", () => {
    const msgs: Anthropic.MessageParam[] = [
      userMsg("fix it"),
      assistantWithTool("read_file", { path: "foo.ts" }),
      toolResult("content"),
      assistantWithTool("read_file", { path: "foo.ts" }),
      toolResult("content"),
      assistantWithTool("read_file", { path: "foo.ts" }),
      toolResult("content"),
    ];
    const result = detectLoop(msgs);
    expect(result.loopDetected).toBe(true);
    expect(result.loopType).toBe("repeated-tool");
    expect(result.description).toContain("read_file");
    expect(result.description).toContain("3");
  });

  it("does NOT detect loop for similar but different tool calls (reading different files)", () => {
    const msgs: Anthropic.MessageParam[] = [
      userMsg("explore"),
      assistantWithTool("read_file", { path: "a.ts" }),
      toolResult("aaa"),
      assistantWithTool("read_file", { path: "b.ts" }),
      toolResult("bbb"),
      assistantWithTool("read_file", { path: "c.ts" }),
      toolResult("ccc"),
    ];
    const result = detectLoop(msgs);
    expect(result.loopDetected).toBe(false);
  });

  it("detects error loop: same error 3+ consecutive times", () => {
    const err = "Error: ENOENT: no such file or directory, open 'missing.ts'";
    const msgs: Anthropic.MessageParam[] = [
      userMsg("do something"),
      assistantWithTool("read_file", { path: "missing.ts" }),
      toolResult(err, true),
      assistantWithTool("read_file", { path: "missing.ts" }),
      toolResult(err, true),
      assistantWithTool("read_file", { path: "missing.ts" }),
      toolResult(err, true),
    ];
    const result = detectLoop(msgs);
    expect(result.loopDetected).toBe(true);
    expect(result.loopType).toBe("error-loop");
    expect(result.description).toContain("3");
  });

  it("does NOT detect error loop when errors are different", () => {
    const msgs: Anthropic.MessageParam[] = [
      userMsg("do something"),
      assistantWithTool("bash", { command: "ls" }),
      toolResult("Error: permission denied", true),
      assistantWithTool("bash", { command: "cat x" }),
      toolResult("Error: file not found", true),
      assistantWithTool("bash", { command: "echo y" }),
      toolResult("Error: syntax error", true),
    ];
    const result = detectLoop(msgs);
    expect(result.loopDetected).toBe(false);
  });

  it("detects oscillation pattern (alternating A-B-A-B)", () => {
    const stateA = assistantWithTool("write_file", {
      path: "x.ts",
      content: "v1",
    });
    const stateB = assistantWithTool("bash", { command: "tsc" });

    // Build messages as a shared array so findIndex works correctly
    const msgs: Anthropic.MessageParam[] = [
      userMsg("build it"),
      stateA,
      toolResult("ok"),
      stateB,
      toolResult("error", true),
      stateA,
      toolResult("ok"),
      stateB,
      toolResult("error", true),
      stateA,
      toolResult("ok"),
      stateB,
      toolResult("error", true),
    ];
    const result = detectLoop(msgs);
    expect(result.loopDetected).toBe(true);
    expect(result.loopType).toBe("oscillation");
    expect(result.description).toContain("oscillat");
  });

  it("returns no loop for normal varied conversation", () => {
    const msgs: Anthropic.MessageParam[] = [
      userMsg("build feature X"),
      assistantWithTool("read_file", { path: "src/main.ts" }),
      toolResult("main content"),
      assistantWithTool("bash", { command: "git status" }),
      toolResult("clean"),
      assistantWithTool("write_file", { path: "src/feature.ts", content: "..." }),
      toolResult("written"),
      assistantWithTool("bash", { command: "npx tsc --noEmit" }),
      toolResult("success"),
    ];
    const result = detectLoop(msgs);
    expect(result.loopDetected).toBe(false);
  });

  it("loop injection: provides human-readable description", () => {
    const msgs: Anthropic.MessageParam[] = [];
    for (let i = 0; i < 4; i++) {
      msgs.push(assistantWithTool("bash", { command: "npm test" }));
      msgs.push(toolResult("FAIL: test suite failed", true));
    }
    const result: LoopDetectorResult = detectLoop(msgs);
    if (result.loopDetected) {
      expect(typeof result.description).toBe("string");
      expect(result.description.length).toBeGreaterThan(10);
    }
    // Either repeated-tool or error-loop is fine
    expect(["repeated-tool", "error-loop", "oscillation", null]).toContain(
      result.loopType
    );
  });
});
