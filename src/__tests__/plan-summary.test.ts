import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChangedFiles, parseTestCounts, formatPlanSummary, generatePlanSummary } from "../plan-summary.js";
import type { PlanSummary } from "../plan-summary.js";
import type { TaskPlan } from "../task-planner.js";

// Mock child_process for getChangedFiles
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

// Mock diagnostics and test-runner
vi.mock("../diagnostics.js", () => ({
  runDiagnostics: vi.fn().mockResolvedValue(null),
}));
vi.mock("../test-runner.js", () => ({
  findRelatedTests: vi.fn().mockReturnValue([]),
  runRelatedTests: vi.fn().mockResolvedValue({ passed: true, output: "" }),
}));

import { execSync } from "child_process";
import { runDiagnostics } from "../diagnostics.js";
import { findRelatedTests, runRelatedTests } from "../test-runner.js";

const mockExecSync = execSync as ReturnType<typeof vi.fn>;
const mockRunDiagnostics = runDiagnostics as ReturnType<typeof vi.fn>;
const mockFindRelatedTests = findRelatedTests as ReturnType<typeof vi.fn>;
const mockRunRelatedTests = runRelatedTests as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getChangedFiles", () => {
  it("returns file list from git diff output", () => {
    mockExecSync.mockReturnValue("src/foo.ts\nsrc/bar.ts\n");
    const files = getChangedFiles("/work", "abc123");
    expect(files).toEqual(["src/foo.ts", "src/bar.ts"]);
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("git diff --name-only abc123"),
      expect.any(Object)
    );
  });

  it("returns empty array when git fails", () => {
    mockExecSync.mockImplementation(() => { throw new Error("not a git repo"); });
    const files = getChangedFiles("/work");
    expect(files).toEqual([]);
  });

  it("filters empty lines", () => {
    mockExecSync.mockReturnValue("\nsrc/foo.ts\n\n");
    const files = getChangedFiles("/work", "HEAD~1");
    expect(files).toEqual(["src/foo.ts"]);
  });
});

describe("parseTestCounts", () => {
  it("parses vitest-style output", () => {
    const output = "Tests  5 passed | 2 failed (7)";
    const { passed, failed } = parseTestCounts(output);
    expect(passed).toBe(5);
    expect(failed).toBe(2);
  });

  it("returns zeros when no matches", () => {
    const { passed, failed } = parseTestCounts("no test info here");
    expect(passed).toBe(0);
    expect(failed).toBe(0);
  });

  it("handles passed-only output", () => {
    const { passed, failed } = parseTestCounts("10 passed");
    expect(passed).toBe(10);
    expect(failed).toBe(0);
  });
});

describe("formatPlanSummary", () => {
  const base: PlanSummary = {
    tasksCompleted: 3,
    tasksFailed: 0,
    filesChanged: ["src/a.ts", "src/b.ts"],
    diagnosticsPassed: true,
    diagnosticsOutput: "",
    testsRun: 2,
    testsPassed: 10,
    testsFailed: 0,
    testOutput: "",
    duration: 5000,
  };

  it("includes duration in header", () => {
    const out = formatPlanSummary(base);
    expect(out).toContain("5.0s");
  });

  it("shows all tasks completed", () => {
    const out = formatPlanSummary(base);
    expect(out).toContain("3/3 tasks completed");
  });

  it("shows failed tasks when present", () => {
    const out = formatPlanSummary({ ...base, tasksFailed: 1, tasksCompleted: 2 });
    expect(out).toContain("2 completed, 1 failed");
  });

  it("shows diagnostics passed", () => {
    const out = formatPlanSummary(base);
    expect(out).toContain("**Diagnostics:** ✅ passed");
  });

  it("shows diagnostics errors", () => {
    const out = formatPlanSummary({ ...base, diagnosticsPassed: false, diagnosticsOutput: "TS2345 error" });
    expect(out).toContain("**Diagnostics:** ❌ errors found");
    expect(out).toContain("TS2345 error");
  });

  it("shows changed files list", () => {
    const out = formatPlanSummary(base);
    expect(out).toContain("src/a.ts");
    expect(out).toContain("src/b.ts");
  });

  it("shows no tests when none found", () => {
    const out = formatPlanSummary({ ...base, testsRun: 0 });
    expect(out).toContain("no related tests found");
  });
});

describe("generatePlanSummary", () => {
  const plan: TaskPlan = {
    goal: "test goal",
    tasks: [
      { id: "1", title: "T1", description: "d1", status: "done", dependsOn: [] },
      { id: "2", title: "T2", description: "d2", status: "failed", dependsOn: [] },
    ],
    createdAt: Date.now(),
    baseCommit: "abc123",
  };

  it("counts completed and failed tasks", async () => {
    mockExecSync.mockReturnValue("");
    const summary = await generatePlanSummary(plan, "/work", Date.now() - 2000);
    expect(summary.tasksCompleted).toBe(1);
    expect(summary.tasksFailed).toBe(1);
  });

  it("includes duration", async () => {
    mockExecSync.mockReturnValue("");
    const start = Date.now() - 3000;
    const summary = await generatePlanSummary(plan, "/work", start);
    expect(summary.duration).toBeGreaterThanOrEqual(3000);
  });

  it("reflects diagnostics pass", async () => {
    mockExecSync.mockReturnValue("");
    mockRunDiagnostics.mockResolvedValue(null);
    const summary = await generatePlanSummary(plan, "/work", Date.now());
    expect(summary.diagnosticsPassed).toBe(true);
    expect(summary.diagnosticsOutput).toBe("");
  });

  it("reflects diagnostics failure", async () => {
    mockExecSync.mockReturnValue("");
    mockRunDiagnostics.mockResolvedValue("[tsc]\nerror TS1234");
    const summary = await generatePlanSummary(plan, "/work", Date.now());
    expect(summary.diagnosticsPassed).toBe(false);
    expect(summary.diagnosticsOutput).toContain("TS1234");
  });

  it("runs related tests for changed files", async () => {
    mockExecSync.mockReturnValue("src/foo.ts\n");
    mockFindRelatedTests.mockReturnValue(["src/__tests__/foo.test.ts"]);
    mockRunRelatedTests.mockResolvedValue({ passed: true, output: "1 passed" });
    const summary = await generatePlanSummary(plan, "/work", Date.now());
    expect(summary.testsRun).toBe(1);
    expect(summary.testsPassed).toBe(1);
    expect(summary.testsFailed).toBe(0);
  });
});
