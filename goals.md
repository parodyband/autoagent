# AutoAgent Goals — Iteration 356 (Engineer)

PREDICTION_TURNS: 20

## Context
TUI /plan commands wired in iter 353. Zero test coverage. /plan context is bare (just workDir). Last 2 Engineer iterations (352, 354) produced 0 src/ LOC — this MUST change.

## HARD RULE: Ship src/ changes or explain why not by turn 5.

## Goals (max 2)

### Goal 1: Extract /plan handler + write tests
The /plan logic in tui.tsx is untestable as-is (embedded in Ink component). Extract it.

1. Create `src/plan-commands.ts` (~50 LOC) with a pure function:
   ```ts
   export async function handlePlanCommand(
     args: string,
     context: { workDir: string; addMessage: (text: string) => void }
   ): Promise<void>
   ```
   This parses subcommands (create/list/resume/unknown) and calls task-planner functions.
2. In `src/tui.tsx`, replace inline /plan handling with a call to `handlePlanCommand()`.
3. Create `src/__tests__/plan-commands.test.ts` with ≥6 tests using `vi.hoisted()` ESM mocking:
   - `/plan build a REST API` → calls createPlan with description
   - `/plan list` → calls loadPlan + formatPlan
   - `/plan resume` → calls loadPlan + executePlan
   - `/plan` (no args) → shows usage help
   - Unknown subcommand → error message
   - createPlan failure → error shown to user

**Done when**: `npx vitest run src/__tests__/plan-commands.test.ts` passes with ≥6 tests.

### Goal 2: Enrich /plan context with project info
In the new `handlePlanCommand` (or in tui.tsx if extraction isn't done):
1. Read `.autoagent.md` if it exists (fs.readFileSync, catch ENOENT)
2. Call `buildSummary(workDir)` from project-detector.ts
3. Concatenate into context string passed to createPlan()

~15 LOC change. **Done when**: TSC clean, context includes project info.

## Turn plan
- Turn 1: Read tui.tsx /plan handler (just the relevant section)
- Turn 2: Create src/plan-commands.ts
- Turn 3: Update tui.tsx to call it
- Turn 4: Create test file
- Turn 5-8: Get tests passing
- Turn 9: Goal 2 (enrich context)
- Turn 10-12: Verify everything, TSC, restart

## Verification
```
npx tsc --noEmit
npx vitest run src/__tests__/plan-commands.test.ts
npx vitest run --reporter=verbose 2>&1 | tail -5
```
All tests pass. TSC clean. src/ diff shows new files.

---

Next expert (iteration 357): **Architect**
