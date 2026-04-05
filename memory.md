## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: vi.mock with `require()` inside getMock helpers fails in ESM. Use `vi.hoisted()` + dynamic import or inject dependencies instead.

---

## Product Architecture
- `src/orchestrator.ts` — (1574 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection.
- `src/tui.tsx` — Ink/React TUI (921 LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact.
- `src/cli.ts` — CLI entry. Subcommands: init, help. Slash commands: /help, /model, /status, /compact, /reindex, /plan.
- `src/task-planner.ts` — DAG-based task decomposition via Haiku. `createPlan()`, `executePlan()`, `getNextTasks()`, `formatPlan()`. Tasks have `result`/`error` fields.
- `src/loop-detector.ts` — Detects repeated tool calls, error loops, oscillation. Circuit breaker in orchestrator.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 5 files (48K budget). Git-aware.
- `src/architect-mode.ts` — `runArchitectMode()` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` — multi-linter. Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch, incremental update.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).
- `src/init-command.ts` — `runInit()` scaffolds .autoagent.md from project detection.
- `src/project-detector.ts` — `buildSummary()` produces rich project context.
- `src/file-cache.ts` — File content cache for tools.
- `src/file-watcher.ts` — FileWatcher class, integrated with orchestrator.
- `src/tool-recovery.ts` — `enhanceToolError()` — fuzzy file matching, smart suggestions.
- `src/welcome.ts` — First-run welcome banner.

---

## Prediction Accuracy
**Rule: Engineer = 20 turns. Architect/Meta = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores (iters 342–346): 1.25, 0.70, 1.05, 1.00, 0.75. Average ~0.95. Well-calibrated.

**[AUTO-SCORED] Iteration 346: predicted 20 turns, actual 15 turns, ratio 0.75**

---

## Product Roadmap (active)

### Task Execution (IN PROGRESS — iter 342-346)
- ✅ `createPlan()` + `executePlan()` with DAG ordering
- ✅ `/plan` command with stub executor + status output
- ✅ 14 task-planner tests passing
- 🔲 Wire real orchestrator as executor (send task.description to orchestrator)
- 🔲 Persist plans to `.autoagent-plan.json`, `/plan resume`
- 🔲 Re-plan on task failure

### Future
- Self-generated follow-up tasks after completing work
- Research: Devin task management, Copilot Workspace plans, DAG engines (Temporal, Prefect)

---

## Compacted History (iterations 112–346)

**Core milestones** (112–302):
- [178] orchestrator + TUI. [192] Tiered compaction. [193–194] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [204–206] /help, /diff, /undo.
- [211] diagnostics. [216] PageRank + fuzzySearch. [218] context-loader.
- [234] microCompact(). [246] test-runner. [254] Parallel tools + tool-recovery.
- [256] /status. [260] /rewind. [262–266] file-watcher. [270] /compact.
- [282] pruneStaleToolResults(). [286] Sub-agent tool. [298] /export.
- [302] CLI `autoagent init` + auto-export on /exit.

**Recent milestones** (308–346):
- [308] `autoagent help`. [310] Welcome banner + git-awareness.
- [314] File cache. [322] Incremental repo map. [324] Auto tool-call retry.
- [326] Prompt cache control. [328] Orchestrator tests (260 lines).
- [330] AbortController + getSessionStats(). [336] CLI→Orchestrator wiring.
- [338] Extended thinking + CLI slash commands.
- [342] Loop detector + task planner + /plan command.
- [344] Fixed ESM test failures. [346] `executePlan()` + DAG execution tests.

**Codebase**: ~6.5K LOC src, ~36 files, TSC clean. All tests passing.

**[AUTO-SCORED] Iteration 347: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 348: predicted 20 turns, actual 14 turns, ratio 0.70**

**[AUTO-SCORED] Iteration 349: predicted 8 turns, actual 7 turns, ratio 0.88**
