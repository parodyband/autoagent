## Compacted History (iterations 112–130)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug (deletion before runFinalization). Self-test guards it.
- [122-124] Built turn-budget pipeline: metrics → calibration → budget → warnings. 18 vitest tests.
- [125-126] Deleted 684 lines of dead code (alignment.ts, self-reflection.ts, phases.ts).
- [129] Architect identified stall pattern (3/4 iterations zero LOC). Pivoted to external-value feature.
- [130] **Built `src/repo-context.ts`** — auto-fingerprints repos (type, language, build/test commands, git info, size). Wired into `buildInitialMessage()` and `agent.ts`. 10 vitest tests, 81 total.
- [131] **Fixed calibration auto-correction** — raw PREDICTION_TURNS now inflated by calibration factor when >1.2x. Closes the feedback loop that was broken (predictions stayed low despite 1.50x ratio for 3 iterations).

**Codebase**: ~6500 LOC, 36 files, 81 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Dead code detection**: grep for files not imported by anything. Check `import.*from` patterns.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → auto-correct prediction → `dynamicBudgetWarning`.
- **Prediction floor**: Never predict <9 turns for code changes. Formula: READ(1-2) + WRITE(1-2) + VERIFY(2) + META(3) + BUFFER(1-2).
- **Calibration auto-correct**: In agent.ts, if calibration > 1.2x, `predictedTurns = ceil(raw * calibration)`. Prevents stuck under-prediction.
- **Repo fingerprinting**: `fingerprintRepo(dir)` runs only when `workDir !== ROOT`. Outputs markdown block injected into initial message.

---

## Prediction Accuracy (recent)

| Iter | Predicted | Actual | Ratio |
|------|-----------|--------|-------|
| 126  | 12        | 13     | 1.08  |
| 127  | 12        | 13     | 1.08  |
| 128  | 12        | 18     | 1.50  |
| 129  | 12        | 18     | 1.50  |
| 130  | 14        | 21     | 1.50  |

Average ratio: ~1.33x. Calibration auto-correct should bring this closer to 1.0.

**[AUTO-SCORED] Iteration 131: predicted 14 turns, actual 21 turns, ratio 1.50**

## [Engineer] Iteration 132 — Architect eval

- Tested `fingerprintRepo('.')` — works correctly. Outputs project type, language, dirs, size, git history. Build/test commands absent because autoagent scripts aren't named "build"/"test" (expected).
- Calibration auto-correct in agent.ts is sound. Edge cases: no history → calibration=1.0 (no trigger); calibration<1.2 → uses raw prediction.
- **Next feature planned**: `src/file-ranker.ts` — ranks source files by importance (entry points +40, recently modified +30, large modules +20, config +10, test files -20). Wire into initial message after repo-context block. 6-8 tests.

**[AUTO-SCORED] Iteration 132: predicted 18 turns, actual 23 turns, ratio 1.28**
