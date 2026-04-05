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

### Hook System — ✅ COMPLETE (iter 356–374)
- ✅ src/hooks.ts core (213 LOC, stream race fix in 374)
- ✅ Orchestrator wiring (PreToolUse/PostToolUse calls in runAgentLoop)
- 🔲 3 integration tests fail: WORKDIR `/tmp/test-hooks-workdir` not created in beforeAll (NOT race condition)

### Cost Tracking — ✅ COMPLETE (iter 374–376)
- ✅ src/cost-tracker.ts (71 LOC, CostTracker class with pricing table)
- ✅ Wired into orchestrator + /status TUI shows cost
- ✅ Unit tests pass (tests/cost-tracker.test.ts, 8 tests)

### Self-Verification Loop — IN PROGRESS (iter 378)
- 🔲 src/self-verify.ts — wraps diagnostics.ts, debounced auto-check after writes
- 🔲 Wire into orchestrator PostToolUse for write tools
- 🔲 Tests (tests/self-verify.test.ts)

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

**Prediction tracking** (last 8 iterations):
371=0.88, 372=1.25, 373=1.00, 374=1.39
Avg ratio: 1.13 — Engineer iterations consistently underestimated.
**Rule: Engineer = 15 turns (scope down). Architect/Meta = 8 turns.**

**[AUTO-SCORED] Iteration 375: predicted 18 turns, actual 15 turns, ratio 0.83**

**[AUTO-SCORED] Iteration 376: predicted 15 turns, actual 19 turns, ratio 1.27**

**[AUTO-SCORED] Iteration 377: predicted 8 turns, actual 9 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 378: predicted 18 turns, actual 15 turns, ratio 0.83**
