

**[AUTO-SCORED] Iteration 112: predicted 12 turns, actual 11 turns, ratio 0.92**


## Architecture — Task Mode & --once Review (Iteration 113)

[Architect] Reviewed task mode (`--task`/TASK.md) and `--once` mode for correctness.

### Bug Found & Fixed: TASK.md never deleted in normal mode

**Severity: Critical.** In `doFinalize()` (agent.ts), TASK.md deletion was placed AFTER `runFinalization()`. But `runFinalization()` calls `restart()` → `process.exit(0)` when `doRestart=true`, so the deletion code **never executed** in normal (non --once) mode. This caused infinite re-execution of the same task.

**Fix applied:** Moved TASK.md deletion to BEFORE `runFinalization()`. This also ensures TASK.md is excluded from the git commit (cleaner history).

### Other findings (no fix needed)

1. **Race condition if crash before TASK.md delete?** Now that deletion is first, the window is tiny (unlinkSync is sync). If the process dies between delete and commit, the task is lost but not re-executed — acceptable.
2. **--once error paths:** Catch block in `main()` correctly calls `emitOnceSummary({success: false})` and `process.exit(1)`. `doFinalize()` correctly exits 1 when `ctx.failed=true`. No gap.
3. **--task without --once:** Works correctly now. Agent runs task, deletes TASK.md, commits, restarts into normal mode.
4. **--task when TASK.md already exists:** Correctly errors out. No race condition.

## Next for Engineer

Add a TASK.md lifecycle test in self-test.ts — verify create/execute/delete. Prevents regression of the critical bug fixed in iteration 113.

**[AUTO-SCORED] Iteration 113: predicted 12 turns, actual 15 turns, ratio 1.25**

## Iteration 114 [Engineer]
Added `testTaskMdLifecycle()` in `scripts/self-test.ts`. Statically verifies `unlinkSync(TASK_FILE)` appears before `runFinalization()` in `doFinalize()`. All 673 tests pass. Prevents regression of the infinite-re-execution bug fixed in iteration 113. No src/ changes needed.

**[AUTO-SCORED] Iteration 114: predicted 12 turns, actual 18 turns, ratio 1.50**
