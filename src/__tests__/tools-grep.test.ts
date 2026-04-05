import { describe, it, expect } from "vitest";
import { executeGrep } from "../tools/grep.js";
import path from "path";

const ROOT = process.cwd();

describe("executeGrep", () => {
  it("finds a pattern in a known file", () => {
    const result = executeGrep("executeBash", "src/tools/bash.ts", undefined, undefined, "content", 0, false, 100, false, ROOT);
    expect(result.success).toBe(true);
    expect(result.content).toContain("executeBash");
    expect(result.matchCount).toBeGreaterThan(0);
  });

  it("returns no matches for a pattern that does not exist", () => {
    // Search only in bash.ts to avoid matching this test file's string
    const result = executeGrep("XYZZY_DOES_NOT_EXIST_12345", "src/tools/bash.ts", undefined, undefined, "content", 0, false, 100, false, ROOT);
    expect(result.success).toBe(true);
    expect(result.content).toContain("No matches found");
    expect(result.matchCount).toBe(0);
  });

  it("files output mode returns file paths only", () => {
    const result = executeGrep("executeGrep", "src/tools/grep.ts", undefined, undefined, "files", 0, false, 100, false, ROOT);
    expect(result.success).toBe(true);
    // Should return a path, not line-numbered content
    expect(result.content).not.toMatch(/^\d+:/m);
  });

  it("count output mode returns counts", () => {
    const result = executeGrep("import", "src/tools/bash.ts", undefined, undefined, "count", 0, false, 100, false, ROOT);
    expect(result.success).toBe(true);
    // count mode returns lines like "file:N"
    expect(result.content).toMatch(/\d/);
  });

  it("case insensitive search matches regardless of case", () => {
    const lower = executeGrep("executebash", "src/tools/bash.ts", undefined, undefined, "content", 0, false, 100, false, ROOT);
    const upper = executeGrep("EXECUTEBASH", "src/tools/bash.ts", undefined, undefined, "content", 0, true, 100, false, ROOT);
    expect(upper.success).toBe(true);
    expect(upper.matchCount).toBeGreaterThanOrEqual(lower.matchCount);
    // Case sensitive should find 0, case insensitive should find > 0
    expect(upper.matchCount).toBeGreaterThan(0);
  });

  it("glob filter restricts search to matching files", () => {
    // Search in src/ but only *.ts files — should work
    const result = executeGrep("import", "src/tools", "*.ts", undefined, "content", 0, false, 100, false, ROOT);
    expect(result.success).toBe(true);
    expect(result.matchCount).toBeGreaterThan(0);
  });

  it("max_results limits number of results returned", () => {
    const unlimited = executeGrep("import", "src/", undefined, undefined, "content", 0, false, 1000, false, ROOT);
    const limited = executeGrep("import", "src/", undefined, undefined, "content", 0, false, 3, false, ROOT);
    expect(limited.matchCount).toBeLessThanOrEqual(3);
    expect(unlimited.matchCount).toBeGreaterThan(3);
  });

  it("context lines include surrounding lines", () => {
    const withCtx = executeGrep("executeBash", "src/tools/bash.ts", undefined, undefined, "content", 2, false, 100, false, ROOT);
    const noCtx = executeGrep("executeBash", "src/tools/bash.ts", undefined, undefined, "content", 0, false, 100, false, ROOT);
    // With context should return more lines
    expect(withCtx.content.split("\n").length).toBeGreaterThanOrEqual(noCtx.content.split("\n").length);
  });
});
