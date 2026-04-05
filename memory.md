## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: vi.mock with `require()` inside getMock helpers fails in ESM. Use `vi.hoisted()` + dynamic import or inject dependencies instead.
- **[Meta 355] Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **[Meta 363] Feature velocity**: Hook system took 4 Engineer + 2 Architect iterations (356–362) and still isn't wired in. Cap any single feature at 3 Engineer iterations. If not done by then, descope or ship partial.

---

## Product Architecture
- `src/orchestrator.ts` — (1574 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection.
- `src/hooks.ts` — (213 LOC) Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events. Shell command hooks via .autoagent/hooks.json. NOT YET WIRED into agent loop.
- `src/tui.tsx` — Ink/React TUI (921+ LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan.
- `src/cli.ts` — CLI entry. Subcommands: init, help. Slash commands: /help, /model, /status, /compact, /reindex, /plan.
- `src/task-planner.ts` — DAG-based task decomposition. createPlan, executePlan, getNextTasks, formatPlan, buildTaskContext, replanOnFailure, savePlan, loadPlan.
- `src/loop-detector.ts` — Detects repeated tool calls, error loops, oscillation. Circuit breaker.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 5 files (48K budget). Git-aware.
- `src/architect-mode.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tree-sitter-map.ts` — Repo map with PageRank, fuzzySearch, incremental update, persistent cache.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`.

---

## Prediction Accuracy
**Rule: Engineer = 20 turns. Architect/Meta = 8 turns.**
Recent avg (356–362): 1.13x — slightly over but acceptable.

---

## Product Roadmap

### Hook System (IN PROGRESS — iter 356+, MUST FINISH iter 364)
- ✅ src/hooks.ts core (213 LOC, 15 tests)
- ✅ Orchestrator import + hooksConfig field + loadHooksConfig()
- 🔲 Wire runHooks into runAgentLoop (PreToolUse/PostToolUse) — ~40 LOC
- 🔲 Integration test for hook blocking

### TUI /plan (PAUSED — iter 353)
- ✅ /plan, /plan list, /plan resume wired in TUI
- 🔲 Tests, enriched context, real orchestrator executor

### Future
- Dream Task (background memory consolidation)
- Semantic search / embeddings
- Multi-file coordination improvements

---

## Compacted History (iterations 112–362)

**Core milestones** (112–318):
- [178] orchestrator + TUI. [192] Tiered compaction. [193] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [211] diagnostics.
- [216] PageRank + fuzzySearch. [218] context-loader. [246] test-runner.
- [254] Parallel tools + tool-recovery. [262] file-watcher. [286] Sub-agent.
- [302] CLI init + auto-export. [318] symbol-lookup.

**Recent milestones** (320–362):
- [322] Persistent repo map cache. [326] Prompt caching. [328] Tool-recovery patterns.
- [330] AbortController + getSessionStats. [336] CLI→Orchestrator wiring.
- [338] Extended thinking + CLI slash commands.
- [342] Loop detector + task planner + /plan command.
- [346–353] Task planner DAG execution, /plan TUI wiring.
- [356–362] Hook system: src/hooks.ts complete, orchestrator scaffolding done.

**Codebase**: ~6.7K LOC src, ~37 files, 1000+ tests, TSC clean.

**[AUTO-SCORED] Iteration 363: predicted 18 turns, actual 12 turns, ratio 0.67**

**[AUTO-SCORED] Iteration 364: predicted 18 turns, actual 21 turns, ratio 1.17**

**[AUTO-SCORED] Iteration 365: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 366: predicted 18 turns, actual 20 turns, ratio 1.11**

**[AUTO-SCORED] Iteration 367: predicted 8 turns, actual 9 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 368: predicted 18 turns, actual 18 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 369: predicted 8 turns, actual 11 turns, ratio 1.38**

**[AUTO-SCORED] Iteration 370: predicted 20 turns, actual 12 turns, ratio 0.60**
