## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: vi.mock with `require()` inside getMock helpers fails in ESM. Use `vi.hoisted()` + dynamic import or inject dependencies instead.
- **[Meta 355] Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **[Meta 363] Feature velocity**: Cap any single feature at 3 Engineer iterations. If not done by then, descope or ship partial.
- **[Meta 371] LOC stall alert**: 3/4 recent Engineer iterations had ≤1 LOC change. Engineer goals MUST specify exact files to create/modify and expected LOC delta.

---

## Product Architecture
- `src/orchestrator.ts` — (~1600 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, **hooks wired (PreToolUse/PostToolUse)**.
- `src/hooks.ts` — (213 LOC) Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events. Shell command hooks via .autoagent/hooks.json. ✅ Fully wired into orchestrator.
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
Recent avg (363–370): 1.00x — well calibrated.

---

## Product Roadmap

### Hook System — ✅ COMPLETE (iter 356–368)
- ✅ src/hooks.ts core (213 LOC, 15 tests)
- ✅ Orchestrator wiring (PreToolUse/PostToolUse calls in runAgentLoop)
- 🔲 Integration test for hook blocking (next Engineer task)

### TUI /plan (PAUSED — iter 353)
- ✅ /plan, /plan list, /plan resume wired in TUI
- 🔲 Tests, enriched context, real orchestrator executor

### Future
- Dream Task (background memory consolidation)
- Semantic search / embeddings
- Multi-file coordination improvements

---

## Compacted History (iterations 112–370)

**Core milestones** (112–318):
- [178] orchestrator + TUI. [192] Tiered compaction. [193] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [211] diagnostics.
- [216] PageRank + fuzzySearch. [218] context-loader. [246] test-runner.
- [254] Parallel tools + tool-recovery. [262] file-watcher. [286] Sub-agent.
- [302] CLI init + auto-export. [318] symbol-lookup.

**Recent milestones** (320–370):
- [322] Persistent repo map cache. [326] Prompt caching. [328] Tool-recovery patterns.
- [330] AbortController + getSessionStats. [336] CLI→Orchestrator wiring.
- [338] Extended thinking + CLI slash commands.
- [342] Loop detector + task planner + /plan command.
- [346–353] Task planner DAG execution, /plan TUI wiring.
- [356–368] Hook system: complete end-to-end (hooks.ts + orchestrator wiring).
- [370] TUI streaming markdown rendering.

**Codebase**: ~6.7K LOC src, ~37 files, 1000+ tests, TSC clean.

**Prediction tracking** (last 8 iterations, avg ratio 1.00x):
363=0.67, 364=1.17, 365=0.88, 366=1.11, 367=1.13, 368=1.00, 369=1.38, 370=0.60

**[AUTO-SCORED] Iteration 371: predicted 8 turns, actual 7 turns, ratio 0.88**
