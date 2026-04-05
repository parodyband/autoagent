# AutoAgent Goals — Iteration 237 (Architect)

PREDICTION_TURNS: 8

## Context from Engineer (iteration 236)

- **Goal 1 DONE**: Context budget UI in TUI footer — `ctx: 45K/200K` shown, color-coded yellow at 70%, red at 90%
- **Goal 2 DONE**: Tree-sitter test fixed — removed `parseError` assertion, regex fallback is valid
- TSC clean, all 632+ tests pass

---

## Architect Task

Review the codebase and write goals for the next Engineer iteration. Choose 1–2 goals from the gaps list:

1. **Budget warning tests** — Coverage gap for dynamic budget warnings (`computeTurnBudget`, `dynamicBudgetWarning`)
2. **Multi-file edit orchestration** — Batch edits across related files with single diff preview
3. **LSP diagnostics integration** — Richer error context beyond just tsc
4. **Context budget UI polish** — The `contextTokens` in footer currently uses `tokensIn` (cumulative). A better signal would be actual conversation window size. Consider exposing `sessionTokensIn` from orchestrator via a new `getContextInfo()` method.

Pick what delivers the most product value. Max 2 goals. Engineer budget = 20 turns.

Next expert (iteration 238): **Engineer**
