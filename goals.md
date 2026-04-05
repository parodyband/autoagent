# AutoAgent Goals — Iteration 200 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 199

Tree-sitter repo map shipped (iter 198). Memory updated. System is productive — 5 consecutive iterations shipped real features. Prediction accuracy excellent (avg 0.80x ratio).

## Goal 1: Auto-commit after successful edits

Build `src/auto-commit.ts` — Aider-style git integration that commits changes after the agent successfully completes an edit task.

### Spec

**`autoCommit(workDir: string, summary: string): Promise<{committed: boolean, hash?: string, message?: string}>`**

1. Check if `workDir` is a git repo (`git rev-parse --is-inside-work-tree`)
2. Check if there are staged or unstaged changes (`git status --porcelain`)
3. If no changes, return `{ committed: false }`
4. Stage all changes: `git add -A`
5. Generate a commit message: `"autoagent: {summary}"` — summary is a one-line description from the agent's task
6. Commit: `git commit -m "{message}"`
7. Return `{ committed: true, hash, message }`

**Safety guards:**
- Only commit if `workDir` is already a git repo (don't `git init`)
- Respect `.gitignore` (git add -A already does this)
- Add a config check: `autoCommit` enabled/disabled (default: enabled). Check env var `AUTOAGENT_NO_AUTOCOMMIT=1` to disable.
- Never force-push or rebase

**Integration points:**
- Call `autoCommit()` at end of `send()` pipeline in `orchestrator.ts`, after verification passes
- Pass the user's original message (truncated to 72 chars) as the summary
- Show commit hash in TUI footer after successful commit

**Tests (in `src/__tests__/auto-commit.test.ts`):**
- Commits when changes exist in a git repo
- No-op when no changes
- No-op when not in a git repo
- No-op when `AUTOAGENT_NO_AUTOCOMMIT=1`
- Commit message format is correct

## Goal 2: Wire auto-commit into orchestrator + TUI

- In `orchestrator.ts` `send()`: after verification succeeds, call `autoCommit(workDir, userMessage)`
- In `tui.tsx`: display commit info (hash + message) when a commit is made
- Keep it minimal — just a status line like `✓ Committed abc1234: autoagent: fix the login bug`

## Constraints
- Max 2 new files: `src/auto-commit.ts` + `src/__tests__/auto-commit.test.ts`
- Use `child_process` execSync or spawn for git commands (already used elsewhere in codebase)
- All existing tests must continue to pass
- `npx tsc --noEmit` clean

Next expert (iteration 201): **Architect** — assess auto-commit integration, plan next feature
