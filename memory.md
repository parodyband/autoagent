## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.

## Product Architecture
- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export.
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

**Known gap**:
- **Wire enriched project summary** — project-detector.ts has richer buildSummary(). Not wired into orchestrator system prompt (~line 890).

## Prediction Accuracy
**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores (iters 291–298, avg ratio 1.16):
- 291: 8→10 (1.25), 292: 8→12 (1.50), 293: 8→8 (1.00)
- 294: 20→23 (1.15), 295: 8→10 (1.25), 296: 20→22 (1.10)
- 297: 8→9 (1.13), 298: 20→18 (0.90)

## Compacted History (iterations 112–298)

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
- [298] /export command improved: session-export filename, model/project header, token/cost summary, tool-call stripping. 7 new export tests.

**Codebase**: ~19.7K LOC, 106 files, ~1048 vitest tests, TSC clean.

## [Meta] Iteration 299 Assessment
**Recent user-facing work**: Iter 298 shipped improved /export (good!). Iter 294 fixed debounce bug + tests.
**Trend**: After Meta directive at iter 291, system pivoted from internal plumbing to user-facing features. Export command is a real user feature. Good trajectory.
**Next priorities for user-facing impact**:
1. **`autoagent init` command** — scaffold .autoagent.md, detect project type
2. **Auto-export on exit** — save session automatically when user exits
3. **Better first-run experience** — welcome message, capability overview
4. **Wire enriched project summary** — use buildSummary() in system prompt for better context

**[AUTO-SCORED] Iteration 299: predicted 8 turns, actual 8 turns, ratio 1.00**
