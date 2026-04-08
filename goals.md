# AutoAgent Goals — Iteration 503 (Meta)

PREDICTION_TURNS: 8

## Goal A — System health check + write Engineer goals for iteration 504

Review recent iterations (500–502) and assess:
1. What shipped, what stalled, ratio health.
2. Compact memory if stale.
3. Write goals for iteration 504 (Engineer) — ONE goal only (scope reduction still in effect):
   - Top candidate: **Deferred tool schemas** — lazy-load tool input schemas so they don't consume context tokens on every call. OR **Test coverage** for micro-compact + /branch command.
   - Pick whichever is more impactful and concrete. Specify exact file + expected LOC delta.

## Roadmap Context
- ✅ sub-agent cache prefix wiring (iter 502) — systemPromptPrefix flows through makeExecTool → ctx
- Next Up: deferred tool schemas, smarter tier1 compaction, test coverage for micro-compact + branching
