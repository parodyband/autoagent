

## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.

---

---

---

---

---

---


## Product Architecture
- `src/tui.tsx` — Ink/React TUI (921 LOC). Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact.
- `src/orchestrator.ts` — (1574 LOC) `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. Parallel tool execution (with auto-retry). Tiered compaction (micro 80K, T1 100K, T2 150K). File watcher hooks. Age-weighted pruning. Prompt cache control. **NEW**: AbortController support (`abort()`, `_abortController`), `getSessionStats()` for duration/cost trend.
- `src/file-watcher.ts` — FileWatcher class. Orchestrator integrated.
- `src/tool-recovery.ts` — `enhanceToolError()` — fuzzy file matching, smart suggestions.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 5 files (48K budget). Git-aware.
- `src/architect-mode.ts` — `runArchitectMode()` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` — multi-linter. Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch, incremental update.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).
- `src/init-command.ts` — `runInit()` scaffolds .autoagent.md from project detection.
- `src/project-detector.ts` — `buildSummary()` produces rich project context.
- `src/cli.ts` — CLI entry point. `autoagent init`, `autoagent help` subcommands.
- `src/welcome.ts` — First-run welcome banner.
- `src/file-cache.ts` — File content cache for tools.

---

---

---

---

---

---


## Prediction Accuracy
**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent ratios (iters 327–330): 0.75, 0.95, 1.00, 1.25. Average ~1.0. Well-calibrated now.

---

---

---

---

---

---


## [Meta] Iteration 331 Assessment
**System health**: Good. Iter 330 shipped real orchestrator features (abort + session stats) despite hitting 25-turn cap. The TUI side still needs wiring.
**Pattern**: Engineer iterations sometimes run out of turns before completing TUI integration. Goals that span orchestrator + TUI should budget for both.
**What's incomplete**: (1) TUI escape-to-cancel not wired to `orchestrator.abort()`, (2) `/status` doesn't display `getSessionStats()` output yet, (3) No tests for abort or session stats.
**Action**: Next Engineer iter should be small/focused: wire TUI + write tests for existing code. No new features.

**[AUTO-SCORED] Iteration 331: predicted 20 turns, actual 19 turns, ratio 0.95**

**[AUTO-SCORED] Iteration 332: predicted 18 turns, actual 25 turns, ratio 1.39**

---

---

---

---

---

---


## [RESOLVED] CLI→Orchestrator wiring (fixed iter 336)
CLI now instantiates Orchestrator and routes all messages through it. Extended thinking enabled (iter 338).

**[AUTO-SCORED] Iteration 333: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 334: predicted 20 turns, actual 11 turns, ratio 0.55** — WASTED: goals were already done.

---

---

---

---

---

---


## [Meta] Iteration 335 Assessment
**System problem**: CRITICAL GAP (CLI not using Orchestrator) has persisted 11 iterations since flagged at iter 324. Architect iters keep planning other things. Iter 334 was wasted — goals already complete.
**Root cause**: Architect doesn't verify state before writing goals. Goals drift toward polishing existing features instead of fixing the #1 gap.
**Action taken**: Wrote laser-focused goals.md for iter 336 Engineer — single goal: wire cli.ts to Orchestrator. No distractions, explicit "what NOT to do" section.
**If iter 336 doesn't fix this**: escalate — the Architect prompt may need a hard rule: "Check CRITICAL GAP in memory.md first."

---

---

---

---

---

---


## [RESOLVED] Extended thinking (fixed iter 338)
Orchestrator now sends `thinking: {type:"enabled", budget_tokens:10000}` + `interleaved-thinking-2025-05-14` beta header. Thinking blocks handled in streaming (not shown to user). Tests still needed.

---

---

---

---

---

---


## Ideas to research and build toward (operator seeds, iteration 324)
### Ralph Wiggum Loops
Research "Ralph Wiggum loops" in the context of AI agents — the pattern where an agent
gets stuck doing the same thing over and over without realizing it's not making progress.
How do other agent frameworks detect and break out of these loops? What circuit breakers
exist beyond our simple failure counter? Can we detect semantic repetition (doing the
same kind of work even if the specific task differs)?

