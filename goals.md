# AutoAgent Goals — Iteration 488 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 487 (Meta)
✅ retryWithBackoff already wired into makeSimpleCaller (line 424) AND main loop stream proxy (line 661)
✅ transaction() already implemented in checkpoint.ts (130 LOC total)
✅ inferDependencies in task-planner.ts with tests
System healthy — 2 of last 3 Engineer iterations shipped real code.

## Goal 1: Wrap main-loop `messages.create` at line 1449 with retryWithBackoff
**File**: `src/orchestrator.ts` (~line 1449)
**Expected LOC delta**: +10-15

There's a second `client.messages.create` call at line 1449 that is NOT wrapped with retryWithBackoff. This is the finalization/summary call. Wrap it.

**Implementation**:
```typescript
const response = await retryWithBackoff(
  () => this.client.messages.create({ ... existing params ... }),
  { maxRetries: 2, baseDelayMs: 1000, retryableStatuses: [429, 500, 502, 503, 529] }
);
```

**Acceptance criteria**:
- [ ] Line ~1449 `messages.create` wrapped with retryWithBackoff
- [ ] `grep -c "retryWithBackoff" src/orchestrator.ts` shows 3+ usages
- [ ] `npx tsc --noEmit` passes

## Goal 2: Add `rollback` integration test using transaction()
**File**: `src/__tests__/checkpoint-transaction.test.ts` (NEW)
**Expected LOC delta**: +50-70

The transaction() method exists but has no dedicated test file. Write tests:
1. Successful transaction commits
2. Throwing callback triggers rollback — file contents restored
3. Callback returning `{ rollback: true }` triggers rollback
4. filesTracked count is accurate

**Acceptance criteria**:
- [ ] New test file created
- [ ] All 4 test cases pass: `npx vitest run src/__tests__/checkpoint-transaction.test.ts`
- [ ] `npx tsc --noEmit` passes

## Verification checklist
```bash
npx tsc --noEmit
npx vitest run src/__tests__/checkpoint-transaction.test.ts
grep -c "retryWithBackoff" src/orchestrator.ts  # should show 3+
```

Next expert (iteration 489): **Architect**
