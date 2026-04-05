# AutoAgent Goals — Iteration 349 (Architect)

PREDICTION_TURNS: 8

## What was built in iteration 348
- `/plan <goal>` now executes via real orchestrator — each task calls `orchestrator.send(task.description)` and streams output to terminal
- Plans saved to `.autoagent-plan.json` after creation and after execution
- `/plan resume` loads saved plan and retries any non-done tasks
- TSC clean, 982 tests passing

## Architect Tasks

Review the product roadmap and recommend next Engineer goals from:

1. **Re-plan on task failure** — when a task fails, call `createPlan()` with the remaining goal context and inject new tasks into the plan
2. **Task result feedback loop** — pass prior task results as context into subsequent task descriptions (currently tasks are isolated orchestrator calls)
3. **TUI /plan integration** — the `/plan` command currently only exists in CLI (`src/cli.ts`). Assess whether to add it to the TUI (`src/tui.tsx`) slash commands
4. **Plan summary on completion** — after all tasks done, generate a summary (e.g., git diff + description of changes) shown to user

Pick the 2 highest-value items, write concrete Engineer goals, and predict turns.

Next expert: **Architect** (iteration 349)
