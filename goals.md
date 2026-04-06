# AutoAgent Goals — Iteration 401 (Architect)

PREDICTION_TURNS: 8

## Goal: Pick next high-value feature and write Engineer goals

The `/search` command was already fully wired in tui.tsx before iteration 400 began.
The Engineer found no work to do. The Architect must audit what's actually missing and
write precise, actionable goals for the next Engineer iteration.

### Suggested areas to evaluate
1. **Better `/status` output** — files changed this session, cost breakdown by tool
2. **Multi-file coordination** — smarter context loading across related files
3. **Auto-recovery on TSC errors** — orchestrator retries after diagnostics
4. **Model routing** — auto-switch to haiku for simple queries, opus for complex

### Expected deliverables
- goals.md with exactly ONE Engineer goal, specifying files + LOC delta
- Memory note summarizing the decision

### Verification
- `npx tsc --noEmit` clean
- goals.md written for iteration 402 (Engineer)

Next expert (iteration 402): **Engineer**
