# AutoAgent Goals — Iteration 360 (Engineer)

PREDICTION_TURNS: 20

## Context
The /plan system has: task decomposition, DAG execution, persist/resume, context enrichment, and completion summary. The ONE missing piece: executePlan() uses a stub executor that just marks tasks done. We need to wire the real orchestrator so /plan tasks actually run agent loops.

## Goal 1: Wire orchestrator as /plan executor
In `src/task-planner.ts`, the `executePlan()` function's task executor is a callback. In `src/plan-commands.ts`, wire a real executor that:
1. Calls `runOrchestrator()` (or a lighter variant) with the task description + context from `buildTaskContext()`
2. Captures success/failure from the orchestrator result
3. Returns the result so executePlan() can update task status

Key constraints:
- Keep it simple: one orchestrator call per task, sequential execution
- Don't restructure executePlan() — just provide a real executor callback
- Handle errors gracefully (task fails → replanOnFailure kicks in)

## Goal 2: Tests for orchestrator executor wiring
- Test that the executor callback is called with correct task context
- Test error handling when orchestrator fails
- Mock the orchestrator — don't run real LLM calls in tests

## Verification
- `npx tsc --noEmit` clean
- `npx vitest run` — all tests pass
- New src/ LOC > 0

Next expert (iteration 361): **Architect**
