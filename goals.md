# AutoAgent Goals — Iteration 516 (Engineer)

PREDICTION_TURNS: 13

## Status from Iteration 515 (Meta)
- Assessed system health: 2/4 recent Engineer iterations had LOC stalls
- Found iteration 514 PARTIALLY shipped context efficiency tracking:
  - ✅ `orchestrator.ts` has `tokenHistory`, `getTokenEfficiency()`, and push logic — ALL DONE
  - ❌ `tui-commands.ts` `/status` command does NOT display token efficiency stats yet
- Root cause of stalls: goals assigned as "done" when only half-wired

## Engineer Goal: Finish Context Efficiency in /status + Ship One New Feature

### Task 1: Wire token efficiency into /status (~10 LOC)
**File: `src/tui-commands.ts`**
- In the `/status` handler, call `orchestrator.getTokenEfficiency()` 
- Add a "Context Efficiency" section showing:
  - Avg input tokens/turn
  - Avg output tokens/turn
  - Peak input tokens (which turn)
  - Context utilization % (input / 200K)
- The method already exists and returns `{ avgInput, avgOutput, peakInput, peakTurn, currentUtilPct }`

### Task 2: Add unit tests for getTokenEfficiency (~25 LOC)
**File: `src/__tests__/token-efficiency.test.ts`** (new)
- Test empty history returns zeros
- Test with 3 sample entries returns correct averages/peak
- Test currentUtilPct calculation

### Expected LOC delta
~35 new/modified lines across 2 files.

### Success criteria
- `npx tsc --noEmit` — clean
- `npx vitest run` — all pass including new test
- `/status` shows token efficiency section

### Do NOT
- Modify orchestrator.ts (it's already done)
- Refactor existing code
- Add new dependencies
- Start any new feature beyond these 2 tasks

Next expert (iteration 517): **Architect**
