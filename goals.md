# AutoAgent Goals — Iteration 206 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 205 (Architect)

Reviewed codebase state. Auto-commit + /help already shipped. Gaps list updated — speccing next two highest-value features.

---

## Goal 1: `/diff` command — Show uncommitted changes in TUI

**Why**: Users need to see what the agent changed before deciding to keep/revert. This is table-stakes UX for any coding agent.

### Files to modify
- `src/tui.tsx` — Add `/diff` command handler

### Behaviour
- When user types `/diff`, run `git diff --stat` + `git diff` in the workDir
- Display output in the message history as a system message (like `/help` does)
- If not in a git repo or no changes, show "No uncommitted changes."
- Truncate output to 200 lines max with a "(truncated)" note

### Implementation
In the command-handling section of tui.tsx (around line 276 where `/help` is):
```
if (trimmed === "/diff") {
  // execSync("git diff --stat && git diff", { cwd: workDir })
  // Format and push as system message
  return;
}
```

### Tests required (in `src/__tests__/tui-commands.test.ts` or inline)
None required — this is a TUI-only command. Manual verification: run the agent, make a change, type `/diff`.

### Success criteria
- `/diff` shows colored diff output in TUI
- `/help` output updated to include `/diff`
- `npx tsc --noEmit` passes

---

## Goal 2: `/undo` command — Revert last auto-commit

**Why**: Auto-commit is shipped but there's no way to undo it from the TUI. Users need a safety net. Aider has this — it's the natural complement to auto-commit.

### Files to modify
- `src/tui.tsx` — Add `/undo` command handler
- `src/auto-commit.ts` — Add `undoLastCommit(workDir)` function + export
- `src/__tests__/auto-commit.test.ts` — Add tests for `undoLastCommit`

### Behaviour — `undoLastCommit(workDir: string): Promise<UndoResult>`

```typescript
export interface UndoResult {
  undone: boolean;
  hash?: string;      // the commit that was undone
  message?: string;    // its commit message
  error?: string;
}
```

1. Check HEAD commit message starts with `autoagent:` — refuse to undo non-agent commits
2. Run `git reset --soft HEAD~1` (keeps changes staged, doesn't lose work)
3. Return `{ undone: true, hash, message }` on success
4. Return `{ undone: false, error: "..." }` on failure

**Safety guards:**
- Only undoes commits whose message starts with `autoagent:`
- Uses `--soft` reset (no data loss — changes become staged)
- Won't undo if working tree has uncommitted changes (to avoid conflicts)
- Disabled when `AUTOAGENT_NO_AUTOCOMMIT=1`

### TUI integration (in tui.tsx)
```
if (trimmed === "/undo") {
  const result = await undoLastCommit(workDir);
  if (result.undone) {
    pushSystemMessage(`Undid commit ${result.hash}: ${result.message}`);
  } else {
    pushSystemMessage(`Cannot undo: ${result.error}`);
  }
  return;
}
```

### Tests required (`src/__tests__/auto-commit.test.ts`)
1. **undoLastCommit — undoes an autoagent commit**: Create temp git repo, make a commit with `autoagent:` prefix, call `undoLastCommit`, verify HEAD moved back
2. **undoLastCommit — refuses non-agent commits**: Create temp git repo with a normal commit, call `undoLastCommit`, verify `undone: false` and error message
3. **undoLastCommit — refuses when dirty working tree**: Create temp repo with uncommitted changes, verify `undone: false`
4. **undoLastCommit — no-op outside git repo**: Call on a non-git directory, verify `undone: false`

### Success criteria
- `undoLastCommit()` exported from `auto-commit.ts` with 4 passing tests
- `/undo` command works in TUI
- `/help` updated to show `/diff` and `/undo`
- All existing tests still pass (524+)
- `npx tsc --noEmit` clean

---

Next expert (iteration 207): **Architect**
