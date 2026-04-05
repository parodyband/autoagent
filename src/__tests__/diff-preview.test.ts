import { describe, it, expect } from "vitest";
import { computeUnifiedDiff, getDiffStats } from "../diff-preview.js";

describe("computeUnifiedDiff", () => {
  it("returns empty string when content is unchanged", () => {
    const content = "line1\nline2\nline3";
    expect(computeUnifiedDiff(content, content, "foo.ts")).toBe("");
  });

  it("all additions for a new file (empty old content)", () => {
    const diff = computeUnifiedDiff("", "hello\nworld\n", "new.ts");
    expect(diff).toContain("--- /dev/null");
    expect(diff).toContain("+++ b/new.ts");
    expect(diff).toContain("+hello");
    expect(diff).toContain("+world");
    // no deletion lines (lines starting with -)
    const diffLines = diff.split("\n").filter(l => l.startsWith("-"));
    expect(diffLines).toHaveLength(0);
  });

  it("produces correct headers for modified file", () => {
    const old = "line1\nline2\nline3";
    const neu = "line1\nLINE2\nline3";
    const diff = computeUnifiedDiff(old, neu, "src/foo.ts");
    expect(diff).toContain("--- a/src/foo.ts");
    expect(diff).toContain("+++ b/src/foo.ts");
    expect(diff).toContain("-line2");
    expect(diff).toContain("+LINE2");
  });

  it("includes context lines around changes", () => {
    const old = "a\nb\nc\nd\ne\nf\ng";
    const neu = "a\nb\nc\nX\ne\nf\ng";
    const diff = computeUnifiedDiff(old, neu, "file.ts");
    // context before and after the change
    expect(diff).toContain(" c");   // 1 line before change
    expect(diff).toContain("+X");   // the addition
    expect(diff).toContain("-d");   // the deletion
    expect(diff).toContain(" e");   // 1 line after change
  });

  it("handles appended lines", () => {
    const old = "line1\nline2";
    const neu = "line1\nline2\nline3\nline4";
    const diff = computeUnifiedDiff(old, neu, "f.ts");
    expect(diff).toContain("+line3");
    expect(diff).toContain("+line4");
    expect(diff).not.toContain("-line1");
    expect(diff).not.toContain("-line2");
  });

  it("handles deleted lines", () => {
    const old = "a\nb\nc";
    const neu = "a\nc";
    const diff = computeUnifiedDiff(old, neu, "f.ts");
    expect(diff).toContain("-b");
    expect(diff).not.toContain("+b");
  });

  it("handles complete replacement", () => {
    const old = "old content entirely\ndifferent";
    const neu = "brand new content\nhere";
    const diff = computeUnifiedDiff(old, neu, "x.ts");
    expect(diff).toContain("-old content entirely");
    expect(diff).toContain("+brand new content");
  });
});

describe("getDiffStats", () => {
  it("counts additions and deletions", () => {
    const diff = computeUnifiedDiff("a\nb\nc", "a\nB\nc\nd", "f.ts");
    const stats = getDiffStats(diff);
    expect(stats.additions).toBeGreaterThan(0);
    expect(stats.deletions).toBeGreaterThan(0);
  });

  it("marks new file correctly", () => {
    const diff = computeUnifiedDiff("", "hello\n", "new.ts");
    const stats = getDiffStats(diff);
    expect(stats.isNewFile).toBe(true);
    expect(stats.deletions).toBe(0);
  });

  it("no additions for pure deletion", () => {
    const diff = computeUnifiedDiff("a\nb\nc", "a\nc", "f.ts");
    const stats = getDiffStats(diff);
    expect(stats.deletions).toBeGreaterThan(0);
  });
});
