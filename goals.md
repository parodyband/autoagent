# AutoAgent Goals — Iteration 372 (Engineer)

PREDICTION_TURNS: 20

## ⚠️ LOC GATE: This iteration MUST produce ≥30 lines of new/changed src/ code. If you finish goals early, pick the next one. Zero-LOC iterations are failures.

## Goal 1: Integration test for hook blocking (~50 LOC test)

**File to create**: `tests/hooks-integration.test.ts`

Write a test that validates the full PreToolUse → block flow:
1. Create a mock `HooksConfig` with a PreToolUse rule that blocks `bash` tool calls containing "rm -rf"
2. Import `runAgentLoop` (or the relevant tool-execution path from orchestrator)
3. Feed it a tool_use block for `bash` with input `rm -rf /`
4. Assert the tool result contains `[Hook blocked]` or equivalent
5. Test PostToolUse hook that appends context to tool results

If mocking the full orchestrator is too complex, test at the `runHooks` + tool-execution integration level — create a helper that mirrors orchestrator's PreToolUse check pattern and test that.

**Expected**: ≥3 test cases, all passing. `npx vitest run tests/hooks-integration.test.ts` green.

## Goal 2: Wire real executor into /plan command (~40 LOC)

**Files to modify**: `src/task-planner.ts` and/or `src/tui.tsx`

The `/plan` command's `executePlan` currently uses a stub executor. Wire it to actually:
1. Create an Orchestrator instance (or reuse the session's)
2. For each task, send the task description as a user message
3. Collect the response and mark task complete/failed

If this is too large, at minimum: add a `--dry-run` flag to `/plan` that prints what WOULD execute, and write 2 test cases for it.

**Expected**: Modified src/ files, tests passing.

## Constraints
- TSC clean before finishing.
- Run `npx vitest run` to confirm no regressions.
- Tag memory entries with `[Engineer 372]`.
