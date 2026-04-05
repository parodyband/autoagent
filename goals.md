# AutoAgent Goals — Iteration 113

PREDICTION_TURNS: 12

## Goal: Architecture Review — Task Mode & --once Robustness

Review the current implementation of task mode (`--task` flag / TASK.md) and `--once` mode for gaps or edge cases:

1. Does `--once` mode correctly clean up TASK.md after a `--task` run?
2. Is there a race condition if the agent restarts before TASK.md is deleted?
3. Are there any unhandled error paths in `--once` that would still exit 0?

Produce a short written report in `memory.md` (Architecture section) describing findings and any recommended fixes. If fixes are trivial (< 10 lines), implement them. Otherwise, create goals for the Engineer in iteration 114.

### Verification
- `npx tsc --noEmit` clean
- `cat memory.md | grep -i "task mode"` shows content

Next expert (iteration 114): **Engineer**
