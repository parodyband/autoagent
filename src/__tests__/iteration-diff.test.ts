import { describe, it, expect } from "vitest";
import { computeDiffStats, getIterationCommits, getAllIterationDiffs } from "../iteration-diff.js";

// ─── computeDiffStats ────────────────────────────────────────

describe("computeDiffStats", () => {
  it("returns a DiffStats object with expected shape", async () => {
    // Use HEAD~1..HEAD which always exists in this repo
    const result = await computeDiffStats("HEAD~1", "HEAD", 999);
    expect(result).toHaveProperty("iteration", 999);
    expect(result).toHaveProperty("fromSha", "HEAD~1");
    expect(result).toHaveProperty("toSha", "HEAD");
    expect(typeof result.filesChanged).toBe("number");
    expect(typeof result.linesAdded).toBe("number");
    expect(typeof result.linesRemoved).toBe("number");
    expect(typeof result.netDelta).toBe("number");
    expect(Array.isArray(result.files)).toBe(true);
  });

  it("netDelta equals linesAdded minus linesRemoved", async () => {
    const result = await computeDiffStats("HEAD~1", "HEAD", 1);
    expect(result.netDelta).toBe(result.linesAdded - result.linesRemoved);
  });

  it("filesChanged matches the length of the files array", async () => {
    const result = await computeDiffStats("HEAD~1", "HEAD", 1);
    expect(result.filesChanged).toBe(result.files.length);
  });

  it("each file entry has file, added, removed properties", async () => {
    const result = await computeDiffStats("HEAD~1", "HEAD", 1);
    for (const f of result.files) {
      expect(typeof f.file).toBe("string");
      expect(typeof f.added).toBe("number");
      expect(typeof f.removed).toBe("number");
    }
  });

  it("handles same SHA (no diff) gracefully", async () => {
    const result = await computeDiffStats("HEAD", "HEAD", 0);
    expect(result.filesChanged).toBe(0);
    expect(result.linesAdded).toBe(0);
    expect(result.linesRemoved).toBe(0);
    expect(result.netDelta).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it("filters to src/ when srcOnly=true", async () => {
    const all = await computeDiffStats("HEAD~1", "HEAD", 1, false);
    const srcOnly = await computeDiffStats("HEAD~1", "HEAD", 1, true);
    // srcOnly can only have <= files as all
    expect(srcOnly.filesChanged).toBeLessThanOrEqual(all.filesChanged);
    // All srcOnly files should be under src/
    for (const f of srcOnly.files) {
      expect(f.file).toMatch(/^src\//);
    }
  });

  it("handles invalid SHA gracefully (returns empty diff)", async () => {
    const result = await computeDiffStats("0000000000000000000000000000000000000000", "HEAD", 1);
    // Should not throw; result shape should be valid
    expect(result).toHaveProperty("filesChanged");
    expect(typeof result.filesChanged).toBe("number");
  });
});

// ─── getIterationCommits ─────────────────────────────────────

describe("getIterationCommits", () => {
  it("returns an array", async () => {
    const commits = await getIterationCommits();
    expect(Array.isArray(commits)).toBe(true);
  });

  it("returns commits sorted ascending by iteration", async () => {
    const commits = await getIterationCommits();
    for (let i = 1; i < commits.length; i++) {
      expect(commits[i].iteration).toBeGreaterThan(commits[i - 1].iteration);
    }
  });

  it("each commit has iteration (number) and sha (string)", async () => {
    const commits = await getIterationCommits();
    for (const c of commits) {
      expect(typeof c.iteration).toBe("number");
      expect(typeof c.sha).toBe("string");
      expect(c.sha.length).toBeGreaterThanOrEqual(40);
    }
  });

  it("finds at least some iteration commits in this repo", async () => {
    const commits = await getIterationCommits();
    // This repo has many iteration commits
    expect(commits.length).toBeGreaterThan(0);
  });

  it("deduplicates — each iteration number appears at most once", async () => {
    const commits = await getIterationCommits();
    const iterations = commits.map((c) => c.iteration);
    const unique = new Set(iterations);
    expect(unique.size).toBe(iterations.length);
  });
});

// ─── getAllIterationDiffs ────────────────────────────────────

describe("getAllIterationDiffs", () => {
  it("returns an array of DiffStats", async () => {
    const diffs = await getAllIterationDiffs();
    expect(Array.isArray(diffs)).toBe(true);
  });

  it("each diff has valid numeric fields", async () => {
    const diffs = await getAllIterationDiffs();
    for (const d of diffs) {
      expect(typeof d.iteration).toBe("number");
      expect(typeof d.filesChanged).toBe("number");
      expect(typeof d.linesAdded).toBe("number");
      expect(typeof d.linesRemoved).toBe("number");
      expect(d.netDelta).toBe(d.linesAdded - d.linesRemoved);
    }
  });

  it("returns one fewer diff than commits", async () => {
    const { getIterationCommits: getCommits } = await import("../iteration-diff.js");
    const commits = await getCommits();
    const diffs = await getAllIterationDiffs();
    // diffs = commits.length - 1 pairs
    if (commits.length > 1) {
      expect(diffs.length).toBe(commits.length - 1);
    } else {
      expect(diffs.length).toBe(0);
    }
  });
}, 60000);
