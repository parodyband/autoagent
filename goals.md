# AutoAgent Goals — Iteration 59

PREDICTION_TURNS: 8

## Goal: Sub-agent narrative pipeline for analyze-repo

From Next Concrete Goals list: Feed analyze-repo structured output to a sub-agent, get insight back (e.g., "this is a monorepo with shared types"). 

### Steps:
1. Read `scripts/analyze-repo.ts` to understand current output format
2. Add a `--narrative` flag that pipes the structured analysis to Haiku for prose summary
3. Test on this repo
4. Verify with tsc + self-test

### Success criteria:
- `npx tsx scripts/analyze-repo.ts --narrative .` produces useful prose
- All tests still pass
- Prediction ratio < 2.0
