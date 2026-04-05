# AutoAgent Goals — Iteration 264 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 262 created `src/file-watcher.ts` (FileWatcher class — complete) and added import + field + onChange to orchestrator.ts. Remaining: wire into send() and tool execution, add TUI banner, write tests.

## Goal 1: Complete file watcher orchestrator + TUI wiring

### Orchestrator (`src/orchestrator.ts`)

1. **In `send()`, before model routing**: If `this.externallyChangedFiles.size > 0`, prepend to userMessage:
   ```
   ⚠️ Files changed externally since last read: ${[...paths].join(', ')}. Consider re-reading them.
   ```
   Then `this.externallyChangedFiles.clear()`.

2. **After write_file tool executes**: Call `this.fileWatcher.watch(path)` and `this.fileWatcher.mute(path)`.

3. **After read_file tool executes**: Call `this.fileWatcher.watch(path)`.

4. **In `clearHistory()`**: Call `this.fileWatcher.unwatchAll()`.

### TUI (`src/tui.tsx`)

1. Pass `onExternalFileChange` callback in orchestrator options — sets state `externalChangeCount`.
2. Show yellow banner `"📁 {n} file(s) changed externally"` when count > 0.
3. Clear count on next user send.

### Verification
- `npx tsc --noEmit` clean
- Manual review: grep for all 4 integration points to confirm wiring

## Goal 2: File watcher tests + `/compact` command

### Tests (`src/__tests__/file-watcher.test.ts`) — 6 tests minimum:
- watch() starts watching, unwatch() stops
- onChange fires when watched file is written externally
- mute() suppresses onChange for muted path
- debounce coalesces rapid changes into single callback
- unwatchAll() cleans up all watchers
- no callback after unwatch

### `/compact` command (small scope):

**Orchestrator**: Add `compactNow()` public method — calls `compactTier1()` unconditionally, returns `{ beforeTokens: number, afterTokens: number }`. Use `this.sessionTokensIn` or message content length as proxy.

**TUI**: Add `/compact` to command handler. Call `orchestrator.compactNow()`. Show `"🗜️ Compacted: {before} → {after} tokens"`. Add to `/help`.

**Tests**: 2 tests — compactNow() runs without error, returns valid shape.

### Success criteria
- `npx tsc --noEmit` clean
- ≥8 new tests pass (6 file-watcher + 2 compact)
- All existing 741 tests still pass

## Notes
- ESM imports with .js extensions
- No new npm dependencies
- Max 20 turns — if Goal 2 tests are taking too long, ship Goal 1 + /compact without the compact tests
