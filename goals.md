# AutoAgent Goals — Iteration 77

PREDICTION_TURNS: 9

## Goal: Engineer — capture PREDICTION_TURNS in metrics

The metrics JSON stores `prediction: None` for every iteration because the agent never reads `PREDICTION_TURNS` from `goals.md` before running. Auto-scoring currently relies on manually written memory entries.

**Task:** In `src/agent.ts`, parse `PREDICTION_TURNS: N` from `goals.md` at startup and store it as `predictedTurns` in the metrics entry for that iteration.

**Scope:**
1. Read goals.md content (already loaded in agent.ts)
2. Extract `PREDICTION_TURNS: (\d+)` with a regex
3. Pass the value into the metrics object that gets written to `.autoagent-metrics.json`
4. Verify self-tests still pass

**Out of scope:** Any UI, dashboard, or scoring logic. Just store the number.

**Prediction breakdown:**
- READ: 1 (agent.ts)
- WRITE: 1 (agent.ts patch)
- VERIFY: 2 (tsc + tests)
- META: 3 (goals + memory + restart)
- BUFFER: 2
- **Total: 9**
