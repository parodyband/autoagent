import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateMessageTokens,
  shouldCompact,
} from "../token-estimator.js";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates plain text at ~chars/4", () => {
    const text = "hello world this is plain text"; // 30 chars, all alpha+space
    const result = estimateTokens(text);
    expect(result).toBe(Math.ceil(30 / 4)); // 8
  });

  it("applies 1.2x multiplier for code-heavy text", () => {
    // Code with lots of punctuation: >30% non-alpha
    const code = "const x = () => { return { a: 1, b: 2 }; };";
    const nonAlpha = (code.match(/[^a-zA-Z\s]/g) ?? []).length;
    const ratio = nonAlpha / code.length;
    expect(ratio).toBeGreaterThan(0.3);

    const result = estimateTokens(code);
    const expected = Math.ceil((code.length / 4) * 1.2);
    expect(result).toBe(expected);
  });

  it("does NOT apply multiplier for mostly-alpha text", () => {
    const text = "abcdefghijklmnopqrstuvwxyz"; // 100% alpha, no punctuation
    const result = estimateTokens(text);
    expect(result).toBe(Math.ceil(text.length / 4));
  });
});

describe("estimateMessageTokens", () => {
  it("returns 0 for empty messages array", () => {
    expect(estimateMessageTokens([])).toBe(0);
  });

  it("adds 4 tokens overhead per message", () => {
    const messages = [
      { role: "user", content: "" },
      { role: "assistant", content: "" },
    ];
    // Empty content = 0 tokens each, but 4 overhead each = 8 total
    expect(estimateMessageTokens(messages)).toBe(8);
  });

  it("sums content tokens across messages", () => {
    const text = "hello world"; // 11 chars, mostly alpha → ceil(11/4) = 3
    const messages = [
      { role: "user", content: text },
      { role: "assistant", content: text },
    ];
    const perMsg = estimateTokens(text) + 4;
    expect(estimateMessageTokens(messages)).toBe(perMsg * 2);
  });

  it("handles array content blocks", () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: " world" },
        ],
      },
    ];
    const fullText = "hello world";
    const expected = estimateTokens(fullText) + 4;
    expect(estimateMessageTokens(messages)).toBe(expected);
  });
});

describe("shouldCompact", () => {
  it("returns false when under threshold", () => {
    // 1 message with short content — well under any limit
    const messages = [{ role: "user", content: "hi" }];
    expect(shouldCompact(messages, 200000, 0.8)).toBe(false);
  });

  it("returns true when estimated tokens exceed threshold * maxTokens", () => {
    // Create a message whose estimated tokens exceed 80% of maxTokens=100
    // Need > 80 tokens → > 320 chars of plain text
    const bigText = "a".repeat(400); // 400 chars → ceil(400/4)=100 tokens + 4 overhead = 104
    const messages = [{ role: "user", content: bigText }];
    expect(shouldCompact(messages, 100, 0.8)).toBe(true);
  });

  it("uses default threshold of 0.8", () => {
    const bigText = "a".repeat(400);
    const messages = [{ role: "user", content: bigText }];
    expect(shouldCompact(messages, 100)).toBe(true);
  });

  it("respects custom threshold", () => {
    // 100 tokens estimated, maxTokens=200, threshold=0.4 → 100 > 0.4*200=80 → true
    const text = "a".repeat(400); // 100 tokens
    const messages = [{ role: "user", content: text }];
    expect(shouldCompact(messages, 200, 0.4)).toBe(true);
    // threshold=0.6 → need > 120 tokens, we have ~104 → false
    expect(shouldCompact(messages, 200, 0.6)).toBe(false);
  });
});
