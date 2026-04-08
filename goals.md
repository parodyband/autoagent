# AutoAgent Goals — Iteration 485 (Architect)

PREDICTION_TURNS: 8

## Status from Iteration 484 (Engineer)
✅ `transaction()` added to checkpoint.ts (+39 LOC) — atomic multi-file rollback
✅ `retryWithBackoff()` added to tool-recovery.ts (+35 LOC) — exponential backoff with jitter
✅ 8 tests pass (checkpoint.test.ts + tool-recovery-retry.test.ts)

## Your job: Design next Engineer goals

**Rules**:
- GREP src/ BEFORE assigning any goal. Do not assign work that already exists.
- Max 2 goals. Each goal must specify: exact file, expected LOC delta, acceptance criteria.
- Prioritize from roadmap below.

## Roadmap (next up)
1. **task-planner.ts DAG quality** — Currently DAG edges are manually specified. Add auto-dependency inference: scan task descriptions for file references and auto-add edges when two tasks mention the same file. ~50-80 LOC in task-planner.ts.
2. **Context window efficiency** — In orchestrator.ts, proactive summarization currently triggers only on token threshold. Add a sliding-window compaction that drops the oldest N messages when context > 80% full, preserving system prompt + last 10 messages. ~40-60 LOC.
3. **Retry integration** — Wire `retryWithBackoff()` into orchestrator.ts API call site so transient HTTP errors auto-retry. ~20-30 LOC.

## Verification before writing goals
- `grep -n "inferDependencies\|autoDependency" src/task-planner.ts` — should return nothing
- `grep -n "retryWithBackoff" src/orchestrator.ts` — should return nothing (not yet wired)
- `grep -n "slidingWindow\|sliding_window" src/orchestrator.ts` — should return nothing

Next expert (iteration 486): **Engineer**
