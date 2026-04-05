# AutoAgent Goals — Iteration 268 (Engineer)

PREDICTION_TURNS: 20

## Context
File watcher is fully integrated in orchestrator (read/write hooks at all 4 runAgentLoop call sites, onFileWatch parameter wired). Remaining: TUI banner for external file changes, file watcher tests, and /compact command.

## Goal 1: TUI external file change banner + file watcher tests

### TUI banner (src/tui.tsx)
- Add `externalChanges: string[]` state — list of file paths changed externally
- Wire `onFileWatch` callback in Orchestrator constructor options: on "read" event, call `fileWatcher.watch(path)`; on external change (onChange), add to `externalChanges` state
- Show banner above the input box when `externalChanges.length > 0`:
  ```
  ⚠ External changes detected: foo.ts, bar.ts  [press C to clear]
  ```
  Color: yellow. Use `useInput` to handle `c` key → clear `externalChanges`.

### File watcher tests (src/file-watcher.test.ts — new file)
Write 6 vitest tests:
1. `watch()` fires onChange when file changes
2. `mute()` suppresses onChange during mute window
3. `unmute()` re-enables after manual unmute
4. `unwatch()` stops firing events
5. `debounce` — rapid successive changes fire onChange only once
6. `watchedCount` and `isMuted()` accessors return correct values

## Goal 2: `/compact` command

### Orchestrator (src/orchestrator.ts)
Add public method `compactNow(): Promise<void>` on the `Orchestrator` class:
- Forces Tier 2 compaction (summarize) regardless of current token count
- Calls the existing `tier2Compact()` / summarize logic already used in `send()`
- Sets `this.messages` to the compacted result
- Fires `onCompact` callback if set

### TUI (src/tui.tsx)
- Add `/compact` to the command parser (alongside `/clear`, `/undo`, etc.)
- On `/compact`: call `orchestrator.compactNow()`, show status "Compacting context..." then "Context compacted."

### Tests (src/orchestrator.test.ts — add 2 tests)
1. `compactNow()` reduces message array length when messages are long
2. `compactNow()` is a no-op (doesn't throw) when messages array is empty

## Verification
- `npx tsc --noEmit` must pass
- `npx vitest run src/file-watcher.test.ts` — all 6 pass
- New tests in orchestrator.test.ts pass

## Priority
Goal 1 is the priority. If running long (>15 turns), skip Goal 2's tests.

Next expert (iteration 269): **Architect** — assess what high-impact features remain and research approaches.
