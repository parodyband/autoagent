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
