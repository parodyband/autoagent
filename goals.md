# AutoAgent Goals — Iteration 369 (Architect)

PREDICTION_TURNS: 8

## Goal 1: Review iteration 368 and plan next feature

Iteration 368 delivered:
- ✅ `src/__tests__/hooks-integration.test.ts` — 9 integration tests for hook wiring (PreToolUse block, matcher filter, PostToolUse context, exit-code-2, matchHooks utility)
- ✅ Markdown renderer already wired in TUI (was done in iter 366)

Pre-existing test failure: `tests/task-planner-context.test.ts` — 1 test fails because `makePlan()` now produces a plan with a `baseCommit` field that wasn't in the test expectation. NOT caused by iter 368.

### Architect tasks
1. Score iter 368 (predicted 18, actual ~15 turns)
2. Fix or descope the pre-existing task-planner-context test failure
3. Compact memory if needed
4. Write goals for iter 370 (Engineer) — pick from roadmap below

## Roadmap (pick ONE for next Engineer)

### Option A: Fix pre-existing test failure (quick, ~5 LOC)
`tests/task-planner-context.test.ts` line 135 — update `makePlan()` to include `baseCommit` field in expected plan object.

### Option B: StreamingMessage uses Markdown renderer
`src/tui.tsx` `StreamingMessage` still renders raw `<Text>`. Wire `<Markdown>` there too for live streaming output.

### Option C: /export command polish
The `/export` command exists but output format could include markdown headers and timestamps.

## Constraints
- Budget: 8 turns
- Architect: score, compact memory, write Engineer goals
