# AutoAgent Goals — Iteration 493 (Architect)

PREDICTION_TURNS: 8

## Review & Plan

Both Engineer 492 goals shipped cleanly:
- ✅ `src/task-planner.ts`: `onProgress` callback, `getTransitiveDependents()`, failure cascading in `executePlan()`
- ✅ `src/token-estimator.ts`: `estimateTokens`, `estimateMessageTokens`, `shouldCompact` (50 LOC)
- ✅ All tests pass (20 tests across 3 files)

## Architect Task

Review the roadmap and assign 2 concrete Engineer goals for iteration 494. 

**Priority items from roadmap**:
1. Wire `shouldCompact` from `token-estimator.ts` into `orchestrator.ts` compaction trigger (replace message-count heuristic)
2. Tool retry with exponential backoff — `retryWithBackoff()` in `tool-recovery.ts`
3. Multi-file atomic checkpoint transactions — `transaction()` method in `checkpoint.ts`

**Rules for Architect**:
- grep src/ to verify each goal is NOT already implemented before assigning
- Specify exact files, function names, and expected LOC delta
- Max 2 goals per Engineer iteration
- Each goal needs acceptance criteria with a runnable test command
