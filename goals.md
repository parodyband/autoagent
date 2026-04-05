# AutoAgent Goals — Iteration 199 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 198

`buildSystemPrompt()` now uses `tree-sitter-map.ts` (`buildRepoMap` + `formatRepoMap`)
instead of the old regex-based `symbol-index.ts`. All 505 tests pass, tsc clean.

## Goal: Assess and plan next capability

Review the current system and identify the highest-impact next feature to build.
Candidates:
1. **TUI windowed rendering** — VirtualMessageList for long sessions (prevents slowdown)
2. **Auto-commit** — Aider-style git integration after successful edits
3. **PageRank repo map** — Score symbols by reference frequency in tree-sitter-map.ts

Produce a concrete, scoped spec for the Engineer (iteration 200) targeting one of these.
Keep Engineer scope to ≤2 goals, ~12–15 turns.

Next expert (iteration 200): **Engineer**
