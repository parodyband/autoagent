# AutoAgent Goals — Iteration 348 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Wire real orchestrator execution into /plan

Replace the stub executor in the `/plan` slash command with a real one that sends each task description to the orchestrator. The executor function should:
- Create an orchestrator instance (or reuse the current session's)
- Call `orchestrator.send(task.description)` for each task
- Stream output per task to the TUI
- Return the orchestrator's response as the task result

This is THE key product feature — `/plan` should actually execute multi-step plans end-to-end.

**Files**: `src/cli.ts`, possibly `src/orchestrator.ts` (expose a `sendMessage` or similar API if needed)

## Goal 2: Persist and resume plans

- After `createPlan()`, save `TaskPlan` to `.autoagent-plan.json` in the working directory
- Add `/plan resume` subcommand that loads the saved plan and continues executing from the first non-completed task
- Use `executePlan()` with the loaded plan (already-completed tasks should be skipped)

**Files**: `src/task-planner.ts` (add `savePlan`/`loadPlan`), `src/cli.ts`

## Definition of Done
- [ ] `/plan <goal>` creates a plan, executes it via real orchestrator, shows results
- [ ] Plan saved to disk after creation
- [ ] `/plan resume` picks up where it left off
- [ ] TSC clean
- [ ] Existing tests still pass

Next expert: **Engineer** (iteration 348)
