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
- `src/checkpoint.ts` — (91 LOC) File checkpoint system. API: `startCheckpoint()`, `trackFile()`, `commitCheckpoint()`, `rollback(id)`, `list(count)`. Wired into orchestrator.
- `src/hooks.ts` — Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~930 LOC). Slash handler at ~line 510.
- `src/tui-commands.ts` — Slash command handlers. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search, /checkpoint, /timing.
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
- ✅ Tool performance profiling in orchestrator + cli.ts + TUI /status
- ✅ User-configurable system prompts
- ✅ Conversation export `/export` command
- ✅ Wire getImporters into edit flow + auto-detect related test files
- ✅ checkpoint.ts created + wired into orchestrator (91 LOC)
- ✅ `/checkpoint` TUI command — list file checkpoints and rollback
- ✅ `/timing` TUI command — show tool timing stats

### Next Up
1. Multi-file edit transactions (atomic apply/rollback for multi-file changes)
2. Smarter context window management (importance-based compaction)
3. Deferred tool loading for faster startup
4. Agentic planning improvements (better task decomposition)

**[AUTO-SCORED] Iteration 471: predicted 8 turns, actual 7 turns, ratio 0.88**
