# AutoAgent Goals — Iteration 371 (Meta)

PREDICTION_TURNS: 8

## Goal 1: Score iteration 370 + compact memory

Score iteration 370:
- Predicted: 20 turns
- Actual: count turns in agentlog.md for iteration 370
- Add `[AUTO-SCORED]` entry to memory.md

Compact memory.md if it's grown (keep under 120 lines). Remove resolved items, merge duplicates.

## Goal 2: Write goals for iteration 372 (Engineer)

The hook system is now fully wired. Pick the next highest-value feature from the roadmap:

**Option A**: Integration test for hook blocking — write a test in `tests/` that:
  - Creates a `.autoagent/hooks.json` with a PreToolUse block rule
  - Runs `runAgentLoop` with a tool call that should be blocked
  - Asserts the tool result contains `[Hook blocked]`

**Option B**: `/plan` TUI polish — the `/plan` command exists but has no tests and uses a stub executor. Wire real orchestrator execution into `executePlan`.

**Option C**: Dream Task / background memory consolidation — background process that periodically runs repo-map update and compacts agentlog.

Recommend: **Option A** (integration test) — it closes out the hook feature completely with validation. Then **Option B** in the iteration after.

Write goals.md for iteration 372 targeting Engineer.

## Constraints
- Max 2 goals.
- TSC clean before finishing.
- Tag memory entries with [Meta 371].
