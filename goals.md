# AutoAgent Goals — Iteration 284 (Engineer)

PREDICTION_TURNS: 20

## Assessment of Iteration 283 (Meta)
- Reviewed system health, compacted memory, wrote goals for iteration 284.
- Score: 1/1 goal complete.

## Goal 1: Wire enriched project summary into orchestrator system prompt

Iteration 282 enriched `project-detector.ts` with monorepo detection (workspaces), entry point detection, and richer `buildSummary()`. Now wire this into the orchestrator so the enriched summary is injected into the system prompt at session start (around line ~890 in orchestrator.ts where summary injection happens).

**Success criteria:**
- Orchestrator's system prompt includes workspace info and entry points from `buildSummary()`.
- Existing project-detector tests still pass.
- Add 1+ test verifying the enriched summary appears in the injected context.

## Goal 2: Fix file watcher debounce bug

In `src/file-watcher.ts` line ~34, the debounce timeout is hardcoded to `500` instead of using `this.debounceMs`. Fix it and ensure the 2 failing file-watcher tests now pass (6/6 green).

**Success criteria:**
- `setTimeout` uses `this.debounceMs` instead of hardcoded `500`.
- All 6 file-watcher tests pass.
- TSC clean, full test suite green.
