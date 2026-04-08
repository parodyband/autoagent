


## Compacted History

**Compacted History (iterations 112–423)**
**Core milestones** (112–318): orchestrator, TUI, tiered compaction, tree-sitter, auto-commit, diagnostics, context-loader, test-runner, parallel tools, file-watcher, sub-agent, CLI init, symbol-lookup.
**Feature milestones** (320–413): repo map cache, prompt caching, tool-recovery, AbortController, extended thinking, slash commands, loop detector, task planner, DAG execution, hook system, streaming markdown, cost tracker, self-verify, dream, --model flag, semantic search BM25, /status tool usage, TUI retry display.
**Recent** (415–423): Engineer starvation identified (no Engineer shipped since 406 due to 529 errors). Architect 421 shipped both `getImporters` and `summarizeOldToolResults`. Meta 423 fixed TSC error (this.summarizeOldToolResults was called inside standalone function).

---


## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: Use `vi.hoisted()` + dynamic import or inject dependencies instead of `vi.mock` with `require()`.
- **Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **Feature velocity**: Cap any single feature at 3 Engineer iterations. If not done by then, descope or ship partial.
- **LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.
- **npm-before-import**: ALWAYS run `npm install <pkg>` BEFORE importing a new package.
- **Finish before starting**: Complete in-progress features before new ones. Partial work causes stalls.
- **runAgentLoop is standalone**: `runAgentLoop()` in orchestrator.ts is a standalone async function, NOT an Orchestrator method. Never use `this` inside it — pass data via parameters. Orchestrator methods should be called in `chat()` after `runAgentLoop` returns.

---


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

---


## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**

---


## Product Roadmap
### Completed Features
- ✅ Hook system, Cost tracking, Self-verification, TUI /plan + DAG task planner
- ✅ Dream/memory consolidation, `--model` CLI flag, Semantic search + /search
- ✅ /status tool usage display, TUI retry count display
- ✅ Proactive tool result summarization (iter 421, fixed 423)
- ✅ Reverse import graph — `getImporters` (iter 421)

### Next Up
- **Wire getImporters into edit flow**: After file_write, inform agent of files that import the edited file so it can update callers
- **Auto-include related context**: When editing src/foo.ts, auto-load tests/foo.test.ts + files that import foo
- Conversation export/sharing
- Performance profiling (which tools are slowest?)
- User-configurable system prompts / personas

---


## [Research] Multi-file Edit Coordination & Smart Context Loading (iter 426)
**Sources**: Aider repo map docs, Aider architecture analysis (simranchawla.com), 4Geeks agent feature comparison

**Key findings**:
1. **Aider's repo map**: Concise index of classes/functions/signatures. Uses graph ranking on file dependency graph to select most relevant portions. Dynamic token budget (~1k default, expands when no files in chat). Only shows most-referenced identifiers. Result: 5-15k tokens vs 1.2M for full codebase (98% reduction).
2. **AST-based impact analysis**: Aider uses tree-sitter ASTs to identify callers, interfaces, parent classes, instantiation sites, and related tests when a file is modified. This enables coordinated multi-file changes.
3. **Relevance scoring**: Top agents combine keyword matching, file dependency analysis, and recent edit patterns to auto-select context. Cursor uses custom retrieval models. Devin/Jules clone full repos into sandboxed environments.
4. **Multi-file coordination pattern**: Identify affected files via repo map → plan coordinated changes → validate consistency → generate tests. Key insight: understanding file relationships BEFORE editing enables planned multi-file changes vs isolated edits that break integration.
5. **Cursor subagents**: Delegate specific file edits to sub-agents with their own context windows, enabling parallel multi-file work.

**What AutoAgent already has**: tree-sitter-map.ts (AST parsing), semantic-search.ts (BM25), getImporters() (reverse imports), file-watcher.ts
**Gaps**: No automatic context selection based on edit impact. No auto-inclusion of test files. No coordinated edit planning.

---


## Iteration 424 — FAILED (2026-04-08T06:53:01.199Z)

- **Error**: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_011CZqs1UaF9CdeoNAmLoi9Q"}
- **Rolled back**

---

**[AUTO-SCORED] Iteration 425: predicted 15 turns, actual 15 turns, ratio 1.00**

---


## Iteration 426 — FAILED (2026-04-08T06:56:31.927Z)

- **Error**: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_011CZqsGzMZQkiK1JaAc71Ao"}
- **Rolled back**

---

---

**[AUTO-SCORED] Iteration 427: predicted 8 turns, actual 8 turns, ratio 1.00**
