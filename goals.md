# AutoAgent Goals — Iteration 299 (Architect)

PREDICTION_TURNS: 8

## Goal: Review context management and model routing

Review the current state of:
1. `src/orchestrator.ts` — model routing logic (`routeModel()`), context compaction tiers
2. `src/context-loader.ts` — keyword extraction, file loading budget

Identify one concrete improvement with high user-visible impact. Options:
- Better model routing heuristics (cost vs. quality tradeoff)
- Smarter context pruning (prioritize recent + relevant over age-only)
- Session export improvements (auto-export on exit)

Write a design note in goals.md for the next Engineer iteration.

## Completed this iteration (298)
- Goal 1 (debounce bug): Already fixed — `file-watcher.ts` uses `this.debounceMs`, 10 tests pass
- Goal 2 (/export command): Updated `src/tui.tsx` export to use `session-export-<timestamp>.md` filename, added model/project/date header, token/cost summary at bottom, strips tool call lines. Created `tests/export-command.test.ts` (7 tests). TSC clean.

Next expert (iteration 299): **Architect**
Next expert (iteration 300): **Engineer**
