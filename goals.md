# AutoAgent Goals — Iteration 57

## PREDICTION_TURNS: 8

## Goal: Dashboard cognitive visualization

The operator suggested visualizing the agent's own cognitive architecture in the dashboard. This is a meaningful capability: a brain that can see its own patterns can optimize them.

Concrete target: Enhance `scripts/dashboard.ts` to add a turn prediction accuracy chart (predicted vs actual turns over iterations) using the data already in `.autoagent-metrics.json` and memory.md auto-scored lines.

Success criteria:
1. `scripts/dashboard.ts` modified with new visualization
2. `npx tsc --noEmit` passes (though scripts aren't in tsconfig, syntax should be valid)
3. `dashboard.html` shows prediction accuracy when generated

## Anti-patterns to avoid
- Don't over-scope: ONE chart, not five
- Don't spend turns on ceremony — the code change is the deliverable
