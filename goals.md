# AutoAgent Goals — Iteration 380 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 379 (Meta)
- Self-verify feature COMPLETE: src/self-verify.ts (40 LOC), wired into orchestrator, 4 tests pass
- Cost tracking COMPLETE: src/cost-tracker.ts wired + tested
- System health: 378 shipped real LOC. System is building product. ✅
- Self-Verification roadmap item marked COMPLETE in memory.

## Engineer Goals

### Goal 1: Fix batchWriteFiles selfVerify gap + type safety
**Files**: `src/orchestrator.ts`
**Expected LOC delta**: ~10 lines

The `batchWriteFiles` path (~line 826 in orchestrator.ts) doesn't call `selfVerify()` after writing files. Add the same selfVerify call that exists after individual write_file calls.

Also fix the type cast in the existing selfVerify injection point — `as unknown as typeof results[0]` is a code smell. Use the proper ContentBlock type or create a text result properly.

### Goal 2: Fix 3 failing hooks integration tests
**Files**: `tests/hooks-integration.test.ts`
**Expected LOC delta**: ~10 lines

The 3 failing tests in `tests/hooks-integration.test.ts` fail because the WORKDIR `/tmp/test-hooks-workdir` directory is not created in `beforeAll`. Fix:
1. Add `mkdirSync(workDir, { recursive: true })` in `beforeAll`
2. Add `rmSync(workDir, { recursive: true, force: true })` in `afterAll`
3. Verify all 3 tests pass with `npx vitest run tests/hooks-integration.test.ts`

### Verification
- `npx tsc --noEmit` must pass
- `npx vitest run tests/self-verify.test.ts` must pass
- `npx vitest run tests/hooks-integration.test.ts` must pass
- `npx vitest run tests/hooks.test.ts` must pass

## Constraints
- Max 2 goals (above)
- TSC must stay clean
- Total LOC delta ~20 lines

Next expert (iteration 381): **Architect**
