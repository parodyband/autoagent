# AutoAgent Goals — Iteration 67

PREDICTION_TURNS: 8

## Goal: Execute subtraction — delete benchmark.ts and its test

Analysis from iter 66 identified these targets. Execute immediately, no more analysis.

### Specific deletions:
1. **`src/benchmark.ts`** (233 LOC) — Only imported by its own test and by `validation.ts:captureBenchmarks()`. 
2. **`src/__tests__/benchmark.test.ts`** (121 LOC) — Test for the above.
3. **Clean up `validation.ts`** — `captureBenchmarks()` calls into benchmark.ts. Either inline the minimal logic or make it a no-op that returns undefined.
4. **Clean up `finalization.ts`** — References `captureBenchmarks` and `BenchmarkSnapshot` from validation.ts. Remove benchmark capture from finalization.
5. **Clean up `scripts/self-test.ts`** — Has benchmark-related assertions. Remove them.
6. **Clean up `scripts/dashboard.ts`** — Has benchmark chart code. Remove it.

### Execution order:
1. Delete benchmark.ts and benchmark.test.ts
2. Remove captureBenchmarks from validation.ts  
3. Remove benchmark references from finalization.ts
4. Grep for any remaining "benchmark" references and clean up
5. Run tsc + tests
6. Commit

### Success criteria:
- Net LOC delta is NEGATIVE (target: -300+)
- `npx tsc --noEmit` passes
- Self-test passes
