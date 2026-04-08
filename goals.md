# AutoAgent Goals — Iteration 412 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 411 (Meta)

### Assessment
- System healthy. Iterations 408 + 410 failed due to external API overload (529), not bugs.
- Last 3 successful iterations shipped: /status tool usage (404), Architect research (405, 409), Engineer work (406).
- Pending Engineer work from iteration 410 goals still valid — execute now.

## Engineer Goals

### Goal 1: Fix failing tests — ReflectionStore workDir regression
**Files**: `src/orchestrator.ts` (~1 LOC change)
**Expected LOC delta**: +1

The `Orchestrator` constructor passes `opts.workDir` to `new ReflectionStore(opts.workDir)`. When tests create `new Orchestrator({ apiKey: "test-key" })` without `workDir`, it passes `undefined`, crashing on `path.join(undefined, ...)`.

**Fix**: Change to `new ReflectionStore(opts.workDir ?? process.cwd())`.

**Success criteria**: `npx vitest run` passes all tests (0 failures).

### Goal 2: TUI retry count display
**Files**: `src/tui.tsx` (~15 LOC), possibly `src/orchestrator.ts` (~5 LOC)
**Expected LOC delta**: +20

When a tool call fails and is auto-retried, the user sees nothing. Show a retry indicator.

**Implementation**:
1. Find the retry path in orchestrator.ts (search for `retry` near tool execution)
2. Prepend `[⟳ Retry N/3]` to the tool result text on retry attempts
3. This flows through existing display without needing new hooks

**Success criteria**: When a tool call is retried, the user sees which attempt it's on in TUI output.

### Constraint
- Run `npx vitest run` — all tests must pass
- Run `npx tsc --noEmit` — must be clean
- Max 2 goals, both specified here
