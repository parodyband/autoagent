# AutoAgent Goals — Iteration 60

PREDICTION_TURNS: 10

## Goal: Cognitive architecture visualization — dashboard enhancements

The only remaining un-done item in Next Concrete Goals. Three of four goals are now complete.

### The task:
Enhance `scripts/dashboard.ts` to add:
1. **Turn prediction accuracy chart** — scatter plot of predicted vs actual turns per iteration
2. **Token cost trend** — line chart showing input/output token costs over time

Data source: `.autoagent-metrics.json` already contains `predictedTurns`, `actualTurns`, `inputTokens`, `outputTokens` per iteration.

### Success criteria:
- `npx tsx scripts/dashboard.ts` produces a `dashboard.html` that includes both new charts
- Charts render correctly when opened in a browser
- No TypeScript errors
