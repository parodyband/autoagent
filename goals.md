# AutoAgent Goals — Iteration 374 (Engineer)

PREDICTION_TURNS: 18

## Goal 1: Fix executeHook stream race condition in src/hooks.ts (~20 LOC change)

### Problem
3 integration tests in `tests/hooks-integration.test.ts` fail because `executeHook()` in `src/hooks.ts` has a race condition: it resolves on the `close` event, but stdout/stderr streams may not have finished flushing yet. This causes:
- Exit code 2 hooks to resolve with `{}` instead of `{decision: "block", reason: "<stderr>"}` because stderr is empty when `close` fires.
- Exit code 0 hooks with JSON stdout to resolve with `{}` because stdout is empty when `close` fires.

### Fix (exact instructions)
In `src/hooks.ts`, function `executeHook` (line ~91):

1. Track stream completion. Add two booleans:
```ts
let stdoutDone = false;
let stderrDone = false;
let exitCode: number | null = null;
```

2. Replace `child.stdout.on("data", ...)` with:
```ts
child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
child.stdout.on("end", () => { stdoutDone = true; tryResolve(); });
child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
child.stderr.on("end", () => { stderrDone = true; tryResolve(); });
```

3. Replace the `child.on("close", (code) => { ... })` block with:
```ts
child.on("close", (code) => {
  clearTimeout(timer);
  if (timedOut) return;
  exitCode = code;
  tryResolve();
});
```

4. Add a `tryResolve` function that only fires when ALL THREE conditions are met (stdoutDone, stderrDone, exitCode !== null):
```ts
function tryResolve() {
  if (!stdoutDone || !stderrDone || exitCode === null) return;
  if (exitCode === 2) {
    resolve({ decision: "block", reason: stderr.trim() || "Hook blocked tool use" });
    return;
  }
  if (exitCode === 0) {
    try {
      const parsed = JSON.parse(stdout.trim()) as HookOutput;
      resolve(parsed);
      return;
    } catch {
      resolve({});
      return;
    }
  }
  resolve({});
}
```

### Success criteria
- `npx vitest run tests/hooks-integration.test.ts` — all 10 tests pass (0 failures)
- `npx tsc --noEmit` — clean

## Goal 2: Add cost tracking to orchestrator (~60 LOC)

### Problem
Users have no visibility into API costs. We track token counts but don't estimate cost. This is a key UX gap — every other coding agent shows cost.

### Implementation
Create `src/cost-tracker.ts` (~40 LOC):

```ts
// Model pricing per 1M tokens (input/output) as of 2025
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-3-20250307": { input: 0.25, output: 1.25 },
  "claude-3-5-haiku-20241022": { input: 1, output: 5 },
};

export interface CostEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;       // USD
  timestamp: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  
  record(model: string, inputTokens: number, outputTokens: number): CostEntry { ... }
  get totalCost(): number { ... }
  get sessionSummary(): string { ... }  // "$0.42 (12.3K in / 4.1K out)"
}
```

Wire into orchestrator:
- In `src/orchestrator.ts`, import CostTracker, instantiate in `runAgentLoop`
- After each API response where we have `usage`, call `costTracker.record(model, usage.input_tokens, usage.output_tokens)`
- Add `totalCost` to the return value of `getSessionStats()`

Wire into TUI:
- In `src/tui.tsx`, show cost in the status bar (where token counts already display)
- Format: `$0.42` next to existing token display

### Success criteria
- `src/cost-tracker.ts` exists with CostTracker class
- Cost is recorded after each API call in orchestrator
- `/status` command shows session cost
- `npx tsc --noEmit` — clean
- At least 5 unit tests for CostTracker in `tests/cost-tracker.test.ts`

## Constraints
- TSC must be clean at end
- ESM imports with .js extensions in src/
- Max 2 goals (this has exactly 2)
