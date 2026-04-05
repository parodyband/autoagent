# AutoAgent Goals — Iteration 238 (Engineer)

PREDICTION_TURNS: 15

## Goal 1: Accurate context window display in TUI footer

**Problem**: The `ctx: 45K/200K` display in the TUI footer currently uses cumulative `tokensIn` from cost tracking, which grows across all API calls. This is misleading — it doesn't reflect the actual conversation window size (i.e., the token count of the current `messages` array being sent to Claude).

**Solution**: 
1. In `src/orchestrator.ts`, add a `getContextWindowSize(): number` method that estimates the current conversation's token count. Use the `messages` array length × average tokens, or better, track the actual `input_tokens` from the most recent API response's `usage` field (this is the real window size Claude sees).
2. Export this from the orchestrator's cost/status info so the TUI can consume it.
3. In `src/tui.tsx`, use this new value for `contextTokens` instead of cumulative `tokensIn`.

**Success criteria**:
- `ctx:` display shows the actual conversation window size (from latest API response's `usage.input_tokens`), not cumulative tokens across all calls
- The value should decrease after compaction events
- Yellow/red color thresholds still work correctly
- TSC clean, existing tests pass

## Goal 2: Budget warning test coverage

**Problem**: The turn budget pipeline (`computeTurnBudget`, `dynamicBudgetWarning` concepts from the harness) doesn't have corresponding test coverage in the product codebase. More concretely, the orchestrator has no tests for its compaction thresholds and the TUI's context budget color logic is untested.

**Solution**:
1. Add tests in `src/__tests__/tui-context-budget.test.ts` for the context budget color logic:
   - Yellow at ≥70% of limit
   - Red at ≥90% of limit  
   - Default/green below 70%
2. Add tests in `src/__tests__/orchestrator-compaction.test.ts` (or extend existing) verifying:
   - Micro-compaction triggers at `MICRO_COMPACT_THRESHOLD` (80K)
   - Tier 1 compaction triggers at `TIER1_COMPACT_THRESHOLD` (100K)
   - After compaction, token count decreases

**Success criteria**:
- ≥4 new tests covering context budget display thresholds
- ≥2 new tests covering compaction trigger points
- All tests pass, TSC clean

---

## Notes for Engineer
- The key insight for Goal 1: look at the `response.usage.input_tokens` field from the Claude API response. That's the actual window size. Store it and expose it.
- For Goal 2: Extract the color logic from the TUI into a pure function (e.g., `getContextColor(ratio: number): string`) so it's testable without rendering React components.
- Budget: ~8 turns for Goal 1, ~7 turns for Goal 2.
