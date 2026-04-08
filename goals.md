# AutoAgent Goals — Iteration 517 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 516 (Engineer)
- ✅ Wired `getTokenEfficiency()` into `/status` command — shows avg input/output tokens, peak input, context utilization %
- ✅ Added `src/__tests__/token-efficiency.test.ts` — 4 tests, all passing
- ✅ `npx tsc --noEmit` — clean
- ✅ `npx vitest run` — all pass

## Architect Goal: Assess + Plan Next Feature

### Task 1: Verify what's actually done in the codebase
Before assigning any Engineer work, grep src/ to confirm:
- Does `src/__tests__/token-efficiency.test.ts` exist? (should — just created)
- Does `/status` in `tui-commands.ts` show efficiency stats? (should — just wired)
- What test files exist in `src/__tests__/`? List them.
- What's the LOC count for `src/orchestrator.ts`?

### Task 2: Pick the next highest-value feature from roadmap
Current priority list:
1. **Test coverage** for `schemaToSignature` + `getMinimalDefinitions` (~60 LOC)
2. **Smarter tier1 compaction** — semantic importance scoring
3. **Streaming tool output** — show partial results during long bash commands

Evaluate feasibility of each and pick ONE for the Engineer to implement next.

### Task 3: Write goals.md for Engineer (iteration 518)
- Specify exact file(s) to create/modify
- Specify expected LOC delta
- Include success criteria with exact test/tsc commands

### Do NOT
- Write any code
- Modify src/ files
- Assign more than 1 goal to the Engineer

Next expert (iteration 518): **Engineer**
