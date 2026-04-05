import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the external dependencies before importing the module under test
vi.mock("../tools/bash.js", () => ({
  executeBash: vi.fn(),
}));

// Also mock fs.existsSync so we control whether the pre-commit script "exists"
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn(() => false) };
});

import { executeBash } from "../tools/bash.js";
import { validateBeforeCommit, captureCodeQuality, captureBenchmarks } from "../validation.js";
import type { CodebaseAnalysis } from "../validation.js";

const mockExecuteBash = executeBash as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateBeforeCommit", () => {
  it("returns ok:true when tsc exits 0 (pre-commit script skipped)", async () => {
    mockExecuteBash.mockResolvedValueOnce({ exitCode: 0, output: "" });

    const result = await validateBeforeCommit("/fake/root", undefined, {
      skipPreCommitScript: true,
    });

    expect(result.ok).toBe(true);
    expect(result.output).toBe("ok");
    expect(mockExecuteBash).toHaveBeenCalledTimes(1);
    expect(mockExecuteBash.mock.calls[0][0]).toContain("tsc --noEmit");
  });

  it("returns ok:false when tsc exits non-zero", async () => {
    const errorOutput = "src/foo.ts(1,1): error TS2322: Type mismatch";
    mockExecuteBash.mockResolvedValueOnce({ exitCode: 1, output: errorOutput });

    const result = await validateBeforeCommit("/fake/root", undefined, {
      skipPreCommitScript: true,
    });

    expect(result.ok).toBe(false);
    expect(result.output).toBe(errorOutput);
    expect(mockExecuteBash).toHaveBeenCalledTimes(1);
  });

  it("calls logFn with compilation messages", async () => {
    mockExecuteBash.mockResolvedValueOnce({ exitCode: 0, output: "" });
    const logs: string[] = [];

    await validateBeforeCommit("/fake/root", (msg) => logs.push(msg), {
      skipPreCommitScript: true,
    });

    expect(logs.some((l) => l.includes("tsc"))).toBe(true);
    expect(logs.some((l) => l.includes("Compilation OK"))).toBe(true);
  });

  it("skips pre-commit-check.sh when skipPreCommitScript is true", async () => {
    mockExecuteBash.mockResolvedValueOnce({ exitCode: 0, output: "" });

    await validateBeforeCommit("/fake/root", undefined, {
      skipPreCommitScript: true,
    });

    // Only one bash call (tsc), not the pre-commit script
    expect(mockExecuteBash).toHaveBeenCalledTimes(1);
  });
});

describe("captureCodeQuality", () => {
  it("returns a snapshot from analyzeCodebase", async () => {
    const fakeAnalysis: CodebaseAnalysis = {
      files: [],
      totals: {
        totalLines: 8000,
        codeLines: 6000,
        fileCount: 45,
        functionCount: 200,
        complexity: 3.5,
        blankLines: 0,
        commentLines: 0,
      },
      averageComplexityPerFunction: 0,
    };
    // grep call for test count
    mockExecuteBash.mockResolvedValueOnce({ exitCode: 0, output: "42\n" });

    const snapshot = await captureCodeQuality("/fake/root", () => fakeAnalysis);

    expect(snapshot).toBeDefined();
    expect(snapshot!.totalLOC).toBe(8000);
    expect(snapshot!.codeLOC).toBe(6000);
    expect(snapshot!.fileCount).toBe(45);
    expect(snapshot!.functionCount).toBe(200);
    expect(snapshot!.complexity).toBe(3.5);
    expect(snapshot!.testCount).toBe(42);
  });

  it("returns undefined if analyzeCodebase throws", async () => {
    const snapshot = await captureCodeQuality("/fake/root", () => {
      throw new Error("analysis failed");
    });

    expect(snapshot).toBeUndefined();
  });
});

describe("captureBenchmarks", () => {
  it("returns timing and test count from successful self-test run", async () => {
    mockExecuteBash.mockResolvedValueOnce({
      exitCode: 0,
      output: "Results: 141 passed, 0 failed",
    });

    const benchmark = await captureBenchmarks("/fake/root");

    expect(benchmark).toBeDefined();
    expect(benchmark!.testCount).toBe(141);
    expect(benchmark!.testDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns undefined when self-test exits non-zero", async () => {
    mockExecuteBash.mockResolvedValueOnce({
      exitCode: 1,
      output: "Tests failed",
    });

    const benchmark = await captureBenchmarks("/fake/root");

    expect(benchmark).toBeUndefined();
  });
});
