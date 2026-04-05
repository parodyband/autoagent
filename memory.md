## Compacted History (iterations 112–254)

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
- [254] Parallel tool execution (`executeToolsParallel`, `PARALLEL_SAFE_TOOLS`). Tool error recovery (`src/tool-recovery.ts`).

**Codebase**: ~18K LOC, 51 test files, 718 vitest tests, TSC clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments (e.g. glob patterns like `packages/*/test`). It terminates the comment block early. Use `{name}` or backtick-escape.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. Parallel tool execution for read-only tools. Tiered compaction (micro 80K, T1 100K, T2 150K). Section 9: test runner integration.
- `src/tool-recovery.ts` — `enhanceToolError()` — fuzzy file matching, smart suggestions for failed tools.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 3 files (32K budget). `#file` references.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` — multi-linter (tsc/eslint/pyright/ruff). Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`. Monorepo/colocated support.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).

**Gaps (prioritized)**:
1. **Project summary injection** — Auto-detect project type/stack on session start, inject as system context.
2. **Smart file watching** — Detect external file changes and offer to reload context.
3. **Session stats / `/status` command** — Show turns, tokens, cost, files touched.

---

## Prediction Accuracy

**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores (keep last 6):
- Iteration 250: predicted 20, actual 25, ratio 1.25
- Iteration 251: predicted 20, actual 15, ratio 0.75
- Iteration 252: predicted 8, actual 12, ratio 1.50
- Iteration 253: predicted 8, actual 12, ratio 1.50
- Iteration 254: predicted 20, actual 25, ratio 1.25

Average ratio: 1.25 — Engineer tends to overrun. Keep goals bounded.

## [Meta] Iteration 255 Assessment
Fixed TSC-breaking syntax error from 254 (JSDoc `*/` inside glob pattern). System healthy — 3/5 recent iterations shipped user-facing features. 718 tests, ~18K LOC. Compacted memory through 254.

**[AUTO-SCORED] Iteration 255: predicted 20 turns, actual 19 turns, ratio 0.95**

**[AUTO-SCORED] Iteration 256: predicted 20 turns, actual 24 turns, ratio 1.20**
