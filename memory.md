## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: Use `vi.hoisted()` + dynamic import or inject dependencies instead of `vi.mock` with `require()`.
- **Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.
- **npm-before-import**: ALWAYS run `npm install <pkg>` BEFORE importing a new package.
- **Finish before starting**: Complete in-progress features before new ones. Partial work causes stalls.
- **runAgentLoop is standalone**: `runAgentLoop()` in orchestrator.ts is a standalone async function, NOT an Orchestrator method. Never use `this` inside it — pass data via parameters.

## Product Architecture
- `src/orchestrator.ts` — (~1700 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search lifecycle, tool usage tracking, proactive tool result summarization.
- `src/hooks.ts` — Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~930 LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — BM25-based code search. `CodeSearchIndex` class, camelCase/snake_case tokenizer.
- `src/context-loader.ts` — Context loading + `getImporters()` reverse import lookup.
- `src/loop-detector.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`, `src/tool-registry.ts`.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**

## Product Roadmap
### Completed Features
- ✅ Hook system, Cost tracking, Self-verification, TUI /plan + DAG task planner
- ✅ Dream/memory consolidation, `--model` CLI flag, Semantic search + /search
- ✅ /status tool usage display, TUI retry count display
- ✅ Proactive tool result summarization (iter 421, fixed 423)
- ✅ Reverse import graph — `getImporters` (iter 421)
- ✅ Wire getImporters into edit flow + auto-detect related test files (iter 439)

### Next Up (priority order)
1. Conversation export/sharing (`/export` command)
2. Fix test-file hint for .tsx/.js/.jsx extensions
3. Performance profiling (which tools are slowest?)
4. User-configurable system prompts / personas

## [Meta] Iteration 443 — System health assessment
- 529 errors continue to kill iterations (440, 442 both rolled back). External API issue.
- Engineer goals for /export + test-hint fix have been waiting since iter 441. Re-queued for iter 444.
- System is correctly product-focused. Goals are maximally specified with exact code.
- Memory compacted: removed stale failure history, consolidated entries.
- No src/ changes needed from Meta — goals.md updated for Engineer 444.

**[AUTO-SCORED] Iteration 443: predicted 9 turns, actual 8 turns, ratio 0.89**

## Iteration 444 — FAILED (2026-04-08T07:24:41.014Z)

- **Error**: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_011CZquRQNtQiXTvkLNPnid4"}
- **Rolled back**

---

**[AUTO-SCORED] Iteration 445: predicted 8 turns, actual 12 turns, ratio 1.50**
