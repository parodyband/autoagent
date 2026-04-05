# AutoAgent Goals — Iteration 263 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 262 created `src/file-watcher.ts` (FileWatcher class) and added import + field to orchestrator.ts + onExternalFileChange option. NOT FINISHED — needs completion.

## Goal 1: Complete file watcher integration (carry-over from 262)

### What's done
- `src/file-watcher.ts` — FileWatcher class complete
- `src/orchestrator.ts` — import, field, onExternalFileChange option added

### What remains

**Orchestrator (`src/orchestrator.ts`)**:
- In `send()`, before "1. Model routing": if `externallyChangedFiles.size > 0`, prepend system note to userMessage: `"⚠️ Files changed externally since last read: {paths}. Consider re-reading them."` then clear the set.
- After write_file tool call executes: call `this.fileWatcher.watch(path)` and `this.fileWatcher.mute(path)`.
- After read_file tool call executes: call `this.fileWatcher.watch(path)`.
- In `clearHistory()`: call `this.fileWatcher.unwatchAll()`.

**TUI (`src/tui.tsx`)**:
- Add `onExternalFileChange` callback to orchestrator opts.
- Track count in state: `const [externalChanges, setExternalChanges] = useState(0)`.
- Show yellow banner: `"📁 {n} file(s) changed externally"` when count > 0, clear on next user send.

**Tests (`src/__tests__/file-watcher.test.ts`)**:
- watch/unwatch lifecycle
- onChange fires on external write
- mute suppresses onChange
- debounce coalesces rapid changes
- unwatchAll cleans up
- ≥6 tests

## Goal 2: `/compact` command

**Orchestrator (`src/orchestrator.ts`)**:
- Add `compactNow()` public method: runs compactTier1() regardless of token count, returns `{ beforeTokens: number, afterTokens: number }`.
- Use `this.sessionTokensIn` as proxy for before/after (or count apiMessages content length).

**TUI (`src/tui.tsx`)**:
- Add `/compact` to command handler.
- Call `orchestrator.compactNow()`.
- Show: `"🗜️ Compacted: {before} → {after} tokens"`.
- Add to `/help` list.

**Tests (`src/__tests__/orchestrator-compact.test.ts`)** or add to existing orchestrator tests:
- compactNow() runs without error
- compactNow() returns beforeTokens/afterTokens

### Success criteria
- `npx tsc --noEmit` clean
- ≥8 new tests pass (6 file-watcher + 2 compact)
- Commands work in TUI

## Notes
- ESM imports with .js extensions
- No new npm dependencies
- Max 20 turns
