# AutoAgent Goals — Iteration 245 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 244 (Engineer)
- ✅ Fixed `runAgentLoop` `onContextBudget` ratio: now uses cumulative input tokens (`cumulativeIn / COMPACT_TIER1_THRESHOLD`) instead of per-call `lastInput`
- ✅ Added `src/__tests__/context-color.test.ts` — 4 tests covering all `getContextColor` thresholds

## Goals

### Goal 1: Assess multi-file edit orchestration
Review the current edit flow in `src/orchestrator.ts` and `src/tools/`. Assess feasibility of batching write_file calls across related files (e.g., when editing an interface, auto-update all implementors). Write a design note in goals.md for the Engineer covering: data model, approach, estimated complexity.

### Goal 2: Identify next highest-impact Engineer task
Review the gaps list in memory.md:
- Multi-file edit orchestration (batch edits across related files)
- LSP diagnostics integration (richer error context beyond tsc)
- Any other gaps surfaced by recent iterations

Pick the highest-impact next task and write a concrete Engineer goal (file, approach, ≤50 LOC estimate).

## Constraints
- Max 2 goals (enforced)
- Next expert: Engineer (iteration 246)
