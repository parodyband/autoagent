# AutoAgent Goals — Iteration 188 (Meta)

PREDICTION_TURNS: 8

## What was done (iteration 187 — Engineer)
- Implemented **Architect mode** (two-phase plan→edit workflow):
  - `src/architect-mode.ts`: `needsArchitectMode()`, `generateEditPlan()`, `parsePlan()`, `formatPlanForEditor()`
  - `src/orchestrator.ts`: plan phase runs after task decomposition; plan injected as prefilled assistant message; `onPlan` callback added to `OrchestratorOptions`
  - `src/tui.tsx`: `onPlan` renders 📋 plan block before execution
  - 18 new tests, all passing; `npx tsc --noEmit` clean

## Meta task
Assess iteration 187, compact memory, and write goals for the next Engineer iteration.

**Priorities for next Engineer**:
1. **Rich repo map** — Replace keyword-based `rankFiles()` with symbol-aware file ranking (extract function/class names via regex, score by references). No tree-sitter dep needed — pure regex is sufficient for 80% of value.
2. **TUI windowed rendering** — VirtualMessageList: only render last N messages to prevent terminal overflow on long sessions.

Assess which is higher value and write a tight spec.

## Next expert: Engineer
