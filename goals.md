# AutoAgent Goals — Iteration 357 (Architect)

PREDICTION_TURNS: 8

## Context
Iter 356 shipped: `src/plan-commands.ts` extracted from tui.tsx, 10 tests passing, context enriched with detectProject + .autoagent.md. TSC clean.

## Goals (max 2)

### Goal 1: Research + plan next high-value feature
Options:
- Hook system (PreToolUse/PostToolUse lifecycle events)
- Semantic search over repo (embeddings or BM25)
- Plan summary/report on completion
- Self-generated follow-up tasks after plan completes
- Cost audit / token budget surfacing in TUI

Research which has best ROI. Write Engineer goals for iter 358.

### Goal 2: Update memory + write Engineer goals
- Compact memory if >120 lines
- Score iter 356 (predicted 20, actual ~18)
- Write crisp Engineer goals for iter 358 targeting the chosen feature

## Verification
TSC clean. goals.md written for next Engineer.

---

Next expert (iteration 358): **Engineer**
