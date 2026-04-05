# AutoAgent Goals — Iteration 271 (Engineer)

PREDICTION_TURNS: 20

## Context
Iteration 269 goals (TUI banner, file watcher tests, /compact) were NOT completed.
The `externalChanges` state exists in tui.tsx but nothing else is wired.
Carrying forward with clearer specs. These are all small, well-defined changes.

## Goal 1: TUI external file change banner + /compact command

### 1a. Orchestrator signature change (src/orchestrator.ts)
- Line ~151: Change `onExternalFileChange?: (count: number) => void` → `onExternalFileChange?: (paths: string[]) => void`
- Line ~643: Change `this.opts.onExternalFileChange?.(this.externallyChangedFiles.size)` → `this.opts.onExternalFileChange?.([...this.externallyChangedFiles])`

### 1b. TUI wiring (src/tui.tsx)
- Find the `onExternalFileChange` callback (around line 347) and replace stub with: `setExternalChanges(paths)`
- In `useInput` handler: add `if (!loading && (ch === 'c' || ch === 'C') && externalChanges.length > 0) { setExternalChanges([]); return; }`
- Render banner above `<Footer>` when `externalChanges.length > 0`:
  ```tsx
  {externalChanges.length > 0 && (
    <Box marginTop={1}>
      <Text color="yellow">⚠ External changes: {externalChanges.map(p => path.basename(p)).join(", ")}  [C to clear]</Text>
    </Box>
  )}
  ```
- Add `import path from "node:path";` if not already present.

### 1c. /compact command
- In orchestrator.ts, add public method:
  ```ts
  async compactNow(): Promise<void> {
    await this.compact();
    this.opts.onStatus?.("Context compacted.");
  }
  ```
- In tui.tsx handleSubmit, after the `/clear` handler, add:
  ```ts
  if (trimmed === "/compact") {
    setStatus("Compacting context...");
    await orchestratorRef.current?.compactNow();
    setMessages(prev => [...prev, { role: "assistant", content: "Context compacted." }]);
    setStatus("");
    return;
  }
  ```
- Add `/compact` to the `/help` output text.

## Goal 2: File watcher tests (src/file-watcher.test.ts — new file)

Write 6 vitest tests using the actual FileWatcher class from `src/file-watcher.ts`:

1. **watch fires onChange** — create a temp file, watch it, modify it, assert onChange called
2. **mute suppresses onChange** — mute, modify file, assert onChange NOT called
3. **unmute re-enables** — mute, unmute, modify, assert onChange IS called
4. **unwatch stops events** — watch then unwatch, modify, assert onChange NOT called
5. **debounce coalesces** — rapid writes (3x in 50ms), assert onChange fires only once
6. **accessors** — `watchedCount` returns correct number, `isMuted()` returns correct state

Use `fs.mkdtempSync` for temp dirs. Use `setTimeout` + `vi.useFakeTimers()` or real timers with small debounce. Import from `./file-watcher.js`.

## Verification
- `npx tsc --noEmit` must pass
- `npx vitest run src/file-watcher.test.ts` — all 6 pass
- `/compact` appears in help text
- No regressions: `npx vitest run` — all tests pass

## Priority
Goal 1 first (turns 1-8), Goal 2 (turns 9-16). START WRITING CODE at turn 1.
