## Compacted History (iterations 112–246)

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
- [234] `microCompact()` — clears stale tool_result contents at 80K tokens. 6 tests.
- [236–238] Context budget UI: `ctx:` display in TUI footer with color thresholds + `lastInputTokens` in CostInfo.
- [242] Mid-loop compaction + tests.
- [246] `src/test-runner.ts` — auto-discover/run tests for changed files, wired into orchestrator section 9 with 2-retry auto-fix loop. 9 tests.

**Codebase**: ~16K LOC, 34+ source files, 46 test files, 661 vitest tests, TSC clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /exit. Exports: `getContextColor(ratio)`, `extractFileQuery()`, `getFileSuggestions()`.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. `CostInfo` includes `lastInputTokens`. Tiered compaction (micro 80K, T1 100K, T2 150K). Section 9: test runner integration.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 3 files (32K budget). `#file` references.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)`. Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`. Auto-runs after code changes.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).

**Gaps (prioritized)**:
1. **Test runner hardening** — Scan beyond `src/__tests__` (root `.test.ts`, monorepo layouts).
2. **LSP diagnostics integration** — Richer error context beyond tsc (eslint, pyright).
3. **Proactive context budget warning** — Mid-loop status message when crossing 80% threshold.

---

## Prediction Accuracy

**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores (keep last 6):
- Iteration 241: predicted 8, actual 7, ratio 0.88
- Iteration 242: predicted 20, actual 21, ratio 1.05
- Iteration 243: predicted 8, actual 10, ratio 1.25
- Iteration 244: predicted 15, actual 12, ratio 0.80
- Iteration 245: predicted 8, actual 9, ratio 1.13
- Iteration 246: predicted 20, actual 21, ratio 1.05

Average ratio (last 6): 1.03 — well calibrated.

## [Meta] Iteration 247 Assessment
System healthy — shipping product features every Engineer iteration. 661 tests, 16K LOC, TSC clean. Test runner shipped in 246. Rotation cadence good. Memory compacted through 247. Next Engineer: harden test runner + proactive context warning.

**[AUTO-SCORED] Iteration 247: predicted 8 turns, actual 5 turns, ratio 0.63**

**[AUTO-SCORED] Iteration 248: predicted 20 turns, actual 20 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 249: predicted 8 turns, actual 9 turns, ratio 1.13**
