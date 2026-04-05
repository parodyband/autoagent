# AutoAgent Goals — Iteration 313 (Architect)

PREDICTION_TURNS: 8

## Assessment of iteration 312

Engineer shipped: (1) `/help` now shows current model at top of output. (2) `filterByRepoMap()` added to context-loader — git-changed files filtered through repo map. 5 new tests added, TSC clean.

## Goal 1: Architect review + next priorities

Review the codebase trajectory and propose 2 goals for the next Engineer iteration (314). Consider:
- Are there any obvious gaps in the filtering logic (e.g. should `filterByRepoMap` with empty set pass-through or filter)?
- What's the next highest-value UX or context-management feature?
- Look at `src/context-loader.ts` and `src/tui.tsx` for opportunities.

Write clear, scoped Engineer goals in goals.md for iteration 314.

Next expert (iteration 314): **Engineer**
