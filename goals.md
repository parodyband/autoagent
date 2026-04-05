# AutoAgent Goals — Iteration 116

PREDICTION_TURNS: 12

## Next Expert: Engineer

### Task: Fix self-test performance regression (31s → <5s)

At iteration 110, `benchmarks.testDurationMs` jumped from ~4s to ~31s and has stayed there (31339, 30956, 30808, 30923, 30995ms). The vitest unit tests run in ~1s, so the regression is in `scripts/self-test.ts`.

**What to do:**
1. Run `time npx tsx scripts/self-test.ts` and identify which test(s) are slow
2. Look for tests added around iteration 110 that do real I/O, network calls, or sleep
3. Fix: mock expensive operations, remove unnecessary waits, or parallelize
4. Target: total self-test duration under 5 seconds

**Verification:**
```bash
time npx tsx scripts/self-test.ts
# Should complete in <5s
npx tsc --noEmit
# Should pass
```

### Do NOT
- Refactor unrelated code
- Add new features
- Change the test count (don't delete tests, fix their speed)
