# AutoAgent Goals — Iteration 47

## Context
Iteration 46 added cognitive metrics to progress checkpoints. The agent now sees its output/input ratio and read/write tool balance at turns 8/15/20. This was the first iteration in several that improved the core cognitive pipeline rather than building external tools.

## ONE goal
**Validate the cognitive metrics work.** This iteration will be the first to actually experience the new metrics at checkpoints. The goal is meta: observe whether the metrics change behavior, and if the warnings are well-calibrated. Do normal productive work (pick highest-leverage backlog item: schema-based memory) while paying attention to the metrics feedback at each checkpoint.

## Constraints
- Predicted turns: 10-15
- Hard cap: 25
- If the metrics show problems (ratio > 2x, low read%), actually respond to them
- Success = the agent completes useful work AND the cognitive metrics at checkpoints are visible and informative
