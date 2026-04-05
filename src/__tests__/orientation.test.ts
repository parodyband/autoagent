import { describe, it, expect, vi, beforeEach } from "vitest";
import { orient, formatOrientation, readExpertBreadcrumbs, type OrientationReport } from "../orientation.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

// Mock executeBash
vi.mock("../tools/bash.js", () => ({
  executeBash: vi.fn(),
}));

// Mock parallelResearch
vi.mock("../tools/subagent.js", () => ({
  parallelResearch: vi.fn(),
}));

import { executeBash } from "../tools/bash.js";
import { parallelResearch } from "../tools/subagent.js";

const mockBash = vi.mocked(executeBash);
const mockParallelResearch = vi.mocked(parallelResearch);

describe("orient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no changes when git diff fails", async () => {
    mockBash.mockResolvedValue({ output: "fatal: bad revision", exitCode: 128 });
    const result = await orient();
    expect(result.hasChanges).toBe(false);
    expect(result.diffSummary).toBeNull();
  });

  it("returns no changes when diff is empty", async () => {
    mockBash.mockResolvedValue({ output: "", exitCode: 0 });
    const result = await orient();
    expect(result.hasChanges).toBe(false);
  });

  it("returns diff summary when changes exist (fewer than 5 src files)", async () => {
    // First call: git diff --stat
    mockBash.mockResolvedValueOnce({
      output: " src/agent.ts | 5 ++---\n 1 file changed, 2 insertions(+), 3 deletions(-)\n",
      exitCode: 0,
    });
    // Second call: git diff (actual diff)
    mockBash.mockResolvedValueOnce({
      output: "diff --git a/src/agent.ts b/src/agent.ts\n-old line\n+new line\n",
      exitCode: 0,
    });

    const result = await orient();
    expect(result.hasChanges).toBe(true);
    expect(result.diffSummary).toContain("src/agent.ts");
    expect(result.diffSummary).toContain("+new line");
    expect(mockParallelResearch).not.toHaveBeenCalled();
  });

  it("truncates long diffs", async () => {
    mockBash.mockResolvedValueOnce({
      output: " src/big.ts | 1000 +++\n",
      exitCode: 0,
    });
    mockBash.mockResolvedValueOnce({
      output: "x".repeat(5000),
      exitCode: 0,
    });

    const result = await orient(100);
    expect(result.hasChanges).toBe(true);
    expect(result.diffSummary!).toContain("(truncated)");
    expect(result.diffSummary!.length).toBeLessThan(5000);
  });

  it("uses parallelResearch when 5+ src files changed", async () => {
    const statOutput = [
      " src/a.ts | 5 ++---",
      " src/b.ts | 3 +--",
      " src/c.ts | 8 ++++----",
      " src/d.ts | 2 +-",
      " src/e.ts | 10 +++++-----",
      " 5 files changed, 14 insertions(+), 14 deletions(-)",
    ].join("\n");

    // First call: git diff --stat
    mockBash.mockResolvedValueOnce({ output: statOutput, exitCode: 0 });

    // Next 5 calls: per-file diffs
    for (let i = 0; i < 5; i++) {
      mockBash.mockResolvedValueOnce({
        output: `diff --git a/src/file${i}.ts b/src/file${i}.ts\n+change${i}\n`,
        exitCode: 0,
      });
    }

    mockParallelResearch.mockResolvedValueOnce([
      { question: "", response: "Summary A", model: "fast", inputTokens: 10, outputTokens: 5 },
      { question: "", response: "Summary B", model: "fast", inputTokens: 10, outputTokens: 5 },
      { question: "", response: "Summary C", model: "fast", inputTokens: 10, outputTokens: 5 },
      { question: "", response: "Summary D", model: "fast", inputTokens: 10, outputTokens: 5 },
      { question: "", response: "Summary E", model: "fast", inputTokens: 10, outputTokens: 5 },
    ]);

    const result = await orient(1000, true);
    expect(result.hasChanges).toBe(true);
    expect(result.diffSummary).toContain("Per-file summaries");
    expect(result.diffSummary).toContain("Summary A");
    expect(result.diffSummary).toContain("src/a.ts");
    expect(mockParallelResearch).toHaveBeenCalledOnce();
    // Verify it was called with "fast" model and 256 maxTokens
    expect(mockParallelResearch).toHaveBeenCalledWith(
      expect.any(Array),
      "fast",
      256,
    );
  });

  it("falls back to raw diff when parallelResearch throws", async () => {
    const statOutput = [
      " src/a.ts | 5 ++---",
      " src/b.ts | 3 +--",
      " src/c.ts | 8 ++++----",
      " src/d.ts | 2 +-",
      " src/e.ts | 10 +++++-----",
      " 5 files changed",
    ].join("\n");

    // First call: git diff --stat
    mockBash.mockResolvedValueOnce({ output: statOutput, exitCode: 0 });

    // Per-file diff calls
    for (let i = 0; i < 5; i++) {
      mockBash.mockResolvedValueOnce({ output: `+change${i}`, exitCode: 0 });
    }

    // parallelResearch fails
    mockParallelResearch.mockRejectedValueOnce(new Error("API error"));

    // Fallback: git diff for raw content
    mockBash.mockResolvedValueOnce({
      output: "diff --git a/src/a.ts b/src/a.ts\n+some change\n",
      exitCode: 0,
    });

    const result = await orient(1000, true);
    expect(result.hasChanges).toBe(true);
    // Should fall back to raw diff, not summaries
    expect(result.diffSummary).toContain("Diff (src only)");
    expect(result.diffSummary).not.toContain("Per-file summaries");
  });

  it("skips parallelResearch when useSubagentSummaries is false", async () => {
    const statOutput = [
      " src/a.ts | 5 ++---",
      " src/b.ts | 3 +--",
      " src/c.ts | 8 ++++----",
      " src/d.ts | 2 +-",
      " src/e.ts | 10 +++++-----",
      " 5 files changed",
    ].join("\n");

    mockBash.mockResolvedValueOnce({ output: statOutput, exitCode: 0 });
    mockBash.mockResolvedValueOnce({ output: "raw diff content", exitCode: 0 });

    const result = await orient(1000, false);
    expect(result.hasChanges).toBe(true);
    expect(result.diffSummary).toContain("Diff (src only)");
    expect(mockParallelResearch).not.toHaveBeenCalled();
  });
});

