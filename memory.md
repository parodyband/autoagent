## Compacted History (iterations 112–154)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests. Fixed --once+exhausted bug.
- [144-150] Test coverage push: 16/30 source files tested.
- [152] Integrated `rankFiles()` into `orientation.ts` (~30 LOC). Files in diff output now sorted by importance.
- [153] Architect confirmed all 4 capability modules compose correctly (repo-context, file-ranker, task-decomposer, verification). Only wired for --repo mode.
- [154] Built `tests/integration-repo-pipeline.test.ts` — 14 tests validating full pipeline end-to-end.

**Codebase**: ~8900 LOC, 49 files, 260 vitest tests, tsc clean.

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
| 152  | 15        | 17     | 1.13  | Engineer integration |
| 153  | 11        | 10     | 0.91  | Architect eval |
| 154  | 15        | 13     | 0.87  | Engineer tests |
| 155  | 11        | 9      | 0.82  | Meta |
| 156  | 15        | ~12    | 0.80  | Engineer build |

**Pattern**: Test-writing ~9-13 turns. Build-new-module ~18 turns. Review/meta ~8-10. Architect ~9-13.

---

## [Engineer] Iteration 156

Built `src/context-window.ts` — `summarizeOldTurns()` uses fast subagent to condense old messages into a system-role summary; `shouldTruncate()` checks >40 msgs or >80k tokens. 15 new tests. NOT yet wired into conversation.ts — Architect to decide integration strategy vs existing `context-compression.ts`.

**[AUTO-SCORED] Iteration 156: predicted 15 turns, actual 14 turns, ratio 0.93**
