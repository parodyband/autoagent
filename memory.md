## Compacted History (iterations 112–174)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests.
- [144-162] Test coverage push: 16→23 test files, 245→338 tests.
- [152] Integrated `rankFiles()` into `orientation.ts`.
- [164-170] Dead code removal, export audit, wired `calibrationSuggestion()` into orientation.
- [172] Expert breadcrumbs in orientation — each expert sees relevant memory entries.
- [174] Budget-aware `progressCheckpoint()` — fires at ~15%/32%/60%/80% of predicted budget.

**Codebase**: ~4950 LOC (src), 30 source files, 23 test files, 359 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning` → `calibrationSuggestion` (shown in orientation).
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **Test guards**: Many "dead" exports are used in tests — always check __tests__/ AND scripts/ before removing.
- **External repo foundation**: `agent.ts` already distinguishes `rootDir` (work target) vs `agentHome` (where autoagent lives). `fingerprintRepo()` called when `workDir !== ROOT` (line 289). CLI just needs `--target` flag.

---

## Untested Source Files (~9 of 30)

agent.ts, conversation.ts, iteration.ts, logging.ts, memory.ts, resuscitation.ts, tool-timing.ts, tools/read_file.ts, tools/web_fetch.ts
*(All require API mocks — diminishing test ROI.)*

---

## Prediction Accuracy (recent)

| Iter | Predicted | Actual | Ratio |
|------|-----------|--------|-------|
| 171  | 22        | 11     | 0.50  |
| 172  | 18        | 20     | 1.11  |
| 173  | 18        | 18     | 1.00  |
| 174  | 16        | 15     | 0.94  |

Calibration well-tuned. No action needed.

---

## [Meta] Iteration 175

**Diagnosis: still cycling.** Iterations 172-174 continued internal polish (breadcrumbs, budget-aware checkpoints). Useful but marginal. The Architect diagnosed this at 173 but the system didn't act on it.

**Decision**: Redirecting toward external repo support — the highest-value capability the agent lacks. Foundation already exists in agent.ts (`rootDir` vs `agentHome`, conditional `fingerprintRepo`). Engineer at 176 should add `--target <dir>` CLI support and wire it through.

**System health**: Prediction accuracy excellent (last 2 iters: 1.00, 0.94). Expert rotation working (E→A→E→M cycle). Memory stays compact. No structural changes needed to prompts or rotation.

**[AUTO-SCORED] Iteration 175: predicted 18 turns, actual 11 turns, ratio 0.61**

## MISSION CHANGE — Building a coding agent product (operator, iteration 177)

**The mission has fundamentally changed.** Self-improvement for its own sake is over.

New mission: **Build the best possible AI coding agent tool** — one that's measurably
better than talking to Claude directly.

What this means:
- The TUI (src/tui.tsx) is the user interface. Make it great.
- The orchestration underneath is the product. Build it.
- The self-improvement loop exists to make the PRODUCT better, not itself.
- Research what other coding agents do (Cursor, Aider, SWE-Agent, Devin, OpenHands).
- You now have web_search (DuckDuckGo) — USE IT to research techniques.

What "better than raw Claude" means:
- Smart context management (pre-index repos, load only relevant files)
- Task decomposition (break complex requests into steps)
- Model routing (cheap models for cheap work)
- Persistent repo knowledge (remember across sessions)
- Self-verification (run tests, check compilation)
- Great UX (show progress, handle errors gracefully)

The Architect should research before designing. The Engineer should build product features.
The Meta expert should ensure the system is serving the product mission.

---
