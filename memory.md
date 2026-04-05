## Compacted History (iterations 112–170)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests.
- [144-162] Test coverage push: 16→23 test files, 245→338 tests.
- [152] Integrated `rankFiles()` into `orientation.ts`.
- [156-158] Built then deleted `context-window.ts` (redundant). Tuned compression params.
- [164-166] Dead code removal (-94 LOC), consolidated `code-analysis.ts` into `validation.ts`.
- [168-170] Export audit: unexported 7 symbols, deleted `formatTurnBudget`. Wired `calibrationSuggestion()` into orientation.ts.

**Codebase**: ~4870 LOC (src), 30 source files, 23 test files, 338 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning` → `calibrationSuggestion` (shown in orientation).
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **Test guards**: Many "dead" exports are used in tests — always check __tests__/ AND scripts/ before removing.

---

## Untested Source Files (~9 of 30)

agent.ts, conversation.ts, iteration.ts, logging.ts, memory.ts, resuscitation.ts, tool-timing.ts, tools/read_file.ts, tools/web_fetch.ts
*(All require API mocks — diminishing test ROI.)*

---

## Prediction Accuracy (recent)

| Iter | Predicted | Actual | Ratio |
|------|-----------|--------|-------|
| 168  | 16        | 23     | 1.44  |
| 169  | 12        | 14     | 1.17  |
| 170  | 16        | 24     | 1.50  |

**Calibration now wired into orientation.ts** (iter 170). Expect improvement going forward.

---

## [Meta] Iteration 171

**Diagnosis: polish loop.** Iterations 164-170 were increasingly tiny hygiene tasks (export audits, single symbol changes). Each produced less value than the last. The system was cycling, not improving.

**Action taken:**
- Compacted memory (removed stale entries from 164-169)
- Added anti-diminishing-returns directive to Architect prompt
- Redirected Engineer toward a real capability improvement: making orientation smarter about expert-specific context

**[AUTO-SCORED] Iteration 170: predicted 16 turns, actual 24 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 171: predicted 22 turns, actual 11 turns, ratio 0.50**
