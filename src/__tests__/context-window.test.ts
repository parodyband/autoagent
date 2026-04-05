/**
 * Tests for context-window management — conversation truncation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { shouldTruncate, summarizeOldTurns, type Message } from "../context-window.js";

// ─── Mock subagent ───────────────────────────────────────────

vi.mock("../tools/subagent.js", () => ({
  executeSubagent: vi.fn(),
}));

import { executeSubagent } from "../tools/subagent.js";
const mockExecuteSubagent = vi.mocked(executeSubagent);

// ─── Helpers ─────────────────────────────────────────────────

function makeMessage(role: Message["role"], content: string): Message {
  return { role, content };
}

function makeMessages(n: number): Message[] {
  return Array.from({ length: n }, (_, i) =>
    makeMessage(i % 2 === 0 ? "user" : "assistant", `Message content ${i + 1}`),
  );
}

function makeSubagentResult(summary: string) {
  return {
    response: summary,
    model: "claude-haiku-4-5-20251001",
    inputTokens: 100,
    outputTokens: 50,
  };
}

// ─── shouldTruncate ──────────────────────────────────────────

describe("shouldTruncate", () => {
  it("returns false for small message arrays", () => {
    const messages = makeMessages(10);
    expect(shouldTruncate(messages)).toBe(false);
  });

  it("returns false at the MESSAGE_THRESHOLD boundary (exactly 40)", () => {
    const messages = makeMessages(40);
    expect(shouldTruncate(messages)).toBe(false);
  });

  it("returns true when messages.length > 40", () => {
    const messages = makeMessages(41);
    expect(shouldTruncate(messages)).toBe(true);
  });

  it("returns true when token estimate exceeds 80,000", () => {
    const messages = makeMessages(5);
    expect(shouldTruncate(messages, 80_001)).toBe(true);
  });

  it("returns false when token estimate is exactly 80,000", () => {
    const messages = makeMessages(5);
    expect(shouldTruncate(messages, 80_000)).toBe(false);
  });

  it("uses char-based heuristic when no token estimate provided", () => {
    // Each char ≈ 0.25 tokens → need ~320,000 chars to exceed 80k tokens
    const bigContent = "x".repeat(320_001);
    const messages = [makeMessage("user", bigContent)];
    expect(shouldTruncate(messages)).toBe(true);
  });

  it("returns false for empty message array", () => {
    expect(shouldTruncate([])).toBe(false);
  });
});

// ─── summarizeOldTurns ───────────────────────────────────────

describe("summarizeOldTurns", () => {
  beforeEach(() => {
    mockExecuteSubagent.mockReset();
  });

  it("returns messages unchanged when count <= keepRecent", async () => {
    const messages = makeMessages(5);
    const result = await summarizeOldTurns(messages, 10);
    expect(result).toBe(messages); // same reference
    expect(mockExecuteSubagent).not.toHaveBeenCalled();
  });

  it("returns messages unchanged when count equals keepRecent", async () => {
    const messages = makeMessages(10);
    const result = await summarizeOldTurns(messages, 10);
    expect(result).toBe(messages);
    expect(mockExecuteSubagent).not.toHaveBeenCalled();
  });

  it("truncates and inserts summary when messages exceed keepRecent", async () => {
    const messages = makeMessages(15);
    mockExecuteSubagent.mockResolvedValue(makeSubagentResult("Summary of old turns."));

    const result = await summarizeOldTurns(messages, 10);

    // Should be: 1 summary + 10 recent = 11 messages
    expect(result).toHaveLength(11);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toMatch(/^\[Conversation summary — turns 1-5\]/);
    // Recent messages preserved
    expect(result.slice(1)).toEqual(messages.slice(5));
  });

  it("summary message starts with correct prefix", async () => {
    const messages = makeMessages(20);
    mockExecuteSubagent.mockResolvedValue(makeSubagentResult("Files modified: foo.ts. Commands run: npm test."));

    const result = await summarizeOldTurns(messages, 10);

    expect(result[0].content).toMatch(/^\[Conversation summary — turns 1-10\]/);
  });

  it("summary preserves file names mentioned in old messages", async () => {
    const messages: Message[] = [
      makeMessage("user", "Write src/foo.ts with the new implementation"),
      makeMessage("assistant", "I'll write src/foo.ts now"),
      makeMessage("user", "Also update src/bar.ts"),
      makeMessage("assistant", "Updated src/bar.ts successfully"),
      makeMessage("user", "Run the tests"),
      makeMessage("assistant", "Running: npx vitest run"),
      makeMessage("user", "Tests passed"),
      makeMessage("assistant", "All done"),
      makeMessage("user", "Now check errors in src/baz.ts"),
      makeMessage("assistant", "Error: cannot find module"),
      // 10 recent messages start here
      makeMessage("user", "fix it"),
      makeMessage("assistant", "fixing"),
      makeMessage("user", "done"),
      makeMessage("assistant", "ok"),
      makeMessage("user", "final"),
    ];

    const summaryContent =
      "Files modified: src/foo.ts, src/bar.ts. Commands run: npx vitest run. " +
      "Error: cannot find module in src/baz.ts. Task: implementation complete.";
    mockExecuteSubagent.mockResolvedValue(makeSubagentResult(summaryContent));

    const result = await summarizeOldTurns(messages, 5);

    expect(result[0].content).toContain("src/foo.ts");
    expect(result[0].content).toContain("src/bar.ts");
    expect(result[0].content).toContain("Error");
  });

  it("summary preserves error messages from old turns", async () => {
    const messages = makeMessages(20);
    const errorSummary = "Encountered error: ENOENT file not found at src/missing.ts";
    mockExecuteSubagent.mockResolvedValue(makeSubagentResult(errorSummary));

    const result = await summarizeOldTurns(messages, 10);

    expect(result[0].content).toContain("ENOENT");
    expect(result[0].content).toContain("src/missing.ts");
  });

  it("calls executeSubagent with fast model", async () => {
    const messages = makeMessages(15);
    mockExecuteSubagent.mockResolvedValue(makeSubagentResult("Summary."));

    await summarizeOldTurns(messages, 10);

    expect(mockExecuteSubagent).toHaveBeenCalledWith(
      expect.stringContaining("summarizing"),
      "fast",
      expect.any(Number),
    );
  });

  it("uses default keepRecent of 10 when not specified", async () => {
    const messages = makeMessages(25);
    mockExecuteSubagent.mockResolvedValue(makeSubagentResult("Summary."));

    const result = await summarizeOldTurns(messages);

    // 1 summary + 10 recent = 11
    expect(result).toHaveLength(11);
    expect(result[0].role).toBe("system");
  });
});