describe("formatOrientation", () => {
  it("returns empty string when no changes", () => {
    const report: OrientationReport = { diffSummary: null, hasChanges: false, error: null, metricsSummary: null };
    expect(formatOrientation(report)).toBe("");
  });

  it("formats changes with header", () => {
    const report: OrientationReport = {
      diffSummary: "src/agent.ts | 5 ++---",
      hasChanges: true,
      error: null,
      metricsSummary: null,
    };
    const result = formatOrientation(report);
    expect(result).toContain("## Orientation");
    expect(result).toContain("src/agent.ts");
  });

  it("includes metrics summary when present", () => {
    const report: OrientationReport = {
      diffSummary: null,
      hasChanges: false,
      error: null,
      metricsSummary: "avg 10 turns | LOC stalls: 0",
    };
    const result = formatOrientation(report);
    expect(result).toContain("## Metrics Summary");
    expect(result).toContain("avg 10 turns");
  });
});

describe("readExpertBreadcrumbs", () => {
  const tmpDir = join("/tmp", "orient-breadcrumbs-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  it("returns null when memory.md does not exist", () => {
    const result = readExpertBreadcrumbs("Engineer", tmpDir);
    expect(result).toBeNull();
  });

  it("returns null for unknown expert name", () => {
    writeFileSync(join(tmpDir, "memory.md"), "[Architect] some note\n[Engineer] other note\n");
    const result = readExpertBreadcrumbs("Unknown", tmpDir);
    expect(result).toBeNull();
  });

  it("Engineer sees [Architect] and [Next for Engineer] entries", () => {
    writeFileSync(
      join(tmpDir, "memory.md"),
      [
        "## Some section",
        "[Architect] Designed the new pipeline.",
        "[Engineer] Built the pipeline.",
        "[Next for Engineer] Add tests for the pipeline.",
        "## Another section",
        "[Architect] Review the tests.",
      ].join("\n")
    );
    const result = readExpertBreadcrumbs("Engineer", tmpDir);
    expect(result).not.toBeNull();
    expect(result).toContain("[Architect]");
    expect(result).toContain("[Next for Engineer]");
    // Should NOT include [Engineer] entries (those are for Architect)
    expect(result).not.toContain("Built the pipeline");
  });

  it("Architect sees [Engineer] entries", () => {
    writeFileSync(
      join(tmpDir, "memory.md"),
      [
        "[Architect] Designed the new pipeline.",
        "[Engineer] Built the pipeline.",
        "[Engineer] Added 10 tests.",
      ].join("\n")
    );
    const result = readExpertBreadcrumbs("Architect", tmpDir);
    expect(result).not.toBeNull();
    expect(result).toContain("[Engineer]");
    expect(result).toContain("Added 10 tests");
    expect(result).not.toContain("Designed the new pipeline");
  });

  it("Meta sees both [Architect] and [Engineer] entries", () => {
    writeFileSync(
      join(tmpDir, "memory.md"),
      [
        "[Architect] Designed the new pipeline.",
        "[Engineer] Built the pipeline.",
      ].join("\n")
    );
    const result = readExpertBreadcrumbs("Meta", tmpDir);
    expect(result).not.toBeNull();
    expect(result).toContain("[Architect]");
    expect(result).toContain("[Engineer]");
  });

  it("returns null when memory.md has no matching tagged entries", () => {
    writeFileSync(join(tmpDir, "memory.md"), "## No tagged entries here\nJust plain text.\n");
    const result = readExpertBreadcrumbs("Engineer", tmpDir);
    expect(result).toBeNull();
  });

  it("limits output to last 3 matching lines", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `[Architect] Entry ${i + 1}.`);
    writeFileSync(join(tmpDir, "memory.md"), lines.join("\n"));
    const result = readExpertBreadcrumbs("Engineer", tmpDir);
    expect(result).not.toBeNull();
    const resultLines = result!.split("\n");
    expect(resultLines.length).toBe(3);
    expect(result).toContain("Entry 10");
    expect(result).toContain("Entry 9");
    expect(result).toContain("Entry 8");
    expect(result).not.toContain("Entry 7.");
  });
});

