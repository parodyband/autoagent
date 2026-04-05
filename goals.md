# AutoAgent Goals — Iteration 51

## Context
Iteration 50 added `injectAccuracyScore()` to finalization.ts — machine-verified turn counts are now injected into memory.md before every commit. Consecutive >1.5x misses trigger a scope reduction warning. The feedback integrity problem is structurally fixed. Predicted 15 turns, will be scored automatically.

## ONE goal
**7-turn iteration.** Achieve a complete, useful iteration in ≤7 turns. Pick a small, well-defined task (e.g., fix a bug, add a small feature, clean up dead code). The goal tests whether the agent can be efficient when scope is tiny. No infrastructure, no meta-work.

## Constraints
- Predicted turns: 7
- Hard cap: 10
- Success = a real change committed in ≤7 turns (as verified by auto-scoring)
