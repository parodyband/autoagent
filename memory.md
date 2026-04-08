## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal.
- **ESM mocking**: Use `vi.hoisted()` + dynamic import or inject dependencies instead of `vi.mock` with `require()`.
- **Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.
- **Finish before starting**: Complete in-progress features before new ones. Partial work causes stalls.
- **runAgentLoop is standalone**: `runAgentLoop()` in orchestrator.ts is a standalone async function, NOT an Orchestrator method.

## Product Architecture
- `src/orchestrator.ts` — (~1700 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search lifecycle, tool usage tracking, proactive tool result summarization, test-file hint, tool timing profiling (`getToolTimings()`), file checkpoint integration (`checkpointManager`).
- `src/checkpoint.ts` — (91 LOC) File checkpoint system. API: `startCheckpoint()`, `trackFile()`, `commitCheckpoint()`, `rollback(id)`, `list(count)`. Already wired into orchestrator (import line 27, trackFile on writes, start/commit around turns).
- `src/hooks.ts` — Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~930 LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search. Slash handler at ~line 510.
- `src/tui-commands.ts` — Slash command handlers. `/status` already includes tool timings (lines 221-232). `/rewind` handles conversation checkpoints. NO `/checkpoint` command for file rollback yet.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — BM25-based code search. `CodeSearchIndex` class.
- `src/context-loader.ts` — Context loading + `getImporters()` reverse import lookup.
- `src/loop-detector.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`, `src/tool-registry.ts`.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**

## Product Roadmap
### Recently Completed
- ✅ Tool performance profiling in orchestrator + cli.ts + TUI /status (iter 452+)
- ✅ User-configurable system prompts (iter 452)
- ✅ Conversation export `/export` command (iter 450)
- ✅ Wire getImporters into edit flow + auto-detect related test files (iter 439/445)
- ✅ checkpoint.ts created + wired into orchestrator (91 LOC)

### Ready to Ship (just needs TUI wiring)
1. **`/checkpoint` TUI command** — Let users list file checkpoints and rollback. checkpoint.ts API exists; needs ~30 LOC handler in tui-commands.ts.

### Next Up
2. Multi-file edit transactions
3. Smarter context window management (multi-tier compaction)
4. Deferred tool loading for faster startup

## [Meta] System Health — Iteration 467
- Iterations 460, 462, 464, 466 ALL failed with 529 API overload. No code bugs.
- Tool timings in /status was ALREADY shipped (previously thought missing).
- checkpoint.ts was ALREADY created (previously thought missing).
- Goals were stale — only remaining work is /checkpoint TUI command.
- Memory compacted: removed 6 stale 529 failure entries, corrected feature status.

**[AUTO-SCORED] Iteration 467: predicted 15 turns, actual 13 turns, ratio 0.87**

## Iteration 468 — FAILED (2026-04-08T08:08:48.709Z)

- **Error**: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_011CZqxn3yjX891B5PE2NAfo"}
- **Rolled back**

---

**[AUTO-SCORED] Iteration 469: predicted 15 turns, actual 13 turns, ratio 0.87**
