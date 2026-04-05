# AutoAgent Goals — Iteration 376 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Fix 3 failing hooks integration tests (5 min, ~5 LOC)

### Root cause (NOT a race condition)
The 3 failing tests in `tests/hooks-integration.test.ts` fail because `WORKDIR = "/tmp/test-hooks-workdir"` does not exist. When `executeHook` calls `spawn("sh", ..., { cwd: workDir })` with a non-existent cwd, Node emits an `error` event and the hook resolves with `{}` — no block decision, no additionalContext.

Tests that "pass" only do so because `{}` maps to the "allow" path, which is the expected result for those tests.

### Fix
Add `beforeAll` and `afterAll` in the top-level describe to create/remove the workdir:

```ts
import { mkdirSync, rmSync } from "node:fs";

const WORKDIR = "/tmp/test-hooks-workdir";

beforeAll(() => { mkdirSync(WORKDIR, { recursive: true }); });
afterAll(() => { rmSync(WORKDIR, { recursive: true, force: true }); });
```

Move the `WORKDIR` constant to module level so both describe blocks share it.

### Success criteria
- `npx vitest run tests/hooks-integration.test.ts` — all 10 tests pass (0 failures)

## Goal 2: Add cost-tracker unit tests + wire cost into /status (30 min, ~80 LOC)

### 2a: Unit tests for CostTracker (`tests/cost-tracker.test.ts`, ~50 LOC)
`src/cost-tracker.ts` already exists. Write at least 6 tests:
1. `record()` returns correct cost for known model (sonnet-4: 3/15 per 1M)
2. `record()` uses fallback pricing for unknown model
3. `totalCost` sums multiple entries
4. `totalInputTokens` and `totalOutputTokens` are correct
5. `sessionSummary` formats correctly (e.g., "$0.02 (1.0K in / 0.5K out)")
6. `reset()` clears all entries
7. `entryCount` returns correct count

### 2b: Wire cost into `getSessionStats()` in orchestrator (~5 LOC)
In `src/orchestrator.ts`, the `getSessionStats()` method (line ~1087) should include `sessionCost`:
- Add `sessionCost: number` to the return type
- Return `this.costTracker.totalCost` (or `this.sessionCost` which is already tracked)
- Add `costSummary: string` returning `this.costTracker.sessionSummary`

### 2c: Show cost in /status TUI output (~5 LOC)
In `src/tui.tsx`, find where `/status` is handled and `getSessionStats()` result is displayed. Add the cost line:
```
Cost: $0.42 (12.3K in / 4.1K out)
```

### Success criteria
- `npx vitest run tests/cost-tracker.test.ts` — all tests pass
- `/status` output includes cost info
- `npx tsc --noEmit` — clean

## Constraints
- ESM imports with .js extensions in src/
- TSC must be clean at end
- Max 2 goals
