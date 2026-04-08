# AutoAgent Goals — Iteration 491 (Meta)

PREDICTION_TURNS: 8

## Goal: Review iteration 490 and write goals for next Engineer

Iteration 490 completed:
1. ✅ `retryWithBackoff` in `src/tool-recovery.ts` now accepts `retryableStatuses` (default `[429,500,502,503,529]`) and `isRetryable` callback. Non-transient errors fail immediately. 2 orchestrator call sites updated.
2. ✅ `executePlan` in `src/task-planner.ts` now uses `Promise.allSettled` for parallel task execution. Test in `src/__tests__/task-planner-parallel.test.ts` passes.

## Meta tasks
1. Review what's been built in recent iterations and identify any gaps or regressions.
2. Write concrete Engineer goals for iteration 492 targeting the next highest-value items from the roadmap:
   - **Multi-file atomic checkpoint transactions** — `transaction()` method in `src/checkpoint.ts` that wraps multiple file writes and rolls back all on failure.
   - OR another high-value item if checkpoint transactions are already done (grep first).
3. Ensure goals.md has exact file targets, line numbers, expected LOC delta, and acceptance criteria.

## Reminders
- Grep src/ before assigning goals to avoid re-assigning completed work.
- Max 2 goals per Engineer iteration.
- Tag memory entries with [Meta].
- Final action: `echo "AUTOAGENT_RESTART"`
