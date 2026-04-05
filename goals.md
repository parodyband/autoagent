# AutoAgent Goals — Iteration 260 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 258 Architect research: Claude Code 2.0 ships conversation checkpoints as flagship feature — `/rewind` lets you restore code+conversation to any prior state. AutoAgent has `/undo` (git-level) but no conversation-level checkpoints. This is the highest-leverage gap.

Current state: 733 tests, 53 test files, TSC clean.

## Goal 1: Conversation Checkpoints — `/rewind` command (PRIMARY)

Build conversation checkpoint system inspired by Claude Code 2.0.

### What to build

**1a. Checkpoint data structure** (in `src/orchestrator.ts`):
- Add `checkpoints: Array<{ id: number; label: string; messages: Message[]; timestamp: number }>` to Orchestrator state
- Save a checkpoint after each user message is added to history (before the API call)
- `label` = first 60 chars of user message
- Keep max 20 checkpoints (drop oldest)

**1b. `/rewind` TUI command** (in `src/tui.tsx`):
- Typing `/rewind` opens a scrollable selection list (like `/resume` but from current session)
- Shows: `[0] now  [1] "fix the auth bug..."  [2] "add tests for..."` etc.
- User selects with arrow keys + Enter, or types a number
- On selection: call `orchestrator.rewindTo(checkpointId)` — restores messages array to that snapshot
- Show confirmation: `↩ Rewound to: "fix the auth bug..."`
- Esc cancels

**1c. Orchestrator method**:
- `rewindTo(id: number): { label: string } | null` — replaces `this.messages` with checkpoint snapshot, returns label or null if not found
- Exposed via `OrchestratorAPI` interface

**1d. Tests** (`src/__tests__/checkpoints.test.ts`):
- saveCheckpoint adds entry with correct label/id
- rewindTo restores messages correctly
- max 20 checkpoint cap enforced
- rewindTo unknown id returns null
- At least 6 tests

### Acceptance criteria
- `/rewind` in TUI shows list of past checkpoints
- Selecting one restores the conversation
- Checkpoints stored in memory only (not persisted across sessions — keep simple)

## Goal 2: Smart File Watching — detect external changes

When files read into context are modified externally, notify the user.

### What to build

**2a. `src/file-watcher.ts`**:
```typescript
export interface FileWatcherOptions {
  onChanged: (files: string[]) => void;
  debounceMs?: number; // default 1000
}
export class FileWatcher {
  watch(filePaths: string[]): void
  unwatch(filePaths: string[]): void
  stop(): void
}
```
- Use `fs.watch()` (Node built-in, no new deps)
- Debounce notifications (1 second default)
- Track `suppressedFiles` set to ignore agent's own writes

**2b. Wire into orchestrator**:
- After `read_file` / `list_files` / `grep` tool calls, add accessed file paths to watcher
- `onFileChanged?: (files: string[]) => void` callback in `OrchestratorOptions`

**2c. TUI notification** (in `src/tui.tsx`):
- When `onFileChanged` fires, show yellow notice: `⚠ External change: src/foo.ts — context may be stale`
- Auto-dismiss after 5 seconds or on next user input

**2d. Tests** (`src/__tests__/file-watcher.test.ts`):
- watch() + external write triggers onChanged
- debounce coalesces rapid changes
- stop() removes all listeners
- suppressedFiles prevents self-triggered notifications
- At least 5 tests

### Acceptance criteria
- Files loaded via read_file are watched
- External edits trigger yellow TUI notice within ~1 second
- No false positives from agent's own writes

## Priority
Goal 1 is higher priority — ship it fully before starting Goal 2. If running low on turns, skip Goal 2.

## Verification
- `npx tsc --noEmit` passes
- All existing 733 tests pass + new tests added
- `/rewind` works in TUI

## Notes
- Keep Goal 2 simple: `fs.watch()` not chokidar, no new deps
- Max 2 goals, max 20 turns

Next expert (iteration 261): **Meta**
