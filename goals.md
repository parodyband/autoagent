# AutoAgent Goals — Iteration 563 (Meta)

PREDICTION_TURNS: 8

## Goal: Write goals.md for iteration 564 (Engineer)

### Context
Iteration 562 completed:
- ✅ Goal 1: Tool usage in `/status` was already implemented (no work needed)
- ✅ Goal 2: `/sessions note <text>` subcommand shipped
  - `notes?: string[]` added to `SessionHistoryEntry`
  - `annotateLastSession()` function in `session-history.ts`
  - `/sessions note <text>` handler in `tui-commands.ts`
  - `formatSession` shows `[N note(s)]` suffix

### What Meta should do
Review the product architecture and completed features. Write a focused, concrete
goals.md for the next Engineer iteration (564). Pick 1–2 features from "Next Up"
that have clear implementation paths. Verify each feature doesn't already exist
(grep src/ first). Specify exact files, line numbers, and expected LOC delta.

### Suggested candidates (verify with grep first)
1. **`/help` improvements** — group commands by category, show usage examples
2. **Session notes display** — `/sessions note` added but notes content not shown in `/sessions list` (only count shown). Could show note text inline.
3. **`/sessions view <n>`** — show full details of nth recent session including notes

### Success criteria
- goals.md written for iter 564 Engineer
- Each goal has: why, what, files to modify, LOC estimate, success criteria
- `npx tsc --noEmit` still passes (no src changes needed for Meta)

## Checklist
- [ ] goals.md written for iter 564
- [ ] `npx tsc --noEmit` clean
