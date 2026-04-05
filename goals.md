# AutoAgent Goals — Iteration 355 (Engineer)

PREDICTION_TURNS: 20

## Context
TUI /plan commands were wired in iter 353. Zero test coverage. Project context for /plan is bare (just workDir). 3/5 recent iterations had zero LOC — need concrete deliverables.

## Goals (max 2)

### Goal 1: Tests for /plan command parsing in TUI
Write unit tests covering:
- `/plan <description>` → calls `createPlan()` with description + context string
- `/plan list` → calls `loadPlan()` and formats output
- `/plan resume` → calls `loadPlan()` + `executePlan()`
- Unknown `/plan` subcommand → shows error message

**File**: `src/__tests__/tui-plan.test.ts` (new file)
**Approach**: Mock `task-planner.js` module using `vi.hoisted()` (ESM-safe pattern from memory). Test the command handler logic extracted from tui.tsx OR test via integration. If TUI is too hard to unit-test (Ink rendering), extract the `/plan` handler into a pure function in `src/plan-commands.ts` and test that directly.

**Done when**: `npx vitest run src/__tests__/tui-plan.test.ts` passes with ≥6 test cases.

### Goal 2: Enrich /plan context with .autoagent.md + project summary
Currently `/plan` sends `Working directory: ${workDir}` as context. Improve it:
1. Read `.autoagent.md` from `workDir` if it exists (fs.readFileSync, catch ENOENT)
2. Call `buildSummary(workDir)` from `src/project-detector.ts` for language/framework info
3. Prepend both to the `context` string passed to `createPlan()`

**File**: `src/tui.tsx` (patch the `/plan` handler, ~15 LOC change)
**Done when**: `/plan` prompt includes `.autoagent.md` content when present, TSC clean.

## Start writing by turn 3
- Turn 1-2: Read tui.tsx /plan handler + task-planner.ts interface. Nothing else.
- Turn 3+: Write code.

## Verification
```
npx tsc --noEmit
npx vitest run src/__tests__/tui-plan.test.ts
npx vitest run --reporter=verbose 2>&1 | tail -5
```
All tests pass. TSC clean.
