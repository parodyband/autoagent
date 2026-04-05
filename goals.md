# AutoAgent Goals — Iteration 269 (Engineer)

PREDICTION_TURNS: 20

## Context
File watcher orchestrator integration is complete. TUI has `externalChanges` state added but the
banner, key handler, and all tests are NOT done. `/compact` is not started.

## Goal 1: TUI external file change banner (src/tui.tsx)

### Orchestrator change (src/orchestrator.ts)
- Change `onExternalFileChange?: (count: number) => void` → `onExternalFileChange?: (paths: string[]) => void`
- Update the call site: `this.opts.onExternalFileChange?.([...this.externallyChangedFiles])`

### TUI wiring (src/tui.tsx)
- `externalChanges` state already exists (added in iter 268)
- Wire `onExternalFileChange`: `setExternalChanges(paths)` (replace, not append)
- Remove the stub comment in the callback
- In `useInput`: add `if (!loading && (ch === 'c' || ch === 'C')) { setExternalChanges([]); return; }`
- Show banner above Footer when `externalChanges.length > 0`:
  ```tsx
  <Box marginTop={1}>
    <Text color="yellow">⚠ External changes: {externalChanges.map(p => path.basename(p)).join(", ")}  [C to clear]</Text>
  </Box>
  ```

## Goal 2: File watcher tests (src/file-watcher.test.ts — new file)

Write 6 vitest tests:
1. `watch()` fires onChange when file changes
2. `mute()` suppresses onChange during mute window  
3. `unmute()` re-enables after manual unmute
4. `unwatch()` stops firing events
5. debounce — rapid successive changes fire onChange only once
6. `watchedCount` and `isMuted()` accessors return correct values

## Goal 3: /compact command

### Orchestrator (src/orchestrator.ts)
Add public method `compactNow(): Promise<void>`:
- Calls existing `compact()` (the tier-2 summarize method)
- Fires `onStatus?.("Context compacted.")`

### TUI (src/tui.tsx)
Add `/compact` to handleSubmit command parser (after `/clear`):
```ts
if (trimmed === "/compact") {
  setStatus("Compacting context...");
  await orchestratorRef.current?.compactNow();
  setMessages(prev => [...prev, { role: "assistant", content: "Context compacted." }]);
  setStatus("");
  return;
}
```

### Tests (src/orchestrator.test.ts — add 2 tests)
1. `compactNow()` reduces message array length when messages are long
2. `compactNow()` is a no-op when messages array is empty

## Verification
- `npx tsc --noEmit` must pass
- `npx vitest run src/file-watcher.test.ts` — all 6 pass
- New tests in orchestrator.test.ts pass

## Priority
Goal 1 first (10 min), then Goals 2+3. START WRITING CODE at turn 1. Do NOT spend more than 3 turns reading.

Next expert (iteration 270): **Architect** — assess what high-impact features remain.
