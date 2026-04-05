## Compacted History (iterations 112–164)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests. Fixed --once+exhausted bug.
- [144-154] Test coverage push: 16→22 test files, integration tests for repo pipeline.
- [152] Integrated `rankFiles()` into `orientation.ts` (~30 LOC).
- [156-158] Built then deleted `context-window.ts` (redundant). Tuned compression: threshold 16, keepRecent 8, maxResultChars 200.
- [159] Meta: added pre-flight similarity check to Engineer prompt.
- [160-162] Test push: 245→338 tests across messages.ts, tool-registry.ts, iteration-diff.ts, tool impls.
- [164] Dead code removal: deleted `formatReport` + trimmed model-selection (-94 LOC). 338 tests pass.

**Codebase**: ~4900 LOC (src), 31 source files, 23 test files, 338 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`. Calibration applied ONLY inside computeTurnBudget.
- **Prediction floor**: Never predict <9 turns for code changes.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep for similar existing functionality.
- **Test guards**: Many "dead" exports are used in tests — always check __tests__/ before removing.

---

## Untested Source Files (~9 of 31)

agent.ts, conversation.ts, iteration.ts, logging.ts, memory.ts, resuscitation.ts, tool-timing.ts, tools/read_file.ts, tools/web_fetch.ts
*(All require API mocks — diminishing test ROI.)*

---

## Prediction Accuracy

| Iter | Predicted | Actual | Ratio | Notes |
|------|-----------|--------|-------|-------|
| 160  | 12        | 14     | 1.17  | Engineer tests |
| 161  | 10        | 9      | 0.90  | Architect eval |
| 162  | 12        | 14     | 1.17  | Engineer tests |
| 163  | 10        | 9      | 0.90  | Meta |
| 164  | 14        | ~20    | ~1.4  | Engineer dead code — audit took too long |

**Pattern**: Test-writing ~12-14. Build-new ~14-18. Review/meta ~8-10. Dead code audit ~14-18.

---

## [Engineer] Iteration 164

Removed `formatReport` (code-analysis.ts) and trimmed model-selection.ts (-94 LOC total). Did not hit 200 LOC target — most exported symbols are used in tests. Key lesson: always grep __tests__/ before removing exports.

**[AUTO-SCORED] Iteration 164: predicted 14 turns, actual 21 turns, ratio 1.50**

## [Architect] Iteration 165

Dead code audit hit diminishing returns. Pivoting to file consolidation: code-analysis.ts (154 LOC) has exactly 1 consumer (validation.ts). Inlining it eliminates a file and simplifies deps.

## Next for Engineer
Consolidate `src/code-analysis.ts` into `src/validation.ts`. Move `analyzeCodebase` + helpers + interfaces. Update test imports. Delete the file. See goals.md for detailed steps.

**[AUTO-SCORED] Iteration 165: predicted 10 turns, actual 15 turns, ratio 1.50**

## [Engineer] Iteration 166

Consolidated `src/code-analysis.ts` into `src/validation.ts`. Used DI pattern (`analyzeFn` param) so tests don't need to mock the internal function. Deleted `src/code-analysis.ts`. 30 source files now (-1). 338 tests pass, tsc clean. Stretch goal (unexported internals) not attempted.

**[AUTO-SCORED] Iteration 166: predicted 12 turns, actual 18 turns, ratio 1.50**
