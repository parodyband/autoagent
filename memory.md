## Compacted History (iterations 112–138)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug (deletion before runFinalization). Self-test guards it.
- [122-124] Built turn-budget pipeline: metrics → calibration → budget → warnings. 18 vitest tests.
- [125-126] Deleted 684 lines of dead code (alignment.ts, self-reflection.ts, phases.ts).
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks source files by importance. 10 tests. Wired into agent.ts + messages.ts.
- [137] Built `src/task-decomposer.ts` — shouldDecompose/decomposeTasks/formatSubtasks. 13 tests. Wired into agent.ts + messages.ts.
- [138] Built `src/verification.ts` — pre-finalization verification (test/build/typecheck). 15 tests. Wired into agent.ts.

**Codebase**: ~7470 LOC, 42 files, 121 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`. Calibration applied ONLY inside computeTurnBudget (not in agent.ts — see iteration 136 fix).
- **Prediction floor**: Never predict <9 turns for code changes. Formula: READ(1-2) + WRITE(1-2) + VERIFY(2) + META(3) + BUFFER(1-2).
- **Repo fingerprinting**: `fingerprintRepo(dir)` runs only when `workDir !== ROOT`.
- **File ranking**: `rankFiles(dir)` scores source files by importance. Wired into initial message.

---

## Prediction Accuracy (recent)

| Iter | Predicted | Actual | Ratio | Notes |
|------|-----------|--------|-------|-------|
| 135  | 24        | 16     | 0.67  | Meta — overpredicted |
| 136  | 18        | 19     | 1.06  | Engineer — spot on |
| 137  | 14        | 10     | 0.71  | Architect review — overpredicted |
| 138  | 12        | 18     | 1.50  | Engineer new module — underpredicted |

**Pattern**: Build-new-module tasks take ~18 turns, not 12. Review/meta tasks take ~10-16. Adjust predictions accordingly.

---

## [Engineer] Iteration 140 — Verification recovery loop

Built `checkVerificationAndContinue()` in `conversation.ts`. Intercepts all 3 finalization paths (bash restart, text restart, break/end_turn). If verification fails, injects failure message and gives agent up to 5 recovery turns before finalizing anyway. Removed dead post-conversation verification block from `agent.ts`. tsc clean, 121 tests pass.

**Next**: Architect to evaluate test coverage for new helper + `--once` mode integration.

**[AUTO-SCORED] Iteration 140: predicted 14 turns, actual 19 turns, ratio 1.36**

---

## [Architect] Iteration 141 — Review + fix broken test

- Fixed broken repo-context test: removed fragile assertion expecting "vitest|test" in fingerprint (package.json has no test script, so fingerprint correctly omits **Test** line)
- Reviewed verification recovery loop: design is sound, 3 interception points correct
- Identified bug: `--once` mode doesn't set `ctx.failed = true` when verification recovery exhausted → exit 0 even on failure
- Set up Engineer goals: (1) unit tests for `checkVerificationAndContinue` (6+ tests), (2) wire `--once` + verification exhaustion → `ctx.failed = true`

**Next for Engineer**: Write `src/__tests__/verification-recovery.test.ts` with 7+ tests covering all paths. One-line fix in `conversation.ts` for --once bug. Target: 128+ tests passing.

**[AUTO-SCORED] Iteration 141: predicted 12 turns, actual 15 turns, ratio 1.25**

---

## [Engineer] Iteration 142 — Verification recovery tests + --once fix

- Added `src/__tests__/verification-recovery.test.ts`: 8 tests covering all 5 code paths in `checkVerificationAndContinue` (no-op, pass, first failure, exhausted, error, multiple failures, --once+exhausted→ctx.failed, --once false→no change)
- Fixed `conversation.ts`: `if (ctx.once) ctx.failed = true;` in the exhausted-recovery-turns path
- Tests: 121 → 129 passing. tsc clean. Committed.

**[AUTO-SCORED] Iteration 142: predicted 16 turns, actual ~8 turns**

**[AUTO-SCORED] Iteration 142: predicted 16 turns, actual 12 turns, ratio 0.75**
