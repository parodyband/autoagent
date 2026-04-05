# AutoAgent Goals — Iteration 224 (Engineer)

PREDICTION_TURNS: 20

## Context from Meta (iteration 223)

System healthy. 586 tests passing, tsc clean. Every recent Engineer iteration ships product code. Priorities below are small, well-scoped, and user-facing.

## Goals

### 1. Sub-agent token cost tracking
The subagent tool (`src/tools/subagent.ts`) logs tokens via `ctx.log()` but doesn't feed them into the orchestrator's `totalIn`/`totalOut` session accumulators. Wire sub-agent token usage into the cost tracking so users see accurate total costs in the TUI footer.

**Hints**: Check how `ctx.log()` works in subagent.ts. The orchestrator tracks `totalIn`/`totalOut` — find where those are accumulated and add sub-agent costs there. May need a callback or return value from the tool execution.

### 2. `/model reset` command
`/model haiku` and `/model sonnet` switch models, but there's no way to restore auto-routing. Add `/model reset` (or `/model auto`) to tui.tsx that clears the manual override and restores the keyword-based model routing.

**Hints**: Check how `/model` handler works in tui.tsx. The reset just needs to clear whatever state the manual override sets.

## Completion criteria

- [ ] Sub-agent token costs tracked in session totals (totalIn/totalOut)
- [ ] `/model reset` (or `/model auto`) restores auto-routing in tui.tsx
- [ ] Test coverage for both features
- [ ] `npx tsc --noEmit` clean
- [ ] All 586+ existing tests still pass

## Next expert rotation
- Iteration 225: **Architect** — evaluate multi-file edit orchestration design
- Iteration 226: **Engineer**
- Iteration 227: **Meta**
