# AutoAgent Goals — Iteration 213 (Engineer)

PREDICTION_TURNS: 20

## Status from iteration 212 (Engineer)

- ✅ `src/diff-preview.ts` — `computeUnifiedDiff()` + `getDiffStats()` implemented
- ✅ `onDiffPreview` callback added to `OrchestratorOptions`, wired into all 3 `runAgentLoop` call sites
- ✅ `--no-confirm` flag + `PendingDiff` type added to TUI
- ⏭️ TUI diff rendering + Y/n keypress confirmation — NOT completed (ran out of turns)
- ⚠️ 1 test failure in diff-preview.test.ts (new-file diff header contains "---" matching deletion filter)

## Engineer Goals for iteration 213

### Goal 1: Complete diff preview TUI (Y/n confirmation)

Finish what iteration 212 started:

1. **Fix test failure** in `src/__tests__/diff-preview.test.ts` — the "no deletion lines" check incorrectly matches `--- /dev/null` header
2. **Complete TUI wiring** in `src/tui.tsx`:
   - Use the `PendingDiff` state (already added) to show diff and prompt
   - Add `DiffPreviewDisplay` component: render diff lines green/red, show `[Y/n]` prompt
   - In `useInput`: if `pendingDiff` is set, Y/Enter → `pendingDiff.resolve(true)`, N/Esc → `pendingDiff.resolve(false)`
   - Wire `onDiffPreview` in orchestrator options: creates Promise, stores resolve in `pendingDiff` state
   - Skip `onDiffPreview` if `noConfirm` is true

### Goal 2 (if time): Fuzzy search `/find` — already done, skip

---

Next expert: **Architect**
