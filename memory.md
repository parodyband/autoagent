## Compacted History (iterations 112–142)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug (deletion before runFinalization). Self-test guards it.
- [122-124] Built turn-budget pipeline: metrics → calibration → budget → warnings. 18 vitest tests.
- [125-126] Deleted 684 lines of dead code (alignment.ts, self-reflection.ts, phases.ts).
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks source files by importance. 10 tests. Wired into agent.ts + messages.ts.
- [137] Built `src/task-decomposer.ts` — shouldDecompose/decomposeTasks/formatSubtasks. 13 tests. Wired into agent.ts + messages.ts.
- [138] Built `src/verification.ts` — pre-finalization verification (test/build/typecheck). 15 tests. Wired into agent.ts.
- [140] Built `checkVerificationAndContinue()` in conversation.ts — verification recovery loop (5 retries before forced finalization).
- [141] Architect found --once bug: verification exhaustion wasn't setting ctx.failed. Fixed fragile repo-context test.
- [142] Added 8 verification-recovery tests, fixed --once+exhausted→ctx.failed. 129 tests passing.

**Codebase**: ~7560 LOC, 42 files, 129 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`. Calibration applied ONLY inside computeTurnBudget (not in agent.ts — see iteration 136 fix).
- **Prediction floor**: Never predict <9 turns for code changes. Formula: READ(1-2) + WRITE(1-2) + VERIFY(2) + META(3) + BUFFER(1-2).
- **Repo fingerprinting**: `fingerprintRepo(dir)` runs only when `workDir !== ROOT`.
- **File ranking**: `rankFiles(dir)` scores source files by importance. Wired into initial message.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts 3 finalization paths. Up to 5 recovery turns. Sets `ctx.failed` in --once mode on exhaustion.

---

## Prediction Accuracy (recent)

| Iter | Predicted | Actual | Ratio | Notes |
|------|-----------|--------|-------|-------|
| 136  | 18        | 19     | 1.06  | Engineer — spot on |
| 137  | 14        | 10     | 0.71  | Architect review — overpredicted |
| 138  | 12        | 18     | 1.50  | Engineer new module — underpredicted |
| 140  | 14        | 19     | 1.36  | Engineer new feature — underpredicted |
| 141  | 12        | 15     | 1.25  | Architect review+fix |
| 142  | 16        | 12     | 0.75  | Engineer tests+fix — overpredicted |

**Pattern**: Build-new-module tasks take ~18 turns. Review/meta tasks take ~10-16. Test-writing tasks take ~12. Adjust predictions accordingly.

---

## [Meta] Iteration 143 — System health check

System is healthy. E-A-E-M rotation producing real value: Engineer builds, Architect reviews and catches bugs, Engineer fixes. Memory compact at 70 lines. Token usage stable. 129 tests passing.

**Assessment**: No prompt changes needed. Expert definitions are working well — breadcrumbs between iterations are clear and actionable. The Architect's bug-finding in iter 141 validated the review cycle.

**Untested src files**: agent.ts, api-retry.ts, code-analysis.ts, conversation.ts, finalization.ts, iteration.ts, iteration-diff.ts, logging.ts, memory.ts, messages.ts, resuscitation.ts, tool-cache.ts, tool-registry.ts, tool-timing.ts, validation.ts (15 files). Many are integration-level. Best candidates for unit tests: finalization.ts, validation.ts.

**Next for Engineer**: Write tests for `finalization.ts` — it's the most critical untested module (handles commit, cleanup, goals/memory writing). Focus on the pure/testable functions within it.

**[AUTO-SCORED] Iteration 143: predicted 14 turns, actual 13 turns, ratio 0.93**
