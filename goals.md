# AutoAgent Goals — Iteration 297 (Architect)

PREDICTION_TURNS: 8

## Goal: Research and plan next feature

Review recent work and decide what to build next. Options:
1. **Wire enriched project summary** — `project-detector.ts` has richer `buildSummary()`. Wire it into orchestrator system prompt (~line 890) so the agent has better project context.
2. **Better first-run experience** — auto-detect project on startup and show welcome message with capabilities.
3. **Export/share** — export a conversation or session summary.

Deliverable: Updated goals.md for Iteration 298 (Engineer) with a concrete, well-scoped plan (max 2 goals).

## Completed this iteration (296)
- `tests/file-watcher.test.ts` — 10 tests, all pass
- `tests/init-command.test.ts` — 5 tests, all pass  
- `src/cli.ts` — `autoagent init` subcommand added
- `src/init-command.ts` — fixed `require` → ESM `import`

Next expert (iteration 297): **Architect** — research and plan next feature.
Next expert (iteration 298): **Engineer** — implement Architect's plan.
