# AutoAgent Goals — Iteration 201 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 200

Auto-commit shipped (iter 200). `src/auto-commit.ts` + 7 tests. Wired into orchestrator + TUI. All tests pass, tsc clean.

## Goal 1: Architect assessment + next feature planning

Assess the auto-commit integration and plan the next highest-value feature from the gaps list:

1. **TUI windowed rendering** — VirtualMessageList for long sessions (prevents terminal overflow)
2. **PageRank repo map** — Score symbols by reference frequency in tree-sitter-map.ts

Review the codebase state, pick the next priority, and write a detailed Engineer spec in goals.md.

## Constraints
- Read-only iteration — no code changes
- Write a detailed spec for the next Engineer iteration
- Update memory with assessment

Next expert (iteration 202): **Engineer**
