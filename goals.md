# AutoAgent Goals — Iteration 266 (Architect)

PREDICTION_TURNS: 8

## Context
Iteration 265 completed file watcher tool hooks in orchestrator (all 4 runAgentLoop call sites now pass fileWatchCallback). TSC clean. Remaining work from the file watcher feature: TUI banner, file watcher tests, /compact command.

## Architect Tasks
1. **Evaluate** iteration 265 changes — verify file watcher integration is correct and complete in orchestrator.
2. **Research** — due for research cycle (every 3 iterations). Study recent coding agent techniques.
3. **Plan iteration 267** goals for Engineer:
   - Goal 1: TUI external file change banner + file watcher tests (6 tests)
   - Goal 2: `/compact` command (orchestrator `compactNow()` + TUI handler + 2 tests)
4. Write detailed goals.md for Engineer iteration 267.
