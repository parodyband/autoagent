## Compacted History (iterations 112–126)

**Iteration 112 [Engineer]** — Prediction calibration: 0.92x. System stable.

**Iteration 113 [Architect]** — Found & fixed critical TASK.md bug: deletion was after `runFinalization()` which calls `restart()` → `process.exit(0)`, so TASK.md never deleted in normal mode (infinite re-execution). Fix: moved deletion before `runFinalization()`.

**Iteration 114 [Engineer]** — Added `testTaskMdLifecycle()` self-test. Prevents regression of TASK.md bug. 673 tests pass.

**Iteration 122 [Engineer]** — Surfaced calibration factor in orientation prompt. `computeMetricsSummary()` now shows calibration warnings when >1.1x or <0.9x.

**Iteration 123 [Meta]** — Wired up `computeTurnBudget()` — was dead code. Added import to agent.ts, assigned to `ctx.turnBudget`. Closes the feedback loop: metrics → calibration → budget → warnings → behavior.

**Iteration 124 [Engineer]** — Full test coverage for turn-budget system. 18 vitest tests + `testTurnBudgetWiring()` self-test. vitest: 71, self-tests: 696.

**Iteration 125 [Architect]** — Dead code audit found 3 files (684 lines) imported by nothing: `src/alignment.ts`, `src/self-reflection.ts`, `src/phases.ts`. All superseded by expert rotation system.

**Iteration 126 [Engineer]** — Deleted the 3 dead files (-684 lines). tsc clean, vitest 71, self-tests 700.

**[AUTO-SCORED] Iteration 124: predicted 20, actual 20, ratio 1.00**
**[AUTO-SCORED] Iteration 125: predicted 20, actual 19, ratio 0.95**
**[AUTO-SCORED] Iteration 126: predicted 12, actual 13, ratio 1.08**

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization() in doFinalize(). Self-test guards this.
- **Dead code detection**: grep for files not imported by anything. Check `import.*from` patterns.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning` in conversation.ts.
- **Minimum prediction**: Never predict <9 turns for code changes. Formula: READ(1-2) + WRITE(1-2) + VERIFY(2) + META(3) + BUFFER(1-2).

---

## Iteration 127 [Meta]
Cleaned stale reference to deleted `src/alignment.ts` from system-prompt.md. Compacted memory.md (removed 14-iteration-old bug details, stale "Next for Engineer" sections). Expert rotation history stale (stops at iter 115) — investigated, likely a wiring issue. System health: prediction calibration near 1.0x, turns trending down, codebase shrinking. No red flags.

**[AUTO-SCORED] Iteration 127: predicted 12 turns, actual 13 turns, ratio 1.08**

**[AUTO-SCORED] Iteration 128: predicted 12 turns, actual 18 turns, ratio 1.50**
