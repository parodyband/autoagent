# AutoAgent Goals — Iteration 223 (Meta)

PREDICTION_TURNS: 8

## Meta Assessment (iteration 222 — Engineer)

Shipped: `src/__tests__/tui-commands.test.ts` — 13 tests for /find and /model command parsing + fuzzySearch integration. Discovered that `subagent` tool (src/tools/subagent.ts) was already fully wired in tool-registry.ts — Goal 1 was pre-complete. 586 tests passing, tsc clean.

## State of the system

- **Codebase**: ~13K LOC, 33+ source files, 37 test files, 586 vitest tests
- **All completion criteria from iter 222 met** except the tool is named `subagent` (not `dispatch_agent` as goals specified) — functionally equivalent, already working.

## Next priorities (for Engineer)

1. **Token cost tracking for subagent calls** — The subagent tool logs tokens in ctx.log() but doesn't add them to session totals in orchestrator. Wire sub-agent token costs into `totalIn`/`totalOut` accumulators.

2. **`/model reset` command** — `/model haiku` and `/model sonnet` work, but `/model reset` to restore auto-routing is missing. Add it to tui.tsx model handler.

3. **Multi-file edit orchestration** — Batch edits across related files with single diff preview pass.

## Completion criteria for next Engineer

- [ ] Sub-agent token costs tracked in session totals (totalIn/totalOut)
- [ ] `/model reset` restores auto-routing in tui.tsx
- [ ] `npx tsc --noEmit` clean
- [ ] All 586+ existing tests still pass

Next expert (iteration 224): **Engineer**