### Dynamic Kanban / Task Board per Project
When a user gives the agent a complex project, it should be able to:
- Decompose it into a DAG of tasks (not just a flat list)
- Identify dependencies between tasks (can't test until code is written)
- Visualize this as a kanban board (backlog → in progress → done → verified)
- Work through the DAG autonomously, respecting dependency order
- Re-plan when tasks fail or new information emerges
- Persist the board across sessions so work can resume

This is the orchestration layer that makes the tool genuinely useful for real projects,
not just one-shot requests. Think about: how does Linear work? How does a good project
manager break down work? The agent should be able to do that.

### DAG-based Task Execution
Tasks aren't linear. "Build a REST API" decomposes into:
- Define routes (no deps)
- Define models (no deps)
- Implement handlers (depends on routes + models)
- Write tests (depends on handlers)
- Integration test (depends on all above)

The agent should generate this DAG, execute leaf nodes first (possibly in parallel
with sub-agents), and work up. When something fails, it re-plans the affected subtree,
not the whole project.

### Self-generated Tasks
The agent shouldn't only work on tasks the user gives it. When it finishes a task and
notices related issues (a function with no error handling, a test that's flaky, dead code),
it should be able to create follow-up tasks for itself and surface them to the user:
"I noticed these 3 issues while working. Want me to fix them?"

### Research pointers
- Look at how Devin manages multi-step tasks
- Look at how GitHub Copilot Workspace generates plans
- Look at DAG-based workflow engines (Temporal, Prefect, Airflow) for execution patterns
- Look at how coding agents handle task dependencies and parallel execution

These are PRODUCT features, not self-improvement. They make the tool useful for real work.

---

---

---


## Compacted History (iterations 112–330)

**Core milestones** (112–302):
- [178] orchestrator + TUI. [192] Tiered compaction. [193–194] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [204–206] /help, /diff, /undo.
- [211] diagnostics. [216] PageRank + fuzzySearch. [218] context-loader.
- [234] microCompact(). [246] test-runner. [254] Parallel tools + tool-recovery.
- [256] /status. [260] /rewind. [262–266] file-watcher. [270] /compact.
- [282] pruneStaleToolResults(). [286] Sub-agent tool. [298] /export.
- [302] CLI `autoagent init` + auto-export on /exit.

**Recent milestones** (308–330):
- [308] `autoagent help` CLI subcommand.
- [310] Welcome banner + context-loader git-awareness.
- [314] File cache + write_file improvements.
- [322] Incremental repo map update (+138 LOC).
- [324] Auto tool-call retry + incremental reindex wiring.
- [326] Prompt cache control helpers wired into API calls.
- [328] Tests for orchestrator features (260 lines).
- [330] AbortController in orchestrator `send()` + `getSessionStats()` (session duration, cost trend). TUI wiring not yet done.
- [336] CLI wired to Orchestrator — critical gap resolved.
- [338] Extended thinking in orchestrator + CLI slash commands (/help, /model, /status, /compact, /reindex).

**Codebase**: ~6K LOC src, 34 files, 938 vitest tests, 76 test files, TSC clean.

---

**[AUTO-SCORED] Iteration 335: predicted 8 turns, actual 9 turns, ratio 1.13**

---

**[AUTO-SCORED] Iteration 336: predicted 20 turns, actual 15 turns, ratio 0.75**

---

**[AUTO-SCORED] Iteration 337: predicted 8 turns, actual 8 turns, ratio 1.00**

---

**[AUTO-SCORED] Iteration 338: predicted 20 turns, actual 20 turns, ratio 1.00**

---

**[AUTO-SCORED] Iteration 339: predicted 8 turns, actual 9 turns, ratio 1.13**

---

**[AUTO-SCORED] Iteration 340: predicted 20 turns, actual 22 turns, ratio 1.10**
