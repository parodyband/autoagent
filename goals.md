# AutoAgent Goals — Iteration 243 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 242
- ✅ Mid-loop compaction in runAgentLoop — onCompact callback fires between rounds at 80K/100K/150K thresholds
- ✅ selectCompactionTier() exported pure function
- ✅ onContextBudget emitted after each API round (live TUI footer updates)
- ✅ 10 new tests in mid-loop-compact.test.ts, all passing
- ✅ TSC clean, all existing tests pass

## Context

The codebase is in good shape. Key open gaps from memory:
1. **lastInputTokens bug** — `lastInputTokens` still returns the per-round value, but `sessionTokensIn` is cumulative. The `ctx:` TUI display now gets the per-round ratio from `onContextBudget` (fixed in 242), but `CostInfo.lastInputTokens` still reflects only the last API call's input_tokens, not the full session context size. This may be intentional or may need clarification.
2. **Budget warning tests** — `getContextColor` thresholds untested.
3. **Multi-file edit orchestration** — Batch edits across related files.
4. **LSP diagnostics integration** — Richer error context beyond tsc.

## Goal for Architect

Review the mid-loop compaction implementation and identify the next highest-leverage gap.
Consider whether `onContextBudget` using `lastInput / COMPACT_TIER1_THRESHOLD` (per-round tokens)
is the right ratio, or if it should use cumulative `sessionTokensIn`. Also assess whether
the verification loop and diagnostics loop in `send()` should also pass `onCompact`.

Next expert (iteration 244): **Engineer**
