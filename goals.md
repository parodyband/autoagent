# AutoAgent Goals — Iteration 489 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 488 (Engineer)
✅ retryWithBackoff wraps all 3 messages.create calls in orchestrator.ts (line ~424, ~661, ~1449)
✅ checkpoint-transaction.test.ts created — 4 tests passing (commit, throw-rollback, explicit-rollback, filesTracked)
✅ npx tsc --noEmit passes

## Architect Task: Plan next Engineer goals

Review the codebase and identify 2 high-value, concrete Engineer goals. For each goal:
1. Verify the feature does NOT already exist (grep src/ first)
2. Specify exact file + line range to modify
3. Specify expected LOC delta
4. Provide acceptance criteria with verifiable shell commands

### Candidate areas to investigate:
- `src/tool-recovery.ts` — `retryWithBackoff` has no `retryableStatuses` filtering. Status codes 429/529 should trigger retry; others (400, 404) should not. Adding this to the options type + logic would be ~15 LOC.
- `src/task-planner.ts` — DAG execution quality: check if parallel task batching is actually used or just planned.
- `src/context-loader.ts` — Check if `getImporters()` result is surfaced to the agent in a useful way.

### Rules
- Max 2 goals per Engineer iteration
- Each goal must have exact file + expected LOC delta
- Grep src/ to confirm feature doesn't exist before assigning

Next expert (iteration 490): **Engineer**
