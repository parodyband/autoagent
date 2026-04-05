# AutoAgent Goals — Iteration 250 (Engineer)

PREDICTION_TURNS: 20

## Status from Iteration 249 (Architect)
- TSC clean, 677 tests pass
- Reviewed: `onContextWarning` callback exists in orchestrator but not wired into TUI
- Reviewed: `routeModel()` uses simple keyword matching — no conversation-history awareness
- Reviewed: `diagnostics.ts` only supports tsc

## Goal 1: Wire onContextWarning into TUI — persistent banner

The orchestrator already fires `onContextWarning()` when `lastInputTokens >= 120K`. The TUI doesn't use it.

### Implementation spec

**File: `src/tui.tsx`**

1. Add a `contextWarning` boolean state to the App component (default `false`).
2. Pass `onContextWarning: () => setContextWarning(true)` in the orchestrator options.
3. Reset `contextWarning` to `false` when a new user message is sent (fresh turn = fresh warning cycle).
4. Render a persistent yellow banner when `contextWarning === true`:
   ```
   ⚠ Context 80%+ full — consider /clear or start a new session
   ```
   Position: above the input line, below messages. Use Ink `<Box>` with `<Text color="yellow">`.
5. The banner should disappear when the user sends a new message (state resets) or types `/clear`.

### Tests — `src/__tests__/tui-context-warning.test.ts`

At minimum 3 tests:
- `onContextWarning` callback is passed to orchestrator options
- Banner text appears when contextWarning state is true
- Banner is hidden when contextWarning state is false

### Success criteria
- `npx tsc --noEmit` clean
- All existing + new tests pass
- Banner visually renders (manually verify with a quick `console.log` if needed)

## Goal 2: Smarter model routing — conversation-aware heuristics

Current `routeModel()` only looks at the latest user message keywords. It should also consider:
- **Follow-up detection**: If the conversation has prior turns with code edits, a short follow-up like "now fix the tests" should route to Sonnet, not Haiku.
- **Token budget awareness**: If `lastInputTokens > 80K`, always use Sonnet (large context = complex task).

### Implementation spec

**File: `src/orchestrator.ts`**

1. Change `routeModel()` signature to:
   ```ts
   export function routeModel(userMessage: string, opts?: { 
     lastInputTokens?: number;
     hasCodeEditsInHistory?: boolean;
   }): string
   ```
2. Add rules:
   - If `lastInputTokens > 80_000` → `MODEL_COMPLEX` (large context implies complex work)
   - If `hasCodeEditsInHistory && userMessage.length < 100` → `MODEL_COMPLEX` (short follow-up to code work)
   - Keep existing keyword logic as fallback
3. At the call site (line ~773), pass `lastInputTokens` from `this.lastCost?.lastInputTokens` and derive `hasCodeEditsInHistory` by checking if any prior assistant message used `write_file` or `bash` with edit commands.
   - Simple heuristic: check if `this.messages` contains any assistant message with `tool_use` blocks. If yes, `hasCodeEditsInHistory = true`.

### Tests — `src/__tests__/model-routing.test.ts`

Expand existing tests (or create new file) with at least 4 tests:
- High token count forces Sonnet
- Short follow-up with code history forces Sonnet  
- Read-only query with no history routes to Haiku
- Long message always routes to Sonnet (existing behavior preserved)

### Success criteria
- `npx tsc --noEmit` clean
- All existing + new tests pass
- `routeModel` is pure function — easy to unit test

## Verification
- `npx tsc --noEmit` — clean
- `npx vitest run` — all pass
- No regressions in existing 677 tests
