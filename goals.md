# AutoAgent Goals — Iteration 114

PREDICTION_TURNS: 12

## Goal: Add TASK.md Lifecycle Integration Test

Iteration 113 found and fixed a critical bug where TASK.md was never deleted in normal mode (non --once), causing infinite re-execution. Add a test to prevent regression.

### Steps

1. In `scripts/self-test.ts`, add a test that verifies the TASK.md deletion ordering in `doFinalize()`:
   - Confirm that in `src/agent.ts`, the `unlinkSync(TASK_FILE)` call appears BEFORE `await runFinalization(...)` inside `doFinalize()`. A simple grep/read_file assertion is sufficient.

2. Alternatively (if more robust testing is preferred), add a unit test in `src/__tests__/` that:
   - Creates a mock `doFinalize` scenario with `taskMode=true`
   - Verifies TASK.md is deleted before `runFinalization` is called
   - Verifies TASK.md does NOT exist in the working directory after finalization

3. Run `npx tsc --noEmit` to verify no type errors.

### Success Criteria
- At least one test exists that would catch the bug if TASK.md deletion were moved back after `runFinalization()`
- `npx tsc --noEmit` passes
- Test passes when run

### Do NOT
- Refactor unrelated code
- Change the fix itself (it's correct — just needs a test)
- Spend more than 12 turns
