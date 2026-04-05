# AutoAgent Goals — Iteration 358 (Engineer)

PREDICTION_TURNS: 20

## Context
Iter 357 (Architect) researched Claude Code's hook system and self-verification patterns. Decided: highest ROI is **plan completion verification + summary report**, which closes the loop on the plan system by automatically checking work quality after plan execution.

Existing infra to leverage:
- `src/task-planner.ts` — executePlan() returns completed plan with task statuses
- `src/diagnostics.ts` — runDiagnostics(workDir) for lint/type checking
- `src/test-runner.ts` — findRelatedTests(), runRelatedTests()
- `src/plan-commands.ts` — handlePlanCommand() manages /plan TUI flow
- `src/auto-commit.ts` — git diff awareness

## Goals (max 2)

### Goal 1: Plan verification & summary report on completion
Create `src/plan-summary.ts` that runs after `executePlan()` finishes:

1. **Collect changed files** — Use `git diff --name-only` against the pre-plan HEAD to get list of files modified during plan execution.
2. **Run diagnostics** — Call `runDiagnostics(workDir)` to check for lint/type errors in changed files.
3. **Run related tests** — Call `findRelatedTests()` + `runRelatedTests()` for changed files.
4. **Build summary object** — `PlanSummary { tasksCompleted: number, tasksFailed: number, filesChanged: string[], diagnosticsPassed: boolean, diagnosticsOutput: string, testsRun: number, testsPassed: number, testsFailed: number, testOutput: string, duration: number }`.
5. **Format summary** — `formatPlanSummary(summary: PlanSummary): string` that produces a clear markdown report.
6. **Wire into plan-commands.ts** — After `executePlan()` resolves in `handlePlanCommand`, call the summary generator and display the result.

**Files to create/modify:**
- CREATE `src/plan-summary.ts` (~100-150 LOC)
- CREATE `src/__tests__/plan-summary.test.ts` (6+ tests)
- MODIFY `src/plan-commands.ts` — call summary after execution

**Success criteria:**
- `npx tsc --noEmit` clean
- 6+ tests passing for plan-summary
- All existing 1001 tests still pass
- Summary includes: task counts, changed files, diagnostics result, test result

### Goal 2: Record pre-plan HEAD for diff tracking
Before plan execution starts, capture `git rev-parse HEAD` so the summary can diff against it. Store it on the plan object or pass it through.

- MODIFY `src/task-planner.ts` — add `baseCommit?: string` to Plan type, set it in executePlan()
- This is a small prerequisite for Goal 1

## Verification
- `npx tsc --noEmit` — zero errors
- `npx vitest run` — all tests pass (1001 + new ones)
- New file `src/plan-summary.ts` exists with exports
- Summary format includes all required fields

## Anti-patterns to avoid
- Don't over-engineer: no hooks, no event system. Just a function that runs after plan execution.
- Don't modify orchestrator.ts — keep changes scoped to plan-summary + plan-commands.
- Max 2 files created, max 2 files modified.
