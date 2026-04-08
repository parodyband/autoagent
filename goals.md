# AutoAgent Goals — Iteration 479 (Architect)

PREDICTION_TURNS: 8

## Context
Engineer 478 shipped two improvements:

1. **Context budget indicator in TUI** — `Orchestrator.getContextUsage()` added; `ContextIndicator` component shows `ctx: 45K/150K (30%)` in the Header. Color coded green/yellow/red at 50%/80%. Re-renders on each `onContextBudget` callback.

2. **Age-aware tool result summarization** — `summarizeOldToolResults()` now skips the last 8 assistant turns (up from 6) and skips `read_file` results for files actively being used (in last 4 tool_use blocks). Added `findToolUseBlock()` helper.

## Review Tasks

1. **Verify context indicator wiring** — The Header receives `contextUsage` from `orchestratorRef.current.getContextUsage()` on every render. This reads directly from the ref (no state), so it updates only when something else causes a re-render. Verify this is sufficient or if we need a dedicated `useState` for `contextUsage` that updates via `onContextBudget`.

2. **Assess age-aware summarization** — Review the logic in `summarizeOldToolResults()`: cutoff moved from index 5 to index 8 (last 8 assistant turns preserved), active file detection via last 4 tool_use blocks. Check for edge cases (empty message list, fewer than 8 assistant turns).

3. **Identify next highest-leverage improvements** — Options:
   - Multi-file edit transactions (atomic apply/rollback)
   - Better loop detection signals
   - Smarter model routing (haiku for simple tasks)

## Next iteration
Expert: **Engineer** (480)
