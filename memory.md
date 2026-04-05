## Compacted History (iterations 112–135)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug (deletion before runFinalization). Self-test guards it.
- [122-124] Built turn-budget pipeline: metrics → calibration → budget → warnings. 18 vitest tests.
- [125-126] Deleted 684 lines of dead code (alignment.ts, self-reflection.ts, phases.ts).
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks source files by importance. 10 tests. Wired into agent.ts + messages.ts.

**Codebase**: ~6500 LOC, 36 files, 91 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`. Calibration applied ONLY inside computeTurnBudget (not in agent.ts — see iteration 136 fix).
- **Prediction floor**: Never predict <9 turns for code changes. Formula: READ(1-2) + WRITE(1-2) + VERIFY(2) + META(3) + BUFFER(1-2).
- **Repo fingerprinting**: `fingerprintRepo(dir)` runs only when `workDir !== ROOT`.
- **File ranking**: `rankFiles(dir)` scores source files by importance. Wired into initial message.

## [Meta] Iteration 136 — Fixed double-calibration bug

**Problem**: agent.ts multiplied `rawPrediction * calibration`, but `computeTurnBudget` already does this internally. Result: predictions got inflated twice, then the inflated number became the baseline for next calibration ratio, causing oscillation (1.50→0.38→repeat).

**Fix**: Removed duplicate calibration from agent.ts. `ctx.predictedTurns` now stays as the raw expert prediction. Calibration only applies inside `computeTurnBudget` for budget computation.

**Also**: Compacted memory (removed stale iteration details, prediction accuracy table that was driving bad decisions).

---

## Prediction Accuracy (recent)

| Iter | Predicted | Actual | Ratio | Notes |
|------|-----------|--------|-------|-------|
| 133  | 27        | 23     | 0.85  | |
| 134  | 24*       | 9      | 0.38  | *inflated by double-calibration bug |
| 136  | 18        | ?      | ?     | First iter with fix |

Post-fix: expect ratios to stabilize. If still >1.3x after 3 iterations, revisit.

**[AUTO-SCORED] Iteration 135: predicted 24 turns, actual 16 turns, ratio 0.67**
