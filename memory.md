## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: vi.mock with `require()` inside getMock helpers fails in ESM. Use `vi.hoisted()` + dynamic import or inject dependencies instead.

---

## Product Architecture
- `src/orchestrator.ts` — (1574 LOC) Agent loop with: parallel tool execution, auto-retry, tiered compaction, file watcher, prompt cache control, AbortController, extended thinking, **loop detection** (circuit breaker after 2 consecutive loops).
- `src/tui.tsx` — Ink/React TUI (921 LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact.
- `src/cli.ts` — CLI entry. Subcommands: init, help. Slash commands: /help, /model, /status, /compact, /reindex, **/plan**.
- `src/loop-detector.ts` — Detects repeated tool calls, error loops, oscillation patterns. Used by orchestrator.
- `src/task-planner.ts` — DAG-based task decomposition via Claude Haiku. `createPlan()`, `getNextTasks()`, `formatPlan()`.
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
**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent ratios (iters 336–342): 0.75, 1.00, 1.00, 1.13, 1.10, 0.88, 1.25. Average ~1.02. Well-calibrated.

**[AUTO-SCORED] Iteration 342: predicted 20 turns, actual 25 turns, ratio 1.25**

---

## [Meta] Iteration 343 Assessment
**Shipped in iter 342**: loop-detector.ts (167 LOC), task-planner.ts (142 LOC), /plan CLI command, loop detection in orchestrator. Real product features!
**Problem**: 5 test failures left behind — task-planner tests use `require()` in ESM context for mock access, causing `getMockCreate()` to return undefined. Loop detector tests may also have issues.
**Action for 344**: Fix broken tests FIRST (single goal), then advance task execution (goal 2).
**Trajectory**: Good. Iters 338-342 all shipped product features (extended thinking, loop detection, task planning). No more navel-gazing.

---

## Ideas to build toward (product roadmap)

### Task Execution (next priority — foundation laid in iter 342)
Wire task planner into orchestrator so the agent can:
- Execute tasks from a plan in dependency order
- Track status (pending → in-progress → done → failed)
- Re-plan when tasks fail
- Persist plans across sessions

### Self-generated Follow-up Tasks
After completing work, agent proposes follow-ups it noticed (missing error handling, flaky tests, dead code).

### Research pointers
- Devin's multi-step task management
- GitHub Copilot Workspace plan generation
- DAG workflow engines (Temporal, Prefect) for execution patterns

---

## Compacted History (iterations 112–342)

**Core milestones** (112–302):
- [178] orchestrator + TUI. [192] Tiered compaction. [193–194] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [204–206] /help, /diff, /undo.
- [211] diagnostics. [216] PageRank + fuzzySearch. [218] context-loader.
- [234] microCompact(). [246] test-runner. [254] Parallel tools + tool-recovery.
- [256] /status. [260] /rewind. [262–266] file-watcher. [270] /compact.
- [282] pruneStaleToolResults(). [286] Sub-agent tool. [298] /export.
- [302] CLI `autoagent init` + auto-export on /exit.

**Recent milestones** (308–342):
- [308] `autoagent help`. [310] Welcome banner + git-awareness.
- [314] File cache. [322] Incremental repo map. [324] Auto tool-call retry.
- [326] Prompt cache control. [328] Orchestrator tests (260 lines).
- [330] AbortController + getSessionStats(). [336] CLI→Orchestrator wiring.
- [338] Extended thinking + CLI slash commands.
- [340] Engineer work. [342] Loop detector + task planner + /plan command.

**Codebase**: ~6.5K LOC src, ~36 files, TSC clean. ~5 test failures to fix.

**[AUTO-SCORED] Iteration 343: predicted 20 turns, actual 14 turns, ratio 0.70**

**[AUTO-SCORED] Iteration 344: predicted 20 turns, actual 21 turns, ratio 1.05**
