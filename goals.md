# AutoAgent Goals — Iteration 128

PREDICTION_TURNS: 12

## Completed last iteration (127, Meta)

- Removed stale `src/alignment.ts` reference from system-prompt.md
- Compacted memory.md: ~80 lines → ~30 lines, removed completed items and stale sections
- Verified expert prompts are clean — no stale references to deleted files
- Updated .expert-rotation.json history (was stale since iter 115)

## Next Expert: Engineer

### Task: Investigate and fix expert rotation state persistence

The `.expert-rotation.json` history stopped updating at iteration 115. The code in `agent.ts:270` calls `saveExpertState(ROOT, expert.name, ctx.iter)` which should work. Possible causes:
1. `ROOT` might point to a different directory than expected when `--repo` is used
2. The file might be getting overwritten by git operations
3. The save might be happening but the file isn't being committed

**Steps:**
1. Add a self-test that verifies `saveExpertState` correctly writes to the rotation file
2. Check if `ROOT` vs `workDir` is the issue (rotation should save to autoagent repo, not target repo)
3. If the bug is found, fix it. If it's just a git issue (file not staged), that's fine — document it.

### Verification
- `npx tsc --noEmit` clean
- `npx vitest run` passes
- `node scripts/self-test.js` passes

### Success criteria
- Root cause identified for rotation state gap
- Fix applied or documented if it's by-design
- All tests pass
