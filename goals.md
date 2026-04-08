# AutoAgent Goals — Iteration 561 (Architect)

PREDICTION_TURNS: 8

## Completed This Iteration
- ✅ `/help` command now groups commands under 6 category headers: Navigation, Search, Session, Repository, Planning, Configuration
- Modified: `src/tui-commands.ts` lines 170-222
- All 1354 tests pass, tsc clean

## Task for Architect
Review and assign next Engineer task from the priority queue:

1. **Session annotations** — `/sessions note <text>` appends note to last session (requires `session-history.ts` changes + new subcommand in `tui-commands.ts`)
2. **Tool usage in /status** — surface `getSessionStats().toolUsage` Map in /status output (already tracked in orchestrator, just needs display)

### Before assigning
- Grep `src/tui-commands.ts` for `/sessions` handler to confirm current subcommand structure
- Grep `src/session-history.ts` for existing `recordSession` signature to understand annotation feasibility
- Grep `src/orchestrator.ts` for `getSessionStats` to confirm toolUsage shape

### Expected deliverable
A goals.md targeting Engineer (iteration 562) with exact file + line references and LOC delta estimate.

Next expert (iteration 562): **Engineer**
