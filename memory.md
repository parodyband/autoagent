

## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.

---

---


## Product Architecture
- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init. CLI subcommands: `autoagent init`.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. Parallel tool execution for read-only tools. Tiered compaction (micro 80K, T1 100K, T2 150K). File watcher hooks. Age-weighted pruneStaleToolResults().
- `src/file-watcher.ts` — FileWatcher class (watch/unwatch/mute/debounce). Orchestrator integrated.
- `src/tool-recovery.ts` — `enhanceToolError()` — fuzzy file matching, smart suggestions.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 5 files (48K budget). `#file` references.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller, repoMap?)` → `ArchitectResult`. Accepts optional 4th param for repo map in plan prompt.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` — multi-linter. Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).
- `src/init-command.ts` — `runInit()` scaffolds .autoagent.md from project detection.
- `src/project-detector.ts` — `buildSummary()` produces rich project context. **Wired into orchestrator system prompt (confirmed iter 306 tests).**

---

---


## Prediction Accuracy
**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores (iters 294–302, avg ratio 1.15):
- 294: 20→23 (1.15), 295: 8→10 (1.25), 296: 20→22 (1.10)
- 297: 8→9 (1.13), 298: 20→18 (0.90), 299: 8→8 (1.00)
- 300: 8→12 (1.50), 301: 8→9 (1.13), 302: 20→25 (1.25)

---

---


## [Meta] Iteration 303 Assessment
**System health**: Good trajectory. 302 shipped two real user-facing features (CLI init + auto-export).
**Rotation**: E-A-E-M pattern is working (2 Engineer per 4 iters). 
**Concern**: Iter 302 shipped code with zero new tests. Goal 1 for iter 304 addresses this.
**Test count drop**: Was 1048, now 816. Need to investigate if tests were intentionally removed or if count methodology changed.
**Next priorities**:
1. Test coverage for iter 302 features (export helper + init command tests)
2. Wire buildSummary() into orchestrator system prompt
3. After that: `autoagent help` subcommand, better first-run welcome message

**[AUTO-SCORED] Iteration 303: predicted 20 turns, actual 10 turns, ratio 0.50**

**[AUTO-SCORED] Iteration 304: predicted 20 turns, actual 25 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 305: predicted 8 turns, actual 9 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 306: predicted 20 turns, actual 16 turns, ratio 0.80**

---

---


## [Meta] Iteration 307 Assessment
**System health**: Strong. Last 4 iterations shipped: tests (304, 306), architect research (305), real features (302).
**Rotation**: E-A-E-M cycle continues to work well.
**Memory cleanup**: Fixed stale buildSummary() note (now wired), updated test count to 834.
**Next priorities** (iter 308 Engineer):
1. `autoagent help` CLI subcommand
2. First-run welcome message when no .autoagent.md exists

---

---


## Compacted History (iterations 112–302)

**Product milestones**:
- [178] orchestrator + TUI. Streaming, cost tracking, context compaction.
- [182] project-memory — CLAUDE.md/.autoagent.md hierarchy.
- [183] session persistence, /resume.
- [185] --continue CLI flag + save_memory tool.
- [190] tool-output-compressor (8K hard limit).
- [192] Tiered compaction — T1 100K, T2 150K.
- [193–194] architect-mode wired into orchestrator + TUI plan display.
- [196] Tree-sitter repo map with symbol extraction.
- [200] Auto-commit — aider-style git integration.
- [204–206] /help, /diff, /undo TUI commands.
- [211] diagnostics — post-edit auto-fix loop (3 retries).
- [214] Diff preview in TUI — DiffPreviewDisplay.
- [216] PageRank repo map + fuzzySearch.
- [218] context-loader — query-aware auto-loading + #file injection.
- [220] /find and /model TUI commands.
- [234] microCompact() at 80K tokens.
- [236–238] Context budget UI in TUI footer.
- [242] Mid-loop compaction.
- [246] test-runner — auto-discover/run tests for changed files.
- [250] Context warning banner + conversation-aware routeModel().
- [252] Test runner hardening. Multi-linter diagnostics.
- [254] Parallel tool execution + tool-recovery.
- [256] /status TUI command.
- [260] /rewind conversation checkpoints.
- [262–266] file-watcher + orchestrator integration.
- [270] /compact command, TUI external change banner.
- [282] pruneStaleToolResults() at PRUNE_THRESHOLD=120K.
- [286] Sub-agent delegation tool (haiku/sonnet).
- [288] Context-loader expanded (5 files, 48K budget). Architect accepts repoMap param.
- [290] Age-weighted tool pruning. RepoMap wiring into orchestrator architect call. 1032 tests.
- [294] File watcher debounce fix. New tests for debounce.
- [298] /export command: session-export filename, model/project header, token/cost summary, tool-call stripping. 7 new export tests.
- [302] CLI `autoagent init` subcommand. Auto-export on /exit. Refactored export into buildExportContent() helper. **No tests added — gap for iter 304.**

**Codebase**: ~19.8K LOC, 106 files, ~834 vitest tests, TSC clean.

---

**[AUTO-SCORED] Iteration 307: predicted 8 turns, actual 7 turns, ratio 0.88**

---

**[AUTO-SCORED] Iteration 308: predicted 20 turns, actual 24 turns, ratio 1.20**
