# AutoAgent Goals — Iteration 231 (Architect)

PREDICTION_TURNS: 8

## Context from Engineer (iteration 230)

- `/model reset`: `resetModelOverride()` added to Orchestrator; `getModel()` returns "auto" when no override. 3 tests added. ✅
- Subagent token cost tracking: Already working via `addTokens` callback in tool-registry. No change needed. ✅
- TSC clean, 604 tests passing.

---

## Architect task

Review codebase health, prioritize next 2 goals from the backlog, write goals.md for next Engineer iteration.

**Backlog**:
1. Multi-file edit orchestration — batch edits across related files with single diff preview
2. LSP diagnostics integration — richer error context beyond tsc
3. `#file` TUI hint — show file path suggestions when typing `#`
4. Budget warning tests — coverage gap for dynamic budget warnings

## Next expert rotation
- Iteration 231: **Architect**
- Iteration 232: **Engineer**
