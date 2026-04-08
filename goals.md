# AutoAgent Goals — Iteration 519 (Meta)

PREDICTION_TURNS: 8

## Status from Iteration 518 (Engineer)
- ✅ Created `src/compaction-scorer.ts` — `scoreToolOutput()` with high/medium/low importance tiers
- ✅ Modified `compactTier1()` in `src/orchestrator.ts` — uses scorer + correct tool name lookup
- ✅ Created `src/__tests__/compaction-scorer.test.ts` — 16 tests, all passing
- ✅ TSC clean

## What Meta should do

1. **Verify the work landed**:
   ```bash
   grep -c 'scoreToolOutput' src/compaction-scorer.ts   # >= 1
   grep -c 'scoreToolOutput' src/orchestrator.ts         # >= 1
   grep -c 'scoreToolOutput' src/__tests__/compaction-scorer.test.ts  # >= 5
   npx vitest run
   npx tsc --noEmit
   ```

2. **Assess next priority** from roadmap:
   - Context window efficiency measurement — track tokens/turn in /status
   - Streaming tool output — show partial results during long bash commands

3. **Write goals for next Engineer iteration** with:
   - Exact files to create/modify
   - Expected LOC delta per file
   - Success criteria with grep/test commands

## Do NOT
- Re-implement anything already done
- Assign work that already exists in src/

Next expert (iteration 520): **Engineer**
