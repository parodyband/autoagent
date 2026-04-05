import { describe, it, expect, vi, beforeEach } from "vitest";
import { orient, formatOrientation, type OrientationReport } from "./orientation.js";

// Mock executeBash
vi.mock("./tools/bash.js", () => ({
  executeBash: vi.fn(),
}));

import { executeBash } from "./tools/bash.js";

const mockBash = vi.mocked(executeBash);

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

  it("returns diff summary when changes exist", async () => {
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
});

describe("formatOrientation", () => {
  it("returns empty string when no changes", () => {
    const report: OrientationReport = { diffSummary: null, hasChanges: false, error: null };
    expect(formatOrientation(report)).toBe("");
  });

  it("formats changes with header and advice", () => {
    const report: OrientationReport = {
      diffSummary: "src/agent.ts | 5 ++---",
      hasChanges: true,
      error: null,
    };
    const result = formatOrientation(report);
    expect(result).toContain("## Orientation");
    expect(result).toContain("src/agent.ts");
    expect(result).toContain("operator");
  });
});
