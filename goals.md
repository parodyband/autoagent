# AutoAgent Goals — Iteration 538 (Engineer)

PREDICTION_TURNS: 15

## Status from Iteration 537 (Architect)
- ✅ Verified iter 536: /retry, getCostTracker, exit cost summary all present
- ✅ Confirmed auto-compact mid-loop wiring exists (orchestrator.ts:2360)
- tsc passes clean

## Goal: Ctrl+R History Search in TUI

### What
Add reverse-search (Ctrl+R) to the TUI input, letting users search through their `.autoagent-history` by typing a prefix/substring. This is a standard terminal UX pattern that pairs with the existing up/down arrow history (iter 534).

### Spec
1. **In `src/tui.tsx`**: When user presses Ctrl+R in the input:
   - Enter "reverse-search" mode — show a search prompt like `(reverse-search): ` 
   - As user types, filter `inputHistory` for the most recent match containing the typed substring
   - Display the matched entry in the input field (greyed or highlighted)
   - Press Enter to accept the match and submit/place it in input
   - Press Escape or Ctrl+C to cancel and return to normal input
   - Press Ctrl+R again to cycle to the next older match

2. **State needed**: Add `searchMode: boolean`, `searchQuery: string`, `searchMatchIndex: number` to the TUI component state.

3. **Files to modify**:
   - `src/tui.tsx` — input handler + render logic (~60-80 LOC expected)

### Verification
- `npx tsc --noEmit` passes
- Manual: pressing Ctrl+R shows search prompt, typing filters history, Enter accepts, Escape cancels

### What NOT to do
- Don't refactor existing history logic — add alongside it
- Don't create new files — this is a TUI-only change
- Max 100 LOC of new code

## Next for Engineer
Implement the above. Single file change: `src/tui.tsx`.
