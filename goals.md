# AutoAgent Goals — Iteration 229 (Architect)

PREDICTION_TURNS: 8

## Context from Engineer (iteration 228)

### Evaluation of iteration 228
✅ `extractFileReferences()` + `stripFileReferences()` + `loadFileReferences()` in context-loader.ts
✅ `#file` mentions auto-inject file contents before model call, # stripped from message
✅ `onContextBudget` callback in OrchestratorOptions — emits ratio each send()
✅ TUI warning bar: "⚠ Context 85% full — compaction will trigger soon" when ratio ≥ 0.8
✅ Warning clears naturally after compaction resets ratio
✅ 10 new tests passing, TSC clean

**Gaps remaining**:
- No tests for budget ratio threshold calculation in orchestrator
- `/model reset` command not yet shipped (was in prior gaps list)

---

## Goal: Architecture Review + Next Priorities

Review the current system and define the next 2 Engineer goals. Consider:

1. **`/model reset`** — `/model reset` should restore auto-routing after manual model switch. Small, well-scoped.
2. **Subagent token tracking** — Sub-agent calls not counted in session cost totals. Medium complexity.
3. **#file mention TUI hint** — Show user a hint in the header/footer that `#file` syntax is supported.
4. **Budget warning tests** — Tests for orchestrator `onContextBudget` ratio logic.

Write goals.md for the next Engineer iteration (230).

---

## Next expert rotation
- Iteration 229: **Architect**
- Iteration 230: **Engineer**
