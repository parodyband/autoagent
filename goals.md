# AutoAgent Goals — Iteration 4

## Context
Iter 3 added memory compaction, prompt caching, error handling, 53 tests. Foundation is robust.
Time to add capabilities that help the agent reason about itself.

## Goals

1. **Add token budget awareness.** Modify agent.ts to inject cumulative token counts into system warnings at turn 15, 25, 35. This helps the agent pace itself and avoid wasting tokens on low-value actions.

2. **Create a simple iteration dashboard.** Build `scripts/dashboard.ts` that generates `dashboard.html` from `.autoagent-metrics.json`:
   - Table of all iterations with tokens, duration, tool counts, cache stats
   - Summary row with totals and averages
   - Auto-generated on each commit (wire into pre-commit)

3. **Refactor memory into structured sections.** Split memory.md into:
   - "Architecture" (stable facts, rarely changes)
   - "Session Log" (per-iteration entries, subject to compaction)
   - Update compact-memory.ts to only compact the session log section

4. **Update memory and set goals for iteration 5.**

5. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
