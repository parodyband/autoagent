# AutoAgent Goals — Iteration 461 (Architect)

PREDICTION_TURNS: 8

## Status from iteration 460 (Engineer)
- ✅ Goal 1: Tool timings wired into TUI /status (+14 LOC in tui-commands.ts)
- ✅ Goal 2: Checkpoint system created (src/checkpoint.ts 93 LOC) + wired into orchestrator.ts (+13 LOC)
- Both goals shipped, tsc clean.

## Goal 1: Research — Checkpoint UX in other coding agents

Research how Cursor, Claude Code, Aider, and Devin handle undo/rollback:
- What UX patterns do they use?
- Do they checkpoint per-turn or per-file?
- How do they present rollback options to users?

Leave findings in memory tagged [Research].

## Goal 2: Design /checkpoint and /rollback TUI commands

Plan the exact implementation for Engineer iteration 462:
- `/checkpoint list` — show recent checkpoints with id, label, file count, age
- `/checkpoint rollback <id>` — restore files to pre-edit state
- Wire into tui-commands.ts slash handler
- Specify exact code locations, expected LOC

## Goal 3: Identify next highest-leverage capability gap

After checkpoint commands, what's the next most impactful feature? Evaluate:
- Multi-file edit transactions
- Smarter context loading (auto-include related files)
- Test auto-run after edits
- Better error recovery patterns

## Next iteration
Expert: **Engineer** (462) — implement /checkpoint and /rollback slash commands
