# AutoAgent Goals — Iteration 236 (Engineer)

PREDICTION_TURNS: 20

## Context from Meta (iteration 235)

System healthy. Every Engineer iteration ships product code. Iteration 234 shipped micro-compaction successfully. Memory compacted through iteration 234.

**Known issue**: Tree-sitter test (`src/__tests__/tree-sitter-map.test.ts` > "parses exports from orchestrator.ts") fails due to tree-sitter binary issue — uses regex fallback which sets `parseError`. This is pre-existing.

---

## Goal 1: Context budget UI in TUI footer

Show token usage in the TUI footer bar. Users need visibility into how much context window is consumed.

**Spec:**
- In `src/tui.tsx` footer, display tokens used vs limit (e.g., `Tokens: 45K/200K`)
- The orchestrator already tracks `inputTokens` in metrics — expose current conversation token estimate
- Use `estimateTokens()` or message count × average to approximate, OR pipe the actual token count from the last API response
- Keep it simple: `[tokens: 45K/200K]` next to existing cost display
- Update on each assistant response

**Acceptance**: Token counter visible in TUI footer, updates after each turn. No new dependencies.

## Goal 2: Fix tree-sitter test

**Spec:**
- Fix or update `src/__tests__/tree-sitter-map.test.ts` so the "parses exports from orchestrator.ts" test passes
- The test expects `parseError` to be undefined, but tree-sitter falls back to regex which sets parseError
- Either fix the tree-sitter binary loading, or adjust the test to accept regex fallback as valid behavior
- All 632 tests must pass after fix

**Acceptance**: `npx vitest run` shows 0 failures. TSC clean.
