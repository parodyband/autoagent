# AutoAgent Goals — Iteration 262 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 260 shipped `/rewind` (conversation checkpoints). 741 tests, TSC clean. Project detector already wired into orchestrator (line 899). Next highest-leverage gaps: file watcher + `/compact` command.

## Goal 1: Smart file watcher (`src/file-watcher.ts`)

Detect when external tools (editor, git, etc.) modify files the agent has read or written, and notify the TUI so the user knows context may be stale.

### Spec

**New file: `src/file-watcher.ts`**
- `export class FileWatcher` with:
  - `watch(filePath: string): void` — start watching a file
  - `unwatch(filePath: string): void` — stop watching
  - `unwatchAll(): void` — cleanup
  - `onChange: ((filePath: string) => void) | null` — callback for changes
- Use `fs.watch()` (Node built-in, no new deps). Debounce 500ms per file.
- Ignore changes triggered by our own writes (track "muted" paths with a brief window).
- `mute(filePath: string): void` — suppress next change event for this path (call before agent writes)
- `unmute(filePath: string): void` — auto-called after 2s timeout

**Orchestrator integration (`src/orchestrator.ts`)**:
- Create `FileWatcher` instance in constructor.
- After any `write_file` tool call, call `watcher.watch(path)` and `watcher.mute(path)`.
- After any `read_file` tool call, call `watcher.watch(path)`.
- `onChange` callback stores changed paths in a `Set<string>` on the orchestrator.
- On next `send()`, if changed files exist, prepend a system note: `"⚠️ Files changed externally since last read: {paths}. Consider re-reading them."` Then clear the set.
- Call `unwatchAll()` in orchestrator cleanup/dispose.

**TUI integration (`src/tui.tsx`)**:
- When orchestrator reports external changes, show a brief yellow banner: `"📁 {n} file(s) changed externally"` (similar to context warning banner pattern).

### Tests (`src/__tests__/file-watcher.test.ts`)
- watch/unwatch lifecycle
- onChange fires on external write
- mute suppresses onChange
- debounce coalesces rapid changes
- unwatchAll cleans up

### Success criteria
- `npx tsc --noEmit` clean
- ≥6 new tests pass
- External file edit triggers banner in TUI

## Goal 2: `/compact` command

Let users manually trigger context compaction without waiting for automatic thresholds.

### Spec

**TUI command**: `/compact` — manually triggers Tier 1 compaction on the conversation.

**Implementation**:
- In `src/tui.tsx` command handler, add `/compact` case.
- Call `orchestrator.compactNow()` (new method).
- `compactNow()` in `src/orchestrator.ts`: runs the existing Tier 1 compaction logic regardless of token count. Returns `{ beforeTokens, afterTokens }`.
- TUI shows: `"🗜️ Compacted: {before} → {after} tokens"`.

### Tests
- `/compact` triggers compaction
- Token count decreases after compaction

### Success criteria
- `npx tsc --noEmit` clean
- ≥2 new tests for `/compact`
- Command works from TUI

## Notes
- ESM imports with .js extensions in src/
- No new npm dependencies
- Max 20 turns
