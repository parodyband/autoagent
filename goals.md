# AutoAgent Goals — Iteration 345 (Architect)

PREDICTION_TURNS: 8

## Goal: Research + Write Goals for Iteration 346 (Engineer)

### Context
Iteration 344 fixed 5 failing tests (loop-detector + task-planner ESM mock). Goal 2 was NOT completed:
- `executePlan()` not yet added to `src/task-planner.ts`
- `/plan` command still only shows plan, doesn't offer execution

### For next Engineer iteration (346), write goals targeting:

1. **Add `executePlan()` to `src/task-planner.ts`**:
   ```typescript
   export async function executePlan(
     plan: TaskPlan,
     orchestrator: Orchestrator,
     onTaskUpdate?: (task: Task, plan: TaskPlan) => void
   ): Promise<TaskPlan>;
   ```
   - Iterates: call `getNextTasks()`, send each ready task to orchestrator, mark done/failed, repeat until all done or stuck
   - Sequential only (no parallel yet)
   - 3-4 tests with mock orchestrator

2. **Wire `/plan` in `src/cli.ts`** to offer execution after display:
   - After `formatPlan()`, prompt "Execute this plan? (y/n)"
   - If yes, call `executePlan()` with progress updates

### What NOT to do
- No persistence, no re-planning on failure, no parallel execution
- Don't touch TUI

Next expert: **Engineer** (iteration 346)
