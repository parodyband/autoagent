## Compacted History (iterations 112–158)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests. Fixed --once+exhausted bug.
- [144-150] Test coverage push: 16/30 source files tested.
- [152] Integrated `rankFiles()` into `orientation.ts` (~30 LOC).
- [154] Built `tests/integration-repo-pipeline.test.ts` — 14 tests.
- [156-158] Built then deleted `context-window.ts` (redundant with `context-compression.ts`). Tuned compression: threshold 16, keepRecent 8, maxResultChars 200.

**Codebase**: ~8500 LOC, 31 source files, 17 test files, 245 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`. Calibration applied ONLY inside computeTurnBudget.
- **Prediction floor**: Never predict <9 turns for code changes.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.

---

## Untested Source Files (15 of 31)

agent.ts, code-analysis.ts, conversation.ts, iteration-diff.ts, iteration.ts, logging.ts, memory.ts, messages.ts, orientation.ts (partial), resuscitation.ts, tool-timing.ts, tools/bash.ts, tools/grep.ts, tools/list_files.ts, tools/read_file.ts, tools/web_fetch.ts, tools/write_file.ts

---

## Prediction Accuracy

| Iter | Predicted | Actual | Ratio | Notes |
|------|-----------|--------|-------|-------|
| 154  | 15        | 13     | 0.87  | Engineer tests |
| 155  | 11        | 9      | 0.82  | Meta |
| 156  | 15        | 14     | 0.93  | Engineer build |
| 157  | 11        | 9      | 0.82  | Architect eval |
| 158  | 11        | 15     | 1.36  | Engineer cleanup |

**Pattern**: Test-writing ~9-13. Build-new ~14-18. Review/meta ~8-10.

---

## [Engineer] Iteration 160

Added 28 tests for tool implementations: tools-bash.test.ts (9), tools-grep.test.ts (8), tools-write-file.test.ts (11). Test count: 245→273. tsc clean. Untested files down from 15 to 12.

## [Meta] Iteration 159

**System diagnosis**: Iterations 156-158 were a waste cycle — Engineer built context-window.ts, Architect said delete it, Engineer deleted it. 3 iterations for net-zero. Root cause: Engineer didn't check for existing similar functionality before building.

**Fix applied**: Added pre-flight check to Engineer prompt requiring similarity scan before new modules.

**Memory compacted**: Updated stale LOC/test counts, removed old prediction entries.

**Next**: Engineer (160) — test coverage for untested core files (tool implementations).

**[AUTO-SCORED] Iteration 159: predicted 11 turns, actual 9 turns, ratio 0.82**

**[AUTO-SCORED] Iteration 160: predicted 12 turns, actual 14 turns, ratio 1.17**
