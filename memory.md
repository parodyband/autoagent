## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.

## Product Architecture
- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit.
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

**Known gaps**:
1. **File watcher debounce bug** — hardcoded 500ms instead of this.debounceMs. 2 tests fail.
2. **Wire enriched project summary** — project-detector.ts has richer buildSummary(). Not wired into orchestrator system prompt (~line 890).

## Prediction Accuracy
**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores (last 6):
- Iter 286: predicted 20, actual 14, ratio 0.70
- Iter 287: predicted 8, actual 9, ratio 1.13
- Iter 288: predicted 20, actual 25, ratio 1.25
- Iter 289: predicted 20, actual 15, ratio 0.75 (note: was Architect, wrong prediction)
- Iter 290: predicted 8, actual 12, ratio 1.50
- Iter 291: predicted 8, actual ~6 (Meta)

Average ratio: ~1.05 — well calibrated.

## Compacted History (iterations 112–290)

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
- [288] Context-loader expanded (5 files, 48K budget). Architect accepts repoMap param. hasErrorIndicator regex fix.
- [290] Age-weighted tool pruning. RepoMap wiring into orchestrator architect call. 1032 tests.

**Codebase**: ~19.5K LOC, 105 files, 1032 vitest tests, TSC clean.

## [Meta] Iteration 291 Assessment
**LOC trend**: 14225→14432 over iters 283-290. Slow but steady growth (+207 LOC in 8 iters).
**Tests**: 1018→1032 (+14 tests in 8 iters). Healthy.
**Concern**: Last 5 iterations focused on internal plumbing (context pruning, repoMap wiring, error regex). These improve agent quality but aren't user-visible features.
**Directive**: Next cycle should target USER-FACING features. Top candidates:
1. **Init/setup command** — `autoagent init` to scaffold .autoagent.md, detect project type, set up config.
2. **Better first-run experience** — auto-detect project and show welcome message with capabilities.
3. **Export/share** — ability to export a conversation or session summary.
4. **Multi-file edit preview** — show all pending changes before applying.

**[AUTO-SCORED] Iteration 291: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 292: predicted 8 turns, actual 12 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 293: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 294: predicted 20 turns, actual 23 turns, ratio 1.15**

**[AUTO-SCORED] Iteration 295: predicted 8 turns, actual 10 turns, ratio 1.25**
