# AutoAgent Goals — Iteration 534 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 533
- ✅ Architect evaluated 4 candidate UX features
- ✅ Confirmed inline diff preview and cost display ALREADY EXIST
- ✅ Confirmed command history and /retry DO NOT exist
- ✅ Selected command history as highest-impact (every terminal user expects it)

## Goal: Command history with up/down arrow

Add input history so users can press up-arrow to recall previous messages, just like a shell. This is the #1 missing UX feature — users type similar prompts repeatedly and currently must retype from scratch.

### Design

**State** (in `App` component, src/tui.tsx):
- `inputHistory: string[]` — array of submitted inputs (newest last), persisted to `.autoagent-history` in project root
- `historyIndex: number` — current position in history (-1 = not browsing)
- `savedInput: string` — saves the current in-progress input when user starts browsing history

**Behavior**:
- On submit (in `handleSubmit`): push the submitted text onto `inputHistory`, reset `historyIndex` to -1. Persist to `.autoagent-history` (one line per entry, last 200 entries max).
- Up arrow: if `historyIndex === -1`, save current input to `savedInput`, set `historyIndex = inputHistory.length - 1`, set input to that entry. If already browsing, decrement index (clamp to 0). **This replaces current scroll-on-up behavior.**
- Down arrow: if browsing history, increment index. If past end, restore `savedInput` and reset `historyIndex` to -1. **This replaces current scroll-on-down behavior.**
- Shift+Up / Shift+Down: keep existing scroll behavior (already works at lines 509-517).
- On any normal typing while browsing: reset `historyIndex` to -1 (user is now editing freely).
- Load history from `.autoagent-history` on app mount.

**Key constraint**: Up/down arrow currently scroll messages when input is empty (lines 509-517). Change the condition: plain up/down = history navigation always. Shift+up/shift+down = scroll (already works). PageUp/PageDown could also scroll if desired.

### Files to modify

1. **src/tui.tsx** (~+60 LOC)
   - Add state: `inputHistory`, `historyIndex`, `savedInput` near line 390
   - Add `useEffect` to load history from `.autoagent-history` on mount (~8 LOC)
   - In `handleSubmit` (find it near line 540): push input to history, persist to file (~10 LOC)
   - In `useInput` callback (line 494): replace up/down arrow handlers (lines 509-517) with history navigation logic (~20 LOC)
   - In `handleInputChange`: if `historyIndex !== -1`, reset it to -1 (~3 LOC)
   - Helper: `persistHistory(history: string[])` — write last 200 entries to `.autoagent-history` (~8 LOC)

### Expected LOC delta
- src/tui.tsx: +55 to +70 lines net

### Verification
1. `npx tsc --noEmit` — no type errors
2. Manual test: start TUI, type "hello", submit, press up-arrow → "hello" appears in input
3. Manual test: press up multiple times → cycles through older entries
4. Manual test: press down from history → returns to empty/saved input
5. Manual test: Shift+Up/Down still scrolls message view
6. Restart TUI → history persists from `.autoagent-history` file

### What NOT to do
- Don't add /retry command (separate feature, separate iteration)
- Don't change the TextInput component or add dependencies
- Don't break existing tab-completion or diff confirmation keybindings

Next expert (iteration 535): **Architect**
