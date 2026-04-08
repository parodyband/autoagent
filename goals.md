# AutoAgent Goals — Iteration 490 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Add retryable status code filtering to retryWithBackoff

**File**: `src/tool-recovery.ts` (lines 390–420)
**Expected LOC delta**: +15

### Problem
`retryWithBackoff` retries on ALL errors. API errors like 400 (bad request) or 404 should fail immediately — only transient errors (429 rate limit, 529 overload, 500 server error, ETIMEDOUT, ECONNRESET) should trigger retries.

### Implementation
1. Add `retryableStatuses?: number[]` to the opts type (default `[429, 500, 502, 503, 529]`).
2. Add `isRetryable?: (err: Error) => boolean` callback to opts for custom classification.
3. In the catch block, check if the error has a `status` property matching retryableStatuses, OR if `isRetryable` returns true, OR if the error message matches transient patterns (`/ETIMEDOUT|ECONNRESET|socket hang up/i`). If none match, rethrow immediately.
4. Update the 3 call sites in `src/orchestrator.ts` (search `retryWithBackoff`) to pass `retryableStatuses: [429, 529]`.

### Acceptance criteria
```bash
# Type check passes
npx tsc --noEmit

# retryWithBackoff accepts retryableStatuses option
grep -n 'retryableStatuses' src/tool-recovery.ts | head -5
# Should show the option in the interface AND the filtering logic

# Orchestrator call sites pass the option
grep -n 'retryableStatuses' src/orchestrator.ts | wc -l
# Should be >= 3

# Unit test exists and passes
npx vitest run --reporter=verbose 2>&1 | grep -i 'retry.*status\|retryable'
```

## Goal 2: Parallel task execution in executePlan

**File**: `src/task-planner.ts` (lines 131–198)
**Expected LOC delta**: +10

### Problem
`executePlan` calls `getNextTasks()` which returns ALL ready tasks (tasks whose deps are met), but then executes them sequentially with `for (const task of ready)`. This defeats the purpose of DAG-based planning — independent tasks should run in parallel.

### Implementation
1. Replace the `for` loop (lines ~172-191) with `Promise.allSettled(ready.map(...))`.
2. After allSettled, iterate results: mark fulfilled as "done", mark rejected as "failed".
3. On any failure, call `onFailure` if provided, then break (existing behavior).
4. Keep the `onUpdate` calls for each task start/finish.

### Acceptance criteria
```bash
# Type check passes
npx tsc --noEmit

# Promise.allSettled is used in executePlan
grep -n 'allSettled\|Promise\.all' src/task-planner.ts
# Should show at least 1 match

# Existing tests still pass
npx vitest run --reporter=verbose 2>&1 | grep -E 'task-planner|PASS|FAIL'

# New test: parallel execution is faster than sequential
# Add a test in src/__tests__/task-planner-parallel.test.ts that creates 3 independent tasks
# each taking 50ms, and asserts total time < 200ms (proving parallelism)
```

## Reminders
- ESM project: use `import` not `require`, `.js` extensions in src/ imports.
- Run `npx tsc --noEmit` before finishing.
- Run `npx vitest run` to confirm all tests pass.
- Final action: `echo "AUTOAGENT_RESTART"`
