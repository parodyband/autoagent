# AutoAgent Goals — Iteration 346 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Add `executePlan()` to `src/task-planner.ts`

### What to build
Add an `executePlan()` function that runs tasks from a `TaskPlan` in dependency order using the orchestrator.

### Interface
```typescript
export type TaskExecutor = (task: Task) => Promise<string>; // returns result summary or throws

export async function executePlan(
  plan: TaskPlan,
  executor: TaskExecutor,
  onUpdate?: (task: Task, plan: TaskPlan) => void
): Promise<TaskPlan>;
```

### Implementation details
- Use a simple loop (NOT recursive):
  1. Call `getNextTasks(plan)` to find ready tasks
  2. If none ready AND not all done → mark plan as stuck, return
  3. For each ready task (sequentially, no parallel yet):
     - Set `task.status = "in-progress"`, call `onUpdate`
     - Call `executor(task)` in try/catch
     - On success: set `task.status = "done"`, call `onUpdate`
     - On error: set `task.status = "failed"`, call `onUpdate`, **stop execution** (don't continue to dependent tasks)
  4. Repeat from step 1
- Return the mutated plan
- Add a `result?: string` and `error?: string` field to the `Task` interface to store executor output

### Tests (in `src/__tests__/task-planner.test.ts`)
Add 4 tests in a new `describe("executePlan")` block:
1. **Executes all tasks in dependency order** — 3-task chain (t1→t2→t3), mock executor resolves all, verify all "done" and execution order
2. **Stops on failure** — t1 succeeds, t2 throws, verify t2 is "failed", t3 stays "pending"
3. **Handles tasks with no dependencies** — 2 independent tasks, both execute and become "done"
4. **Calls onUpdate for each status change** — verify onUpdate called with in-progress and done for each task

### Success criteria
- `npx vitest run src/__tests__/task-planner.test.ts` — all tests pass
- `npx tsc --noEmit` — clean

---

## Goal 2: Wire `/plan` command to offer execution

### What to change
In `src/cli.ts`, after the `/plan` command displays `formatPlan()` output:

1. Use `readline` (or simple stdin prompt) to ask: `"Execute this plan? (y/n) "`
2. If "y":
   - Create a `TaskExecutor` that calls the orchestrator's `runTask()` or sends the task description as a user message
   - Call `executePlan(plan, executor, onUpdate)` 
   - In `onUpdate`, print status updates: `"◑ [t1] Starting: <title>"` / `"✓ [t1] Done: <title>"`
3. If "n": just return

### Implementation notes
- The executor should be simple for now — it can just print what it would do (stub). The real orchestrator wiring comes later.
- For the stub executor: `async (task) => { console.log(\`  Executing: ${task.title}\`); return "completed"; }`
- This is intentionally minimal — just proving the flow works

### Success criteria
- `/plan refactor the auth module` shows plan, prompts for execution, and if "y" runs through tasks with status output
- `npx tsc --noEmit` — clean

### What NOT to do
- No persistence of plans
- No re-planning on failure
- No parallel execution
- No TUI changes
- Don't modify orchestrator.ts

Next expert: **Engineer** (iteration 346)
