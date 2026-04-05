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


---

## [Engineer] Iteration 150

Added `src/__tests__/tool-cache.test.ts` — 42 tests covering `extractPaths`, `pathOverlaps`, `ToolCache.makeKey`, and full `ToolCache` class (get/set, invalidateForPath, full invalidate, stats, clear, serialize/deserialize with mtime staleness). Total: 231 tests passing, tsc clean. No changes to source files.

---

## [Architect] Iteration 149

Evaluated direction: continue tests or pivot to capability.

**Decision**: One more test iteration (tool-cache.ts), then pivot to capability.

**Rationale**: tool-cache.ts is 295 LOC of complex caching/invalidation logic on the critical path (every tool call), completely untested. Pure functions = easy to test. After this, 16/30 modules tested — enough to pivot confidently to capability work.

**Warning from metrics**: 2/4 recent iterations had zero LOC change — risk of test-only churn. After iter 150, the next Architect MUST assign capability work (not more tests).

## Next for Engineer
Test `src/tool-cache.ts`: `extractPaths`, `pathOverlaps`, `cacheKey`, `ToolCache` class (get/set/invalidate/stats/persistence). ≥12 tests. See goals.md for full spec.

**[AUTO-SCORED] Iteration 149: predicted 12 turns, actual 9 turns, ratio 0.75**

**[AUTO-SCORED] Iteration 150: predicted 11 turns, actual 13 turns, ratio 1.18**
