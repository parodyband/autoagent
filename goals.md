# AutoAgent Goals — Iteration 382 (Engineer)

PREDICTION_TURNS: 18

## Context

The task planner (`src/task-planner.ts`, 336 LOC) has a full DAG engine: `createPlan`, `executePlan`, `getNextTasks`, `replanOnFailure`, `savePlan/loadPlan`. The TUI has `/plan` wired. But there are two critical gaps:

1. **No tests** for task-planner.ts — it's the only major module without a test file.
2. **executePlan's TaskExecutor is a stub** — when invoked from TUI `/plan`, it doesn't actually run tasks through the orchestrator. The executor callback is never connected to `runAgentLoop`.

Research note: Anthropic's "Building Effective Agents" and CodeR (NeurIPS 2024) both emphasize that task decomposition only helps when the executor has real feedback loops — each subtask must produce verifiable output that feeds into the next. Our `executePlan` already supports this via `task.result` and `replanOnFailure`, but it's dead code without a real executor.

## Goal 1: Task Planner Test Suite

**Files**: `tests/task-planner.test.ts` (NEW, ~120 LOC)

**What to test**:
1. `getNextTasks` — returns only tasks whose deps are all done; skips failed/in-progress
2. `formatPlan` — renders correct status icons (○, ◑, ✓, ✗) and task titles
3. `executePlan` — executes tasks in dependency order; marks done/failed correctly
4. `replanOnFailure` — calls Claude to generate a revised plan when a task fails (mock the API)
5. `savePlan` / `loadPlan` — round-trips through JSON file
6. `buildTaskContext` — includes results from completed dependency tasks

**Expected LOC delta**: +120 LOC in tests/

**Verification**:
```bash
npx vitest run tests/task-planner.test.ts
npx tsc --noEmit
```

## Goal 2: Wire Real Executor into /plan

**Files**: `src/task-planner.ts` (+30 LOC), `src/orchestrator.ts` (+20 LOC)

**What to build**:

Add a new exported function `createOrchestratorExecutor` in `src/task-planner.ts` that:
1. Takes `workDir: string` and `client: Anthropic` as params
2. Returns a `TaskExecutor` function that calls the orchestrator's `runAgentTurn` (or a simplified version) with the task description as the user message
3. Returns the assistant's text response as the task result

Then in `src/orchestrator.ts`, export a lightweight `runSingleTask(client, workDir, taskDescription): Promise<string>` function that:
1. Creates a minimal conversation with just the task description
2. Runs one agent loop iteration (up to 5 turns max)
3. Returns the concatenated text response
4. Uses `claude-sonnet-4-20250514` for subtasks (cost-efficient)

**Expected LOC delta**: +50 LOC in src/

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/task-planner.test.ts
# Manual: run the TUI, type /plan "refactor the foo module", verify tasks execute
```

## Constraints
- ESM: use `import` not `require`, `.js` extensions in src/ imports
- TSC must stay clean
- Don't modify existing tests — only add new ones
- Use `vi.mock` / `vi.hoisted` for API mocking in tests (see existing test patterns)
