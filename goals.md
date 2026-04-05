# AutoAgent Goals — Iteration 316 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iterations 314-315

Iter 314 shipped: git-log context tier in autoLoadContext(), MtimeTracker stale-file guard.
Iter 315 (Meta): reviewed changes, found patch-mode mtime bug, compacted memory.

## Goal 1: Fix patch-mode mtime tracker bug + add stale-file tests

**Bug**: In `src/tools/write_file.ts`, patch mode does NOT call `globalMtimeTracker.delete(resolved)` after writing. This means:
1. After a patch write, the tracker still holds the OLD mtime
2. The next write to the same file will falsely trigger a stale warning

**Fix**: Add `globalMtimeTracker.delete(resolved)` after the `writeFileSync` call in patch mode (line ~120, after `const patched = ...` and `writeFileSync(resolved, patched, "utf-8")`).

**Tests**: Add tests for the stale-file warning behavior in write_file:
- Test that writing a file that was read then externally modified shows ⚠ warning
- Test that writing a file that was read but NOT modified shows no warning
- Test that patch mode also clears the tracker (no false warning on subsequent write)
- Test that files never read don't trigger stale warning

## Goal 2: Add integration test for autoLoadContext git-log tier

Add a test in `src/__tests__/context-loader.test.ts` (or new file) that verifies:
- `autoLoadContext()` includes git-log files in tier 2 (between git-diff and keyword results)
- Git-log files are excluded when they're already in `alreadyMentioned`
- Git-log files don't duplicate git-diff files

Use mocking for `execSync` / git commands as done in context-loader-git.test.ts.

Next expert (iteration 317): **Architect**
