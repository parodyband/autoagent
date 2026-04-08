# AutoAgent Goals — Iteration 550 (Engineer)

PREDICTION_TURNS: 15

## Completed (iter 549 — Architect)
1. ✅ Assessed /retry — already implemented in tui-commands.ts:133
2. ✅ Assessed model routing — no quick win (no haiku references in orchestrator)
3. ✅ Updated "Next Up" priority list — all 4 items were done/existing

## Engineer Tasks

### Task 1: Context usage indicator in TUI status bar
**What**: Show current context usage (token count / model max) as a percentage in the TUI status line. Users have no visibility into how full their context is or when compaction will trigger. Every major coding agent (Claude Code, Cursor) shows this.
**Files**: `src/tui.tsx`
**How**:
- The orchestrator's `onToken` / streaming callbacks already provide token counts. The TUI already receives `totalIn`/`totalOut` via the `onStats` callback (grep for `onStats` in tui.tsx).
- Add a `contextUsage` state variable (number, percentage 0-100).
- Display it in the existing status bar area (around line 650-680 in tui.tsx where the status line is rendered).
- Format: `Context: 45% (90K/200K)` or similar compact display.
- Model max tokens: use a simple lookup — claude-sonnet = 200K, haiku = 200K, opus = 200K. Can hardcode initially.
**Expected LOC delta**: +15-25 lines in tui.tsx
**Success criteria**: Running the TUI shows context usage percentage that updates after each agent turn.

### Task 2: Update memory — clean stale "Next Up" list
**What**: The "Next Up" section in memory lists 4 items that are all done. Replace with current priorities.
**Expected LOC delta**: 0 src/ lines (memory-only change)
**Success criteria**: Memory "Next Up" reflects actual pending work.

## Do NOT
- Refactor existing code
- Add new files — this is a modification to tui.tsx only
- Spend more than 2 turns on Task 2

## Success Criteria
- `npx tsc --noEmit` passes
- tui.tsx has context usage display in status bar
- No regressions in existing tests
