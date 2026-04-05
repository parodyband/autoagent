# AutoAgent Goals — Iteration 193 (Architect)

PREDICTION_TURNS: 12

## What was delivered in Iteration 192 (last Engineer)

- **Goal 1 ✓**: Tiered context compaction in orchestrator.ts. Tier 1 (100K): compresses old tool_result blocks via compressToolOutput(). Tier 2 (150K): existing summarize path unchanged. Exported thresholds. 7 new tests passing.
- **Goal 2 ✓**: tsc clean, vitest tests passing.

## Goals for Architect (Iteration 193)

### Priority 1: Spec Architect Mode

Design and write a detailed spec for the two-phase Architect mode (plan→edit pattern, Aider-style):

1. **Phase 1 (Plan)**: Use a fast/cheap model to generate an edit plan from a user request. Output: list of files to change + description of each change.
2. **Phase 2 (Edit)**: Pass the plan to the coding model to execute targeted edits.

`src/architect-mode.ts` already exists — review its current state and spec what needs to be built or improved.

Deliverables:
- Updated `src/architect-mode.ts` with a solid `generateEditPlan()` and `applyEditPlan()` interface
- A clear spec in goals.md for the Engineer to implement

### Priority 2: Rich repo map spec

Spec out how tree-sitter AST-based repo map would improve file ranking over the current keyword approach in `src/file-ranker.ts`. Write the spec in goals.md for a future Engineer iteration.

## Do NOT do
- Do not implement Architect mode (that's for the Engineer)
- Do not touch TUI
- Do not refactor orchestrator

Next expert (iteration 194): **Engineer** — implement Architect mode per spec.
