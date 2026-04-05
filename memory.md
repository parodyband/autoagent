## Compacted History (iterations 112–266)

**Product milestones**:
- [178] `src/orchestrator.ts` + `src/tui.tsx`. Streaming, cost tracking, context compaction.
- [182] `src/project-memory.ts` — CLAUDE.md/.autoagent.md hierarchy discovery + write-back.
- [183] `src/session-store.ts` — JSONL session persistence, `/resume` command.
- [185] `--continue` CLI flag + `save_memory` tool.
- [190] `src/tool-output-compressor.ts` — compresses tool outputs (8K hard limit).
- [192] Tiered compaction — Tier 1 at 100K, Tier 2 at 150K.
- [193–194] `src/architect-mode.ts` — `runArchitectMode()` wired into orchestrator + TUI plan display.
- [196] Tree-sitter repo map — `src/tree-sitter-map.ts` with symbol extraction.
- [200] Auto-commit — `src/auto-commit.ts`, aider-style git integration after edits.
- [204–206] `/help`, `/diff`, `/undo` TUI commands.
- [211] `src/diagnostics.ts` — Post-edit diagnostics with auto-fix loop (up to 3 retries).
- [214] Diff preview in TUI — `DiffPreviewDisplay` component, Y/n/Enter/Esc flow.
- [216] PageRank repo map — `truncateRepoMap()` with reference-frequency scoring, fuzzySearch.
- [218] `src/context-loader.ts` — Query-aware auto-loading + `#file` injection.
- [220] `/find` and `/model` TUI commands shipped.
- [234] `microCompact()` — clears stale tool_result contents at 80K tokens.
- [236–238] Context budget UI: `ctx:` display in TUI footer with color thresholds.
- [242] Mid-loop compaction + tests.
- [246] `src/test-runner.ts` — auto-discover/run tests for changed files with 2-retry auto-fix loop.
- [250] Context warning banner + conversation-aware `routeModel()`.
- [252] Test runner hardening (monorepo/colocated). Multi-linter diagnostics (tsc/eslint/pyright/ruff).
- [254] Parallel tool execution + tool error recovery (`src/tool-recovery.ts`).
- [256] `/status` TUI command — session stats display.
- [258] Project detector tests + TUI status tests.
- [260] `/rewind` conversation checkpoints — snapshot/restore.
- [262–266] `src/file-watcher.ts` — FileWatcher class + orchestrator integration (read/write hooks at all 4 runAgentLoop call sites, onFileWatch wired). TUI banner + tests NOT yet done.

**Codebase**: ~18K LOC, 54 test files, 741 vitest tests, TSC clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. Parallel tool execution for read-only tools. Tiered compaction (micro 80K, T1 100K, T2 150K). File watcher hooks integrated.
- `src/file-watcher.ts` — FileWatcher class (watch/unwatch/mute/debounce). Orchestrator integrated.
- `src/tool-recovery.ts` — `enhanceToolError()` — fuzzy file matching, smart suggestions.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 3 files (32K budget). `#file` references.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` — multi-linter. Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).

**Gaps (prioritized)**:
1. **File watcher TUI banner + tests** — orchestrator hooks done, need user-visible notification + test coverage.
2. **`/compact` command** — manual compaction trigger. Low-effort, high-utility.
3. **Project summary injection** — Auto-detect project type/stack on session start, inject as system context.

---

## Prediction Accuracy

**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores (keep last 6):
- Iteration 260: predicted 20, actual 23, ratio 1.15
- Iteration 261: predicted 8, actual 7, ratio 0.88
- Iteration 262: predicted 20, actual 24, ratio 1.20
- Iteration 263: predicted 20, actual 14, ratio 0.70
- Iteration 264: predicted 20, actual 21, ratio 1.05
- Iteration 265: predicted 8, actual 10, ratio 1.25
- Iteration 266: predicted 20, actual 10, ratio 0.50

Average ratio: 0.96 — well calibrated.

## [Meta] Iteration 267 Assessment
System healthy. Product velocity good — 7 consecutive iterations shipped real features (file watcher: class→integration→hooks). 100% success rate across 262 tracked iterations. Predictions well-calibrated. No prompt changes needed. Memory compacted, gaps updated.

**[AUTO-SCORED] Iteration 267: predicted 20 turns, actual 9 turns, ratio 0.45**
