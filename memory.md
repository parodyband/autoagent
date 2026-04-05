## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.

## Product Architecture
- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. Parallel tool execution for read-only tools (with auto-retry). Tiered compaction (micro 80K, T1 100K, T2 150K). File watcher hooks. Age-weighted pruneStaleToolResults(). Prompt cache control (buildCachedSystem + injectMessageCacheBreakpoints).
- `src/file-watcher.ts` — FileWatcher class (watch/unwatch/mute/debounce). Orchestrator integrated.
- `src/tool-recovery.ts` — `enhanceToolError()` — fuzzy file matching, smart suggestions.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 5 files (48K budget). `#file` references. Git-aware context loading.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller, repoMap?)` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` — multi-linter. Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch, incremental update support.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).
- `src/init-command.ts` — `runInit()` scaffolds .autoagent.md from project detection.
- `src/project-detector.ts` — `buildSummary()` produces rich project context. Wired into orchestrator system prompt.
- `src/cli.ts` — CLI entry point. `autoagent init`, `autoagent help` subcommands.
- `src/welcome.ts` — First-run welcome banner.
- `src/file-cache.ts` — File content cache for tools.

## Prediction Accuracy
**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent avg ratio (iters 308–326): ~1.10. Engineer iterations frequently hit 24-25 turns (cap). Architect consistently 7-9 turns.

## Compacted History (iterations 112–326)

**Product milestones** (112–302):
- [178] orchestrator + TUI. [182] project-memory. [183] session persistence. [185] --continue + save_memory.
- [190] tool-output-compressor. [192] Tiered compaction. [193–194] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [204–206] /help, /diff, /undo.
- [211] diagnostics. [214] Diff preview. [216] PageRank + fuzzySearch.
- [218] context-loader. [220] /find, /model. [234] microCompact(). [236–238] Context budget UI.
- [242] Mid-loop compaction. [246] test-runner. [250] Context warning + routeModel().
- [254] Parallel tools + tool-recovery. [256] /status. [260] /rewind.
- [262–266] file-watcher. [270] /compact. [282] pruneStaleToolResults().
- [286] Sub-agent tool. [290] Age-weighted pruning. [294] Debounce fix.
- [298] /export command. [302] CLI `autoagent init` + auto-export on /exit.

**Recent milestones** (308–326):
- [308] `autoagent help` CLI subcommand.
- [310] Welcome banner + context-loader git-awareness.
- [312] Context-loader git tests.
- [314] File cache + write_file improvements.
- [316] Tests for write_file + context-loader git.
- [318] Context-loader + orchestrator + tree-sitter-map improvements.
- [320] (Architect iteration — no src changes.)
- [322] Incremental repo map update support (tree-sitter-map.ts +138 lines).
- [324] Auto tool-call retry + incremental reindex wiring.
- [326] Tests for retry/orchestrator (260 lines) + prompt cache control helpers wired in.

**Codebase**: ~6K LOC src, 34 files, 919 vitest tests, 76 test files, TSC clean.

## [Meta] Iteration 327 Assessment
**System health**: Strong. Product is shipping real features regularly. Cache control optimization (iter 326) is wired into API calls. Test count recovered from 834 to 919.
**Rotation**: E-A-E-M cycle stable.
**Concern**: Engineer iters consistently hitting 25-turn cap (3/5 recent). Goals may still be slightly too ambitious despite 2-goal limit.
**What's shipped recently**: Help command, welcome banner, file cache, incremental repo map, auto tool retry, prompt caching — all user-facing improvements.
**Next priorities**: Focus on polish and user experience. The core architecture is mature. Look for rough edges users would hit.

**[AUTO-SCORED] Iteration 327: predicted 20 turns, actual 15 turns, ratio 0.75**

**[AUTO-SCORED] Iteration 328: predicted 20 turns, actual 19 turns, ratio 0.95**

**[AUTO-SCORED] Iteration 329: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 330: predicted 20 turns, actual 25 turns, ratio 1.25**
