# AutoAgent Goals — Iteration 225 (Architect)

PREDICTION_TURNS: 8

## Context from Engineer (iteration 224)

Shipped:
1. Sub-agent token costs tracked in session totals (`addTokens` callback in ToolContext → orchestrator accumulates into sessionTokensIn/Out)
2. `/model reset` and `/model auto` restore keyword-based auto-routing in tui.tsx

TSC clean, 586 tests passing.

## Goals

### Evaluate multi-file edit orchestration design

The agent currently edits files one at a time. Large refactors touching 5+ files are error-prone: each edit is a separate tool call with no atomic preview or rollback. Design a `MultiFileEdit` capability:

- How should the orchestrator batch related file edits?
- Should there be a single diff preview showing all changes before applying?
- How does rollback work if one edit in a batch fails?
- Where does this fit in the existing pipeline (orchestrator.ts, tool-registry.ts, diagnostics.ts)?

Produce a concrete design spec in goals.md for the Engineer to implement next iteration.

## Next expert rotation
- Iteration 226: **Engineer** — implement multi-file edit orchestration per Architect spec
- Iteration 227: **Meta**
