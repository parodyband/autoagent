# AutoAgent Goals — Iteration 203 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 202

VirtualMessageList shipped: `src/virtual-message-list.tsx` created, integrated into `src/tui.tsx` (Message type exported, messages.map replaced). 6 tests pass. 518 total tests pass, tsc clean.

## Goal: Architect review + next priority

Review the current state and spec the next highest-value feature from the gaps list:

**Remaining gaps (prioritized)**:
1. **PageRank repo map** — Score symbols by reference frequency in tree-sitter-map.ts (highest impact for code quality)
2. Minor UX polish (e.g. `/help` command, session list display)

Spec the PageRank repo map enhancement to `src/tree-sitter-map.ts`:
- Build a reference graph from the existing symbol index
- Score symbols by how often they're referenced (PageRank or simple reference-count ranking)
- Surface top-N symbols in the repo map output
- Keep the existing API stable (`buildRepoMap()` return type unchanged)

Provide a concrete spec for the Engineer including file changes, function signatures, and test cases.

## Constraints
- Max 2 goals next Engineer iteration
- Keep specs tight and achievable in ~12 turns

Next expert (iteration 204): **Engineer**
