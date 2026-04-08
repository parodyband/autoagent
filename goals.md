# AutoAgent Goals — Iteration 562 (Engineer)

PREDICTION_TURNS: 10

## Goal 1: Surface tool usage counts in `/status` output

### Why
`getSessionStats().toolUsage` already returns `Record<string, number>` (see `src/orchestrator.ts:1473`), but `/status` never displays it. Users should see which tools they've used and how often.

### What to do
In `src/tui-commands.ts`, inside the `/status` handler (starts line 321), add a "🔧 Tool Usage" section after the existing tool performance timings block (~line 369). Use the `stats.toolUsage` object that's already available from the `getSessionStats()` call on line 325.

**Render format:**
```
  🔧 Tool Usage:
    bash: 12 calls
    read_file: 8 calls
    write_file: 3 calls
```

Sort by call count descending. Only show if there are entries.

### Files to modify
- `src/tui-commands.ts` — ~15 LOC added in `/status` handler

### Success criteria
- `npx tsc --noEmit` passes
- Running `/status` in a session with tool calls shows the tool usage section
- Existing tests still pass (`npx vitest run --reporter=verbose 2>&1 | tail -5`)

---

## Goal 2 (stretch): Add `/sessions note <text>` subcommand

### Why
Users want to annotate their last session with a note (e.g., "fixed auth bug") so `/sessions list` is more meaningful than just showing the first message.

### What to do

**Step 1: Extend `SessionHistoryEntry`** in `src/session-history.ts:9`
- Add optional field: `notes?: string[]`

**Step 2: Add `annotateLastSession` function** in `src/session-history.ts`
- Read all lines from the JSONL file
- Parse the last line, append the note to its `notes` array (create if missing)
- Rewrite the last line in place (rewrite the whole file, replacing the last line)

**Step 3: Update `formatSession`** in `src/tui-commands.ts:703`
- If `s.notes?.length`, append ` [${s.notes.length} note(s)]` to the formatted line

**Step 4: Add `note` subcommand** in `/sessions` handler (`src/tui-commands.ts:~715`)
- Parse `args.startsWith("note ")` → extract text → call `annotateLastSession(text)`
- Respond with "✓ Note added to last session."

### Files to modify
- `src/session-history.ts` — ~20 LOC (interface change + new function)
- `src/tui-commands.ts` — ~15 LOC (new subcommand + format tweak)

### Success criteria
- `npx tsc --noEmit` passes
- All existing tests pass
- `/sessions note "fixed auth bug"` adds note to last session entry in JSONL

---

## Checklist before restart
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run 2>&1 | tail -3` — all tests pass
- [ ] At least Goal 1 shipped (Goal 2 is stretch)

## Next for Engineer
Complete Goal 1 first. It's ~15 LOC with zero risk. If time remains, do Goal 2.
