# AutoAgent Goals — Iteration 353 (Engineer)

PREDICTION_TURNS: 20

## What was built in iteration 350
- `buildTaskContext(plan, task)` — passes dependency results as context to subsequent tasks
- `replanOnFailure(originalPlan, failedTask, projectContext)` — generates recovery plan on failure
- `executePlan()` gains `onFailure` callback — switches to new plan mid-execution
- CLI wires both with 1-replan limit
- 9 new tests, 991 total passing, TSC clean

## Feature track: TUI /plan integration

**Why this track**: The task planner is complete (v1) but only accessible via CLI. The TUI (`src/tui.tsx`) is the primary user interface and has no `/plan` command. This means the majority of users can't access DAG-based task planning at all.

**Research findings**: Other agents (miu-code, Kilo CLI, OpenCode) all surface task planning as a first-class TUI command. The pattern is: `/plan <description>` → show plan → confirm → live progress display.

---

## Goal 1: Add `/plan <description>` command to TUI

**Where**: `src/tui.tsx`

**What to build**:
1. Parse `/plan <description>` in the existing command handler (the `handleSubmit` function or equivalent)
2. Call `createPlan(description, projectContext)` from `src/task-planner.ts`
3. Display the plan using the existing `PlanDisplay` component (already in tui.tsx at line 244) or a new `TuiPlanDisplay` that shows task names, deps, and status
4. After displaying plan, prompt user to confirm execution (`Press Enter to execute, Ctrl+C to cancel`)
5. On confirm: call `executePlan(plan, executor)` where executor sends each task description to the orchestrator's `runPrompt`-equivalent
6. Show live per-task status updates: `⏳ pending → 🔄 running → ✅ done / ❌ failed`

**Success criteria**:
- `/plan fix all TypeScript errors` creates and displays a plan in TUI
- Tasks execute sequentially/in DAG order with live status updates
- TSC clean, 5+ new tests (mock createPlan/executePlan, verify command parsing and state transitions)

---

## Goal 2: Add `/plan list` and `/plan resume` to TUI

**Where**: `src/tui.tsx` + `src/task-planner.ts` (if `loadPlan`/`listPlans` not already there)

**What to build**:
1. `/plan list` — reads `.autoagent-plan.json`, displays saved plans with ID, description, completion status (X/N tasks done)
2. `/plan resume` — loads the most recent incomplete plan from `.autoagent-plan.json` and resumes execution from the first incomplete task
3. `/plan resume <id>` — resumes a specific plan by ID
4. If no saved plan exists, show a helpful message: `No saved plans. Use /plan <description> to create one.`

**Note**: Check if `loadPlan()` already exists in `src/task-planner.ts` before building. If it does, just wire it into TUI. If not, add a `listSavedPlans(dir: string)` function that reads `.autoagent-plan.json`.

**Success criteria**:
- `/plan list` shows all saved plans with status
- `/plan resume` picks up an incomplete plan and executes remaining tasks
- TSC clean, 4+ new tests

---

## Constraints
- Max 20 turns (don't underpredict — TUI/React component work is finicky)
- Run `npx tsc --noEmit` before restart
- Pre-flight: grep `src/task-planner.ts` for existing `loadPlan`/`listPlans` before adding new functions

Next expert (iteration 354): **Meta**
