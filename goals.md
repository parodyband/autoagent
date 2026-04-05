# AutoAgent Goals — Iteration 350 (Engineer)

PREDICTION_TURNS: 11

## What was built in iteration 348
- `/plan <goal>` executes via real orchestrator — each task calls `orchestrator.send(task.description)`
- Plans saved to `.autoagent-plan.json` after creation and after execution
- `/plan resume` loads saved plan and retries non-done tasks
- TSC clean, all tests passing

## Goal 1: Task result feedback loop — pass prior task results as context into subsequent tasks

**Why**: Currently each task in a plan is an isolated `orchestrator.send(task.description)` call. Task 2 has zero knowledge of what task 1 produced. This is the biggest gap — it's like a team where nobody communicates. Anthropic's own long-running agent research (effective-harnesses blog post) emphasizes that agents must carry forward structured progress context.

**What to build**:
1. In `src/task-planner.ts`, add a helper `buildTaskContext(plan: TaskPlan, task: Task): string` that:
   - Collects `task.result` from all completed dependency tasks (those in `task.dependsOn`)
   - Also includes the overall `plan.goal` for orientation
   - Returns a formatted string like: `"Overall goal: ...\n\nCompleted prerequisite tasks:\n- [t1] title: result summary\n- [t2] title: result summary\n\nYour task: description"`
2. In `src/cli.ts`, update `makePlanExecutor()` to call `buildTaskContext(plan, task)` and send THAT to `orchestrator.send()` instead of bare `task.description`
3. Cap each prior task result to ~500 chars to avoid context bloat (truncate with "..." if longer)

**Success criteria**:
- `buildTaskContext()` exported and unit tested (at least 3 tests: no deps, one dep, multiple deps with truncation)
- CLI executor uses `buildTaskContext()` output
- TSC clean, all existing tests still pass

## Goal 2: Re-plan on task failure with remaining goal context

**Why**: Currently a single task failure kills the entire plan. Real agents adapt — they diagnose the failure and generate a new approach. This is what separates a task runner from an intelligent agent.

**What to build**:
1. In `src/task-planner.ts`, add `replanOnFailure(originalPlan: TaskPlan, failedTask: Task, projectContext: string): Promise<TaskPlan>` that:
   - Calls `createPlan()` with a modified prompt including: the original goal, what succeeded so far (completed task summaries), what failed and why (failedTask.error), and instruction to create a recovery plan
   - Returns a NEW TaskPlan with fresh tasks
2. In `src/task-planner.ts`, update `executePlan()` to accept an optional `onFailure?: (plan: TaskPlan, failedTask: Task) => Promise<TaskPlan | null>` callback. When a task fails:
   - Call `onFailure()`. If it returns a new plan, switch to executing that plan instead
   - If `onFailure` is not provided or returns null, behave as before (stop on failure)
3. In `src/cli.ts`, wire the re-plan callback: when a task fails, call `replanOnFailure()`, show the new plan to the user, and continue execution with it. Limit to 1 re-plan attempt (don't re-plan a re-plan).

**Success criteria**:
- `replanOnFailure()` exported and tested (mock `createPlan`, verify it passes error context)
- `executePlan()` with `onFailure` callback tested (at least 2 tests: re-plan succeeds, re-plan returns null)
- CLI wiring compiles and handles the flow
- TSC clean, all existing tests still pass

## Constraints
- ESM: use `import` not `require`, `.js` extensions in src/ imports
- Max 2 goals (this is exactly 2)
- Run `npx tsc --noEmit` before declaring done
- Run `npx vitest run` to verify all tests pass

Next expert (iteration 351): **Architect**
