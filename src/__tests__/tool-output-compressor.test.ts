import { describe, it, expect } from "vitest";
import { compressToolOutput } from "../tool-output-compressor.js";

// Helper: generate a string of N lines
function makeLines(n: number, prefix = "line"): string {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join("\n");
}

describe("compressToolOutput", () => {
  it("short outputs pass through unchanged", () => {
    const short = "hello world\nthis is a short output";
    expect(compressToolOutput("bash", short)).toBe(short);
    expect(compressToolOutput("grep", short)).toBe(short);
    expect(compressToolOutput("write_file", short)).toBe(short);
  });

  it("short outputs at threshold boundary pass through", () => {
    const exactly3000 = "x".repeat(3000);
    expect(compressToolOutput("bash", exactly3000)).toBe(exactly3000);
  });

  it("long bash output keeps head (20) + tail (30) lines", () => {
    // Use long lines so total exceeds 3000 char threshold
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}: ${"x".repeat(40)}`);
    const output = lines.join("\n");
    const result = compressToolOutput("bash", output);

    expect(result).toContain("line 1");
    expect(result).toContain("line 20");
    expect(result).toContain("line 71"); // tail starts at 71
    expect(result).toContain("line 100");
    expect(result).toContain("... (50 lines omitted)");
    // Middle lines should be omitted
    expect(result).not.toContain("line 21\n");
  });

  it("bash test output preserves FAIL/error lines in middle", () => {
    const lines = [
      ...Array.from({ length: 15 }, (_, i) => `setup line ${i + 1}`),
      "FAIL: test suite crashed",
      ...Array.from({ length: 30 }, (_, i) => `middle line ${i + 1}`),
      "Error: something went wrong",
      ...Array.from({ length: 30 }, (_, i) => `more middle ${i + 1}`),
      "Tests: 5 failed, 20 passed",
      ...Array.from({ length: 15 }, (_, i) => `teardown ${i + 1}`),
    ];
    const output = lines.join("\n");
    const result = compressToolOutput("bash", output);

    expect(result).toContain("FAIL: test suite crashed");
    expect(result).toContain("Error: something went wrong");
    expect(result).toContain("Tests: 5 failed, 20 passed");
  });

  it("long grep output truncates with count", () => {
    // Each line ~60 chars, 50 lines = ~3000+ chars to exceed threshold
    const lines = Array.from({ length: 50 }, (_, i) => `src/some/deep/path/file${i}.ts:10:  const match = someFunction${i}()`);
    const output = lines.join("\n");
    const result = compressToolOutput("grep", output);

    expect(result).toContain("file0.ts");
    expect(result).toContain("file29.ts");
    expect(result).not.toContain("file30.ts");
    expect(result).toContain("... (20 more matches)");
  });

  it("read_file output is never compressed regardless of size", () => {
    // Make a large output but still under hard cap
    const bigFile = makeLines(200, "file content line");
    // Just under the hard cap so we can verify no compression happened
    const underCap = "x".repeat(7000);
    expect(compressToolOutput("read_file", bigFile)).toBe(bigFile);
    expect(compressToolOutput("read_file", underCap)).toBe(underCap);
  });

  it("hard cap enforced at 8000 chars for all tools", () => {
    const huge = "x".repeat(10000);
    const result = compressToolOutput("bash", huge);
    expect(result.length).toBeLessThanOrEqual(8100); // 8000 + truncation suffix
    expect(result).toContain("... (truncated, 10000 chars total)");
  });

  it("hard cap enforced for read_file too", () => {
    const huge = "x".repeat(10000);
    const result = compressToolOutput("read_file", huge);
    expect(result).toContain("... (truncated, 10000 chars total)");
    expect(result.length).toBeLessThanOrEqual(8100);
  });

  it("custom maxChars threshold works", () => {
    // With threshold=50, a 60-char output should be compressed
    const output = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join("\n");
    const result = compressToolOutput("bash", output, 50);
    expect(result).toContain("lines omitted");
  });

  it("custom maxChars=large keeps everything under hard cap", () => {
    const output = makeLines(60, "test");
    // With high threshold, a 60-line output passes through
    const result = compressToolOutput("bash", output, 100000);
    expect(result).toBe(output);
  });
});
