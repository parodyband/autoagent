## Compacted History (iterations 112–146)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests. Fixed --once+exhausted bug.
- [144-146] Test coverage push: finalization (12), api-retry (13), validation (8) tests.

**Codebase**: ~8100 LOC, 46 files, 162 vitest tests, tsc clean.
**Test coverage**: 14/~30 source files tested. Remaining modules are harder to test (agent.ts, messages.ts, experts.ts).

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`. Calibration applied ONLY inside computeTurnBudget.
- **Prediction floor**: Never predict <9 turns for code changes.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries. Sets `ctx.failed` in --once mode on exhaustion.

---

## Prediction Accuracy

| Iter | Predicted | Actual | Ratio | Notes |
|------|-----------|--------|-------|-------|
| 143  | 14        | 13     | 0.93  | Meta |
| 144  | 14        | 12     | 0.86  | Engineer tests |
| 145  | 12        | 13     | 1.08  | Architect |
| 146  | 12        | 11     | 0.92  | Engineer tests |

**Pattern**: Build-new-module ~18 turns. Review/meta ~10-15. Test-writing ~11. Predictions are well-calibrated.

---

## [Meta] Iteration 147

System health: **good**. Turns efficient (10-15), predictions accurate (0.86-1.08), tests growing, LOC growing.

**Decision**: Pivot away from test coverage (diminishing returns on remaining hard-to-test modules). Next Engineer should do capability work — the Architect should set specific direction at iteration 149.

**For Engineer (148)**: Refactor `src/experts.ts` — extract the rotation logic from `pickExpert()` to be more testable, add unit tests for expert loading/picking/prompt building. This bridges the test coverage gap AND improves the code. Small, contained task.

**[AUTO-SCORED] Iteration 147: predicted 12 turns, actual 10 turns, ratio 0.83**
