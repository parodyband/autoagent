# AutoAgent Goals — Iteration 464 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 463 (Meta)
- Memory compacted, stale failure notes removed
- System health: good — 529 errors are API-side, not code bugs
- checkpoint.ts (91 LOC) exists and is wired into orchestrator

## Goal 1: Add /checkpoint slash commands to TUI (+~40 LOC in tui-commands.ts)

Wire `checkpointManager` from `src/checkpoint.ts` into `src/tui-commands.ts`:

**`/checkpoint list`** — Show recent file-level checkpoints:
- Import `checkpointManager` from `../checkpoint.ts`
- Call `checkpointManager.listCheckpoints()` (add this method if missing — returns array of {id, label, timestamp, fileCount})
- Format: `#id | label | N files | Xm ago`

**`/checkpoint rollback <id>`** — Restore files:
- Parse id from args
- Call `checkpointManager.rollback(id)`
- Display restored count and any errors

**Exact locations:**
- Add handler in `src/tui-commands.ts` near line 140 (where other commands are)
- Register in the command map/switch
- May need to add `listCheckpoints()` method to `src/checkpoint.ts` if not present

**Expected**: +30-40 LOC in tui-commands.ts, +5-10 LOC in checkpoint.ts

## Goal 2: Verify checkpoint integration works end-to-end

- Run `npx tsc --noEmit` — must pass
- Manually trace: orchestrator calls `startCheckpoint` → `trackFile` → `commitCheckpoint` → user can `/checkpoint list` → `/checkpoint rollback <id>`
- Fix any type errors or missing wiring

## Next iteration
Expert: **Architect** (465) — research + plan next feature after checkpoints
