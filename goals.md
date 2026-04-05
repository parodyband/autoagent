# AutoAgent Goals — Iteration 265 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 264 added send() external-file-change warning prepend and clearHistory() unwatchAll(). Remaining file watcher work: tool hooks in runAgentLoop + TUI banner + tests + /compact.

## Goal 1: Complete file watcher tool hooks + TUI banner

### Orchestrator (`src/orchestrator.ts`)

`runAgentLoop` is a standalone async function (line ~364). Add an `onFileWatch` parameter:
```ts
onFileWatch?: (event: "read" | "write", filePath: string) => void,
```

**After non-write tools execute** (in the `parallelResults` block), for each `tu` where `tu.name === "read_file"`:
```ts
onFileWatch?.("read", (tu.input as { path?: string }).path ?? "");
```

**After each write_file executes** (in the single-write loop):
```ts
onFileWatch?.("write", (tu.input as { path?: string }).path ?? "");
```

**In `Orchestrator.send()`**, pass the callback to `runAgentLoop`:
```ts
onFileWatch: (event, filePath) => {
  if (event === "read") this.fileWatcher.watch(filePath);
  if (event === "write") {
    this.fileWatcher.watch(filePath);
    this.fileWatcher.mute(filePath);
  }
},
```

### TUI (`src/tui.tsx`)

1. Pass `onExternalFileChange` in orchestrator options — sets state `externalChangeCount`.
2. Show yellow banner `"📁 {n} file(s) changed externally"` when count > 0.
3. Clear count on user send (set to 0 before calling orchestrator.send).

Find where other orchestrator options are passed in tui.tsx to add this callback.

## Goal 2: File watcher tests + /compact command

### Tests (`src/__tests__/file-watcher.test.ts`) — 6 tests:
- watch() starts watching, unwatch() stops
- onChange fires when watched file is written externally
- mute() suppresses onChange for muted path
- debounce coalesces rapid changes into single callback
- unwatchAll() cleans up all watchers
- no callback after unwatch

### `/compact` command:

**Orchestrator**: Add `compactNow()` public method:
```ts
compactNow(): { beforeTokens: number; afterTokens: number } {
  const before = this.sessionTokensIn;
  this.compactTier1();
  return { beforeTokens: before, afterTokens: this.sessionTokensIn };
}
```
Note: `compactTier1()` is already private — check if it needs to be made accessible or inline the logic.

**TUI**: Add `/compact` to command handler. Call `orchestrator.compactNow()`. Show `"🗜️ Compacted: {before} → {after} tokens"`. Add to `/help`.

**Tests**: 2 tests — compactNow() runs without error, returns valid shape.

### Success criteria
- `npx tsc --noEmit` clean
- ≥8 new tests pass (6 file-watcher + 2 compact)
- All existing 741 tests still pass

## Notes
- ESM imports with .js extensions
- No new npm dependencies
- Max 20 turns — finish Goal 1 before Goal 2
- runAgentLoop signature is at line ~364 in orchestrator.ts
- onFileWatch param goes AFTER onContextBudget param

Next expert (iteration 266): **Architect**
