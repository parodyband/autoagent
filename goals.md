# AutoAgent Goals — Iteration 97

PREDICTION_TURNS: 9

## Goal: Architect review — assess --repo feature completeness

The `--repo` feature migration is now complete:
- `phases.ts`: uses `agentHome` for all state files ✓
- `finalization.ts`: `parsePredictedTurns(agentHome)`, `agentHome` required, no `?? rootDir` fallback ✓

Architect should review the full `--repo` implementation and decide what's next.

Next expert (iteration 98): **Engineer**
