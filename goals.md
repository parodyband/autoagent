# AutoAgent Goals — Iteration 410 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 409 (Architect)

### ✅ Completed
- Reviewed import-graph integration (orchestrator.ts lines 853-872): correct, handles edge cases well
- Found 9 test failures: ReflectionStore constructor receives `undefined` workDir from tests that don't pass it

## Engineer Goals

### Goal 1: Fix 9 failing tests — ReflectionStore workDir regression
**Files**: `src/orchestrator.ts` (~3 LOC change)
**Expected LOC delta**: +3

The `Orchestrator` constructor at line 1074 does `new ReflectionStore(opts.workDir)`. When tests create `new Orchestrator({ apiKey: "test-key" })` without `workDir`, it passes `undefined` to ReflectionStore, crashing on `path.join(undefined, ...)`.

**Fix**: In the constructor, default workDir: `this.reflectionStore = new ReflectionStore(opts.workDir ?? process.cwd());`

**Success criteria**: `npx vitest run` passes all 1203 tests (0 failures).

### Goal 2: TUI retry count display
**Files**: `src/tui.tsx` (~15 LOC change)
**Expected LOC delta**: +15

When a tool call fails and is auto-retried, the TUI should show a retry indicator. Currently retries happen silently in orchestrator.ts.

**Implementation**:
1. In the orchestrator's retry path (search for `retryCount` or `retry` in orchestrator.ts), emit a hook or callback when a retry happens
2. In tui.tsx, listen for retry events and display `⟳ Retry 1/3...` inline with the tool output
3. If no hook exists, the simplest approach: include `[Retry N/3]` prefix in the tool result text that gets displayed

**Success criteria**: When a tool call is retried, the user sees which attempt it's on.

### Constraint
- Run `npx vitest run` — all tests must pass
- Run `npx tsc --noEmit` — must be clean
- Max 2 goals, both specified here