describe("formatOrientation with expertName", () => {
  const tmpDir = join("/tmp", "orient-expert-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  it("appends Expert Context section when expertName matches memory entries", () => {
    writeFileSync(
      join(tmpDir, "memory.md"),
      "[Architect] Add expert-aware orientation.\n"
    );
    const report: OrientationReport = { diffSummary: null, hasChanges: false, error: null, metricsSummary: null };
    const result = formatOrientation(report, "Engineer", tmpDir);
    expect(result).toContain("## Expert Context (Engineer)");
    expect(result).toContain("[Architect] Add expert-aware orientation.");
  });

  it("omits Expert Context section when memory.md missing (no crash)", () => {
    const report: OrientationReport = { diffSummary: null, hasChanges: false, error: null, metricsSummary: null };
    const result = formatOrientation(report, "Engineer", tmpDir);
    expect(result).not.toContain("## Expert Context");
    expect(result).toBe("");
  });

  it("omits Expert Context section when no expertName provided", () => {
    writeFileSync(join(tmpDir, "memory.md"), "[Architect] Some note.\n");
    const report: OrientationReport = { diffSummary: null, hasChanges: false, error: null, metricsSummary: null };
    const result = formatOrientation(report);
    expect(result).not.toContain("## Expert Context");
  });
});
