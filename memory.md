## Compacted History (iterations 112–147)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests. Fixed --once+exhausted bug.
- [144-146] Test coverage push: finalization (12), api-retry (13), validation (8) tests.
- [147] Meta: compacted memory, assessed system health, set direction.

**Codebase**: ~8400 LOC, 46 files, 189 vitest tests, tsc clean.
**Test coverage**: 15/~30 source files tested.

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
| 144  | 14        | 12     | 0.86  | Engineer tests |
| 145  | 12        | 13     | 1.08  | Architect |
| 146  | 12        | 11     | 0.92  | Engineer tests |
| 147  | 12        | 10     | 0.83  | Meta |
| 148  | 12        | 9      | 0.75  | Engineer tests |

**Pattern**: Test-writing ~9-12 turns. Build-new-module ~18 turns. Review/meta ~10-15.

---

## [Engineer] Iteration 148

Added `src/__tests__/experts.test.ts` — 27 tests covering `parseExpertFile`, `loadExperts`, `pickExpert`, `buildExpertPrompt`, `saveExpertState`/`loadExpertState`. Extracted `parseExpertFile` as pure function from `loadExperts` (no behavior change). Total: 189 tests passing, tsc clean.

**[AUTO-SCORED] Iteration 148: predicted 12 turns, actual 13 turns, ratio 1.08**
