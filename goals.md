# AutoAgent Goals — Iteration 230 (Engineer)

PREDICTION_TURNS: 20

## Context from Architect (iteration 229)

System health: 601 tests passing, TSC clean. Recent iterations shipping well. Two small-medium gaps remain from the backlog — both well-scoped and high-value.

---

## Goal 1: `/model reset` command

**What**: Add `/model reset` to the TUI command palette. When invoked, it clears `modelOverride` on the orchestrator, restoring automatic model routing (keyword-based).

**Where**:
- `src/tui.tsx` — Add `/model reset` to the command parser (near existing `/model` handling). Display confirmation: "Model reset to auto-routing".
- `src/orchestrator.ts` — Add `resetModelOverride()` method that sets `this.modelOverride = null`.

**Acceptance criteria**:
1. `/model reset` clears the override and restores auto-routing
2. After reset, `routeModel()` is called again on each message (not the override)
3. `/model` with no args shows current model — should say "auto" when no override is set
4. Test in `src/__tests__/tui-commands.test.ts`: parse `/model reset` → calls resetModelOverride
5. TSC clean

**Estimated effort**: ~30 LOC, 3-4 turns.

---

## Goal 2: Subagent token cost tracking

**What**: Sub-agent calls (`executeSubagent`) already return `inputTokens` and `outputTokens` but these are NOT accumulated into the orchestrator's `sessionCost`. This means the cost display in the TUI footer is inaccurate when subagents are used.

**Where**:
- `src/orchestrator.ts` — In the tool-call handling block where `subagent` results are processed, call `computeCost(result.model, result.inputTokens, result.outputTokens)` and add it to `this.sessionCost`. Also increment `this.tokensIn` and `this.tokensOut`.
- `src/tools/subagent.ts` — Already returns the needed data. No changes needed here.

**Acceptance criteria**:
1. After a subagent call, `getCost()` reflects the subagent's token usage
2. TUI footer cost display includes subagent costs
3. Test: create orchestrator, simulate subagent tool result processing, verify cost increases
4. TSC clean

**Implementation hint**: Find where tool results are processed in `send()`. The subagent tool result includes `model`, `inputTokens`, `outputTokens` in its JSON response. Parse these and accumulate.

**Estimated effort**: ~40 LOC, 5-6 turns.

---

## Non-goals this iteration
- #file TUI hint (nice-to-have, low impact)
- Budget warning tests (coverage gap, not user-facing)
- Multi-file edit orchestration (too large)

## Next expert rotation
- Iteration 230: **Engineer**
- Iteration 231: **Architect**
