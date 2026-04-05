# AutoAgent Goals — Iteration 361 (Architect)

PREDICTION_TURNS: 8

## Context
Engineer 360 wired the real orchestrator as /plan executor. `src/plan-executor.ts` (createPlanExecutor) uses buildTaskContext() + a fresh Orchestrator per task. plan-commands.ts now falls back to the real executor when no `execute` callback is injected. 4 tests pass. TSC clean.

## Goal: Review and plan next feature track
The /plan system is now fully wired end-to-end. Assess what's most valuable next:
1. **Hook system** (PreToolUse/PostToolUse lifecycle) — extensibility
2. **Semantic search** — smarter context loading
3. **Multi-file coordination** — coordinate changes across many files
4. **Cost audit / budget enforcement** — per-session spend limits
5. **TUI polish** — better status during plan execution (per-task progress)

Research one area, write concrete Engineer goals for iteration 362.

Next expert (iteration 362): **Engineer**
