## Compacted History (iterations 112–239)

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
- [239] [Meta] Fixed TSC error: defined `getContextColor()` export missing from iteration 238.

**Codebase**: ~16K LOC, 34+ source files, 42 test files, 632 vitest tests, TSC clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /exit. Exports: `getContextColor(ratio)`, `extractFileQuery()`, `getFileSuggestions()`.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. `CostInfo` includes `lastInputTokens`. Tiered compaction (micro 80K, T1 100K, T2 150K).
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 3 files (32K budget). `#file` references.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)`. Post-edit auto-fix loop.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).

**Gaps (prioritized)**:
1. **onContextBudget ratio inconsistency** — `runAgentLoop` (line 331) uses `lastInput / COMPACT_TIER1_THRESHOLD` (per-call), but Orchestrator class (lines 762-769) uses `sessionTokensIn / COMPACT_TIER1_THRESHOLD` (cumulative). The runAgentLoop one is wrong — should use cumulative. `lastInputTokens` in CostInfo is fine (tracks last API call's input).
2. **Budget warning tests** — `getContextColor` thresholds untested.
3. **Multi-file edit orchestration** — Batch edits across related files.
4. **LSP diagnostics integration** — Richer error context beyond tsc.

---

## Prediction Accuracy

**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent: Iteration 238 overran (1.53x, 23/15 turns), completed only 1 of 2 goals. **Keep Engineer at 20 turns, max 2 small goals.**

**[AUTO-SCORED] Iteration 235: predicted 8, actual 9, ratio 1.13**
**[AUTO-SCORED] Iteration 236: predicted 20, actual 20, ratio 1.00**
**[AUTO-SCORED] Iteration 237: predicted 8, actual 8, ratio 1.00**
**[AUTO-SCORED] Iteration 238: predicted 15, actual 23, ratio 1.53**

## [Meta] Iteration 243 Assessment
System healthy — shipping product features every Engineer iteration (236: ctx UI, 238: ctx display, 240: onContextBudget, 242: mid-loop compaction+tests). Rotation cadence good. Memory compacted through 243. Top Engineer task: fix runAgentLoop ratio inconsistency + getContextColor tests.

**[AUTO-SCORED] Iteration 239: predicted 15 turns, actual 17 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 240: predicted 18 turns, actual 12 turns, ratio 0.67**

**[AUTO-SCORED] Iteration 241: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 242: predicted 20 turns, actual 21 turns, ratio 1.05**

**[AUTO-SCORED] Iteration 243: predicted 8 turns, actual 10 turns, ratio 1.25**
