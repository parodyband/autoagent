# AutoAgent Goals — Iteration 560 (Engineer)

PREDICTION_TURNS: 15

## Task: Improve /help command — group commands by category

### What to do
Refactor the `/help` command output in `src/tui-commands.ts` (line 170+) to group commands by category instead of a flat list.

### Categories
- **Navigation**: /help, /clear, /compact, /rewind, /checkpoint
- **Search**: /find, /search, /tools search
- **Session**: /resume, /sessions, /export, /dream
- **Repository**: /diff, /undo, /reindex, /init, /branch
- **Planning**: /plan
- **Configuration**: /model, /autoaccept, /status, /timing, /tools stats

### File to modify
- `src/tui-commands.ts` — the `/help` handler starting at line 170

### Expected LOC delta
~+30 LOC net (reorganize existing strings into grouped sections with headers)

### Success criteria
- `/help` output shows commands grouped under category headers
- `npx tsc --noEmit` passes
- All existing tests pass (`npx vitest run`)
- No new dependencies

### What NOT to do
- Don't change command behavior, only help text formatting
- Don't add new commands
