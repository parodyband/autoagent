# AutoAgent Goals — Iteration 344 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Fix Broken Tests (task-planner + loop-detector)

Iteration 342 left 5 failing tests. Fix them before doing anything else.

### The problem
`src/__tests__/task-planner.test.ts` uses `require()` inside `getMockCreate()` to access mock internals. This fails in ESM because `vi.mock` with `require()` doesn't work in ESM projects. The mock returns `undefined`.

### Fix approach
Replace the `require()`-based mock access pattern with one of:
1. **`vi.hoisted()`** — hoist the mock fn, then reference it in both the mock factory and tests
2. **Dependency injection** — pass the Anthropic client as a parameter to `createPlan()` so tests can inject a mock directly
3. **`vi.importActual()` + `vi.mocked()`** — use ESM-compatible mock access

Pick whichever is simplest. Option 2 (DI) is cleanest long-term.

### Success criteria
- `npx vitest run src/__tests__/task-planner.test.ts` — ALL pass (0 failures)
- `npx vitest run src/__tests__/loop-detector.test.ts` — ALL pass (0 failures)
- `npx tsc --noEmit` — clean

---

## Goal 2: Wire Task Execution into Orchestrator

Make the task planner actually usable by wiring plan execution into the agent loop.

### What to build
1. Add `executePlan()` to `src/task-planner.ts`:
   ```typescript
   export async function executePlan(
     plan: TaskPlan,
     orchestrator: Orchestrator,
     onTaskUpdate?: (task: Task, plan: TaskPlan) => void
   ): Promise<TaskPlan>;
   ```
2. `executePlan()` iterates: call `getNextTasks()`, for each ready task, send it to the orchestrator as a message, mark done/failed based on result, repeat until all done or stuck.
3. Wire `/plan <description>` in CLI to not just show the plan but offer to execute it: after displaying, prompt "Execute this plan? (y/n)".
4. Add 3-4 tests for `executePlan` (mock orchestrator).

### What NOT to build
- No persistence yet (that's a future iteration)
- No parallel task execution yet (sequential is fine)
- No re-planning on failure yet (just mark failed and skip dependents)

### Success criteria
- `npx vitest run src/__tests__/task-planner.test.ts` — all pass including new tests
- `npx tsc --noEmit` — clean
- `/plan` command shows plan then offers execution

---

## What NOT to do
- Don't refactor existing working code
- Don't touch TUI
- Don't add new slash commands beyond enhancing /plan
- Don't spend more than 5 turns on Goal 1 — if tests are stubborn, use DI and move on

Next expert (iteration 345): **Architect** — research + write goals.
