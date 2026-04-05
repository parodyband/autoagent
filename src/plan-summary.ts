/**
 * Plan completion summary — verifies work quality after executePlan() finishes.
 *
 * Collects changed files (via git diff), runs diagnostics, runs related tests,
 * and formats a markdown summary report.
 */

import { execSync } from "child_process";
import { runDiagnostics } from "./diagnostics.js";
import { findRelatedTests, runRelatedTests } from "./test-runner.js";
import type { TaskPlan } from "./task-planner.js";

export interface PlanSummary {
  tasksCompleted: number;
  tasksFailed: number;
  filesChanged: string[];
  diagnosticsPassed: boolean;
  diagnosticsOutput: string;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  testOutput: string;
  duration: number; // milliseconds
}

/**
 * Get files changed since a given git commit (or HEAD~1 if no commit given).
 * Returns empty array if git is unavailable or the repo has no history.
 */
export function getChangedFiles(workDir: string, baseCommit?: string): string[] {
  const ref = baseCommit ?? "HEAD";
  try {
    const output = execSync(`git diff --name-only ${ref} 2>/dev/null`, {
      cwd: workDir,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    // No git, no history, or ref not found
    return [];
  }
}

/**
 * Parse test counts from test runner output.
 * Looks for patterns like "5 passed" / "2 failed" from vitest/jest output.
 */
export function parseTestCounts(output: string): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  // Vitest: "5 passed" or "3 failed" (may appear multiple times; take first match)
  const passedMatch = output.match(/(\d+)\s+passed/);
  const failedMatch = output.match(/(\d+)\s+failed/);

  if (passedMatch) passed = parseInt(passedMatch[1], 10);
  if (failedMatch) failed = parseInt(failedMatch[1], 10);

  return { passed, failed };
}

/**
 * Generate a PlanSummary after plan execution completes.
 *
 * @param plan      The completed TaskPlan (with task statuses)
 * @param workDir   Working directory
 * @param startedAt Timestamp (ms) when plan execution started
 */
export async function generatePlanSummary(
  plan: TaskPlan,
  workDir: string,
  startedAt: number
): Promise<PlanSummary> {
  const duration = Date.now() - startedAt;

  const tasksCompleted = plan.tasks.filter((t) => t.status === "done").length;
  const tasksFailed = plan.tasks.filter((t) => t.status === "failed").length;

  // Collect changed files using the base commit captured before execution
  const filesChanged = getChangedFiles(workDir, plan.baseCommit);

  // Run diagnostics
  let diagnosticsOutput = "";
  let diagnosticsPassed = true;
  try {
    const diagResult = await runDiagnostics(workDir);
    if (diagResult !== null) {
      diagnosticsPassed = false;
      diagnosticsOutput = diagResult;
    }
  } catch {
    // Non-fatal — diagnostics failing shouldn't block the summary
  }

  // Run related tests
  let testsRun = 0;
  let testsPassed = 0;
  let testsFailed = 0;
  let testOutput = "";
  try {
    const testFiles = findRelatedTests(workDir, filesChanged);
    testsRun = testFiles.length;
    if (testsRun > 0) {
      const result = await runRelatedTests(workDir, testFiles);
      testOutput = result.output;
      const counts = parseTestCounts(result.output);
      testsPassed = counts.passed;
      testsFailed = counts.failed;
      if (!result.passed && testsFailed === 0) {
        // runner exited non-zero but couldn't parse specific failures
        testsFailed = 1;
      }
    }
  } catch {
    // Non-fatal
  }

  return {
    tasksCompleted,
    tasksFailed,
    filesChanged,
    diagnosticsPassed,
    diagnosticsOutput,
    testsRun,
    testsPassed,
    testsFailed,
    testOutput,
    duration,
  };
}

/**
 * Format a PlanSummary into a readable markdown report.
 */
export function formatPlanSummary(summary: PlanSummary): string {
  const lines: string[] = [];

  const durationSec = (summary.duration / 1000).toFixed(1);
  lines.push(`## Plan Summary (${durationSec}s)`);
  lines.push("");

  // Task counts
  const taskTotal = summary.tasksCompleted + summary.tasksFailed;
  const taskStatus =
    summary.tasksFailed === 0
      ? `✅ ${summary.tasksCompleted}/${taskTotal} tasks completed`
      : `⚠️  ${summary.tasksCompleted} completed, ${summary.tasksFailed} failed (of ${taskTotal})`;
  lines.push(`**Tasks:** ${taskStatus}`);

  // Changed files
  if (summary.filesChanged.length > 0) {
    lines.push(`**Files changed:** ${summary.filesChanged.length}`);
    for (const f of summary.filesChanged) {
      lines.push(`  - ${f}`);
    }
  } else {
    lines.push(`**Files changed:** none detected`);
  }

  lines.push("");

  // Diagnostics
  if (summary.diagnosticsPassed) {
    lines.push("**Diagnostics:** ✅ passed");
  } else {
    lines.push("**Diagnostics:** ❌ errors found");
    if (summary.diagnosticsOutput) {
      lines.push("```");
      lines.push(summary.diagnosticsOutput.slice(0, 1000));
      lines.push("```");
    }
  }

  // Tests
  if (summary.testsRun === 0) {
    lines.push("**Tests:** no related tests found");
  } else if (summary.testsFailed === 0) {
    lines.push(
      `**Tests:** ✅ ${summary.testsPassed} passed (${summary.testsRun} test file${summary.testsRun !== 1 ? "s" : ""} run)`
    );
  } else {
    lines.push(
      `**Tests:** ❌ ${summary.testsFailed} failed, ${summary.testsPassed} passed`
    );
    if (summary.testOutput) {
      lines.push("```");
      lines.push(summary.testOutput.slice(0, 1000));
      lines.push("```");
    }
  }

  return lines.join("\n");
}
