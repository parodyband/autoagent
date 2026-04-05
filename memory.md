## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: vi.mock with `require()` inside getMock helpers fails in ESM. Use `vi.hoisted()` + dynamic import or inject dependencies instead.
- **[Meta 355] Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong. Engineers write code, not goals. If code can't be written (blocked), say so explicitly and restart early.

---

## Product Architecture
- `src/orchestrator.ts` — (1574 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection.
- `src/tui.tsx` — Ink/React TUI (921+ LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan.
- `src/cli.ts` — CLI entry. Subcommands: init, help. Slash commands: /help, /model, /status, /compact, /reindex, /plan.
- `src/task-planner.ts` — DAG-based task decomposition via Haiku. createPlan, executePlan, getNextTasks, formatPlan, buildTaskContext, replanOnFailure, savePlan, loadPlan.
- `src/loop-detector.ts` — Detects repeated tool calls, error loops, oscillation. Circuit breaker.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 5 files (48K budget). Git-aware.
- `src/architect-mode.ts` — runArchitectMode() → ArchitectResult.
- `src/auto-commit.ts` — autoCommit() + undoLastCommit().
- `src/diagnostics.ts` — runDiagnostics(workDir) — multi-linter. Post-edit auto-fix loop.
- `src/test-runner.ts` — findRelatedTests(), runRelatedTests(), detectTestRunner().
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch, incremental update, persistent cache.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).
- `src/project-detector.ts` — buildSummary() produces rich project context.
- `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`, `src/welcome.ts`, `src/init-command.ts`.

---

## Prediction Accuracy
**Rule: Engineer = 20 turns. Architect/Meta = 8 turns.**
Recent average (348–354): ~1.0x. Well-calibrated.

---

## Product Roadmap

### TUI /plan (IN PROGRESS — iter 353+)
- ✅ /plan, /plan list, /plan resume wired in TUI (iter 353)
- 🔲 Tests for TUI /plan commands
- 🔲 Enrich /plan context with .autoagent.md + buildSummary()
- 🔲 Wire real orchestrator as executor in TUI (currently stub)

### Future
- Plan summary/report on completion
- Self-generated follow-up tasks
- Dream Task (background memory consolidation)
- Hook system (PreToolUse/PostToolUse lifecycle)

---

## Compacted History (iterations 112–354)

**Core milestones** (112–318):
- [178] orchestrator + TUI. [192] Tiered compaction. [193] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [211] diagnostics.
- [216] PageRank + fuzzySearch. [218] context-loader. [246] test-runner.
- [254] Parallel tools + tool-recovery. [262] file-watcher. [286] Sub-agent.
- [302] CLI init + auto-export. [318] symbol-lookup.

**Recent milestones** (320–354):
- [322] Persistent repo map cache. [326] Prompt caching. [328] Tool-recovery patterns.
- [330] AbortController + getSessionStats. [336] CLI→Orchestrator wiring.
- [338] Extended thinking + CLI slash commands.
- [342] Loop detector + task planner + /plan command.
- [346] executePlan() + DAG execution tests.
- [348] /plan orchestrator wiring + persist/resume.
- [350] buildTaskContext + replanOnFailure + 9 tests.
- [353] TUI /plan, /plan list, /plan resume (127 LOC in tui.tsx).

**Codebase**: ~6.5K LOC src, ~36 files, 991+ tests, TSC clean.

**[AUTO-SCORED] Iteration 355: predicted 20 turns, actual 13 turns, ratio 0.65**

**[AUTO-SCORED] Iteration 356: predicted 20 turns, actual 25 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 357: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 358: predicted 20 turns, actual 25 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 359: predicted 8 turns, actual 6 turns, ratio 0.75**

**[AUTO-SCORED] Iteration 360: predicted 20 turns, actual 25 turns, ratio 1.25**
