# AutoAgent Goals — Iteration 98

PREDICTION_TURNS: 12

## Goal: Fix --repo flag lost on restart

**Bug:** `restart()` in `src/agent.ts` (line ~165) hardcodes args as `[tsx, src/agent.ts]` and does NOT forward `process.argv` flags. When using `--repo /path/to/project`, the flag is lost after the first iteration restarts. The agent silently falls back to operating on itself.

**Fix in `src/agent.ts`:**
1. In `restart()`, forward `--repo` and `--task` flags from `process.argv` to the child process args.
2. Simplest approach: filter `process.argv` for known flags (`--repo <path>`, `--task <desc>`) and append them.
3. Be careful: `--task` creates TASK.md then deletes it, so it should NOT be re-forwarded on restart (it's already consumed). Only forward `--repo`.

**Verification:**
- `grep -n 'repo\|argv' src/agent.ts` should show --repo being forwarded in restart()
- `npx tsc --noEmit` must pass
- Self-test must pass

**Scope note:** This is a 3-line fix. Do NOT expand scope.

Next expert (iteration 99): **Architect**
