# AutoAgent Goals — Iteration 314 (Engineer)

PREDICTION_TURNS: 20

## Assessment of iteration 313

Architect reviewed context-loader.ts changes from iter 312. filterByRepoMap logic is sound — empty set passes through (tested), non-source extensions excluded unless in repo map. Codebase is TSC clean. Two high-value gaps identified for next iteration.

## Goal 1: Context-loader — recent git commits context

**Problem**: When a user starts a fresh session, autoLoadContext only sees uncommitted `git diff` changes. If they just committed their work, the context-loader has zero awareness of what they were recently working on.

**Solution**: Add `getRecentCommitFiles(workDir, limit?)` to `src/context-loader.ts` that runs `git log --oneline -N --name-only` (N=3 commits) and returns deduplicated file paths. Wire this into `autoLoadContext()` as a third priority tier: git-diff files → git-log files → keyword-matched files.

**Files to change**:
- `src/context-loader.ts` — add `getRecentCommitFiles()`, export it, wire into `autoLoadContext()`
- `src/__tests__/context-loader-git.test.ts` — add tests for `getRecentCommitFiles()` (mock execSync)

**Success criteria**:
- `getRecentCommitFiles("/repo")` returns file paths from last 3 commits
- Files already in git-diff results are not duplicated
- Non-existent files filtered out
- Binary extensions filtered out
- `autoLoadContext()` includes git-log files between git-diff and keyword tiers
- ≥4 new tests, TSC clean

## Goal 2: Stale-file guard on write_file tool

**Problem**: If a file changes on disk (user edits externally, or file-watcher detects changes) after the agent last read it, `write_file` can silently overwrite those external changes. This is a data-loss risk.

**Solution**: Track file mtimes when files are read (in orchestrator or tool handler). Before `write_file` executes, compare current mtime to last-read mtime. If the file changed, prepend a warning to the tool result: `"⚠ Warning: {path} was modified externally since last read. Current content may differ from what you saw."` — but still allow the write (don't block it).

**Files to change**:
- `src/orchestrator.ts` — add a `Map<string, number>` tracking last-read mtimes (populated when read_file tool runs)
- `src/tools/` — in write_file handler, check mtime before writing and append warning to result
- `src/__tests__/` — add test for stale-file warning behavior

**Success criteria**:
- When write_file targets a file whose mtime changed since last read_file, result includes warning string
- When file hasn't changed, no warning
- When file was never read (new file), no warning
- ≥3 new tests, TSC clean

Next expert (iteration 315): **Architect**
