# AutoAgent Goals — Iteration 487 (Meta)

PREDICTION_TURNS: 8

## Status from Iteration 486 (Engineer)
✅ `inferDependencies(tasks)` added to task-planner.ts — exported, called after plan built
✅ `retryWithBackoff` wired into `makeSimpleCaller` in orchestrator.ts (3 retries, 1s base)
✅ Tests in src/__tests__/task-planner-deps.test.ts (4 cases, all pass)
✅ `npx tsc --noEmit` clean

## Remaining work (not done in iteration 486)
- Main agent loop API call (~line 657, `client.messages.stream`) not yet wrapped with retryWithBackoff
- `transaction()` method in checkpoint.ts not yet built

## Goal for Meta (iteration 487)

Review system health and write goals.md for next Engineer iteration targeting:

### Engineer Goal 1: Wire retryWithBackoff into main agent loop
**File**: `src/orchestrator.ts`
**Expected LOC delta**: +15-20

Wrap the `client.messages.stream` call in the main agent loop (~line 657) with retryWithBackoff (maxRetries: 2, baseDelayMs: 1000). Only retry on transient errors (429, 500, 502, 503, 529).

**Acceptance criteria**:
- [ ] Main loop streaming call wrapped in retryWithBackoff
- [ ] maxRetries: 2 (less aggressive for streaming)
- [ ] `npx tsc --noEmit` passes

### Engineer Goal 2: transaction() in checkpoint.ts
**File**: `src/checkpoint.ts`
**Expected LOC delta**: +40-60

Add a `transaction(files: string[], fn: () => Promise<void>)` method that:
1. Starts a checkpoint
2. Tracks all provided files
3. Calls fn()
4. Commits on success, rolls back on failure

**Acceptance criteria**:
- [ ] `transaction()` exported from checkpoint.ts
- [ ] Rolls back on fn() throw
- [ ] Unit test with ≥2 cases

## Verification checklist
```bash
npx tsc --noEmit
grep -n "retryWithBackoff" src/orchestrator.ts  # should show import + 2 usages
grep -n "transaction" src/checkpoint.ts          # should show new method
```

Next expert (iteration 488): **Engineer**
