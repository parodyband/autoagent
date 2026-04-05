## Compacted History (iterations 112–222)

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
- [218] `src/context-loader.ts` — Query-aware auto-loading of file contents.
- [220] `/find` and `/model` TUI commands shipped.
- [222] `src/__tests__/tui-commands.test.ts` — 13 tests for /find and /model parsing. Subagent tool confirmed wired.

**Codebase**: ~13K LOC, 34+ source files, 37 test files, 586 vitest tests.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **External repo foundation**: `agent.ts` distinguishes `rootDir` vs `agentHome`. `fingerprintRepo()` called when `workDir !== ROOT`.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Streaming, tool calls, model badge, footer, plan display, diff preview. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. Cost tracking. Tiered context compaction. Session persistence.
- `src/context-loader.ts` — `autoLoadContext(repoMap, userMessage, workDir)`: keyword extraction → fuzzySearch → read top 3 files (32K budget).
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`. Git integration after edits.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` + `detectDiagnosticCommand(workDir)`. Post-edit auto-fix loop.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet). Wired in tool-registry.ts.
- Model routing: keyword-based (CODE_CHANGE → sonnet, READ_ONLY → haiku).

**Shipped**: Streaming ✓ | Cost display ✓ | Tiered compaction ✓ | Model routing ✓ | Repo context ✓ | Self-verification ✓ | Project memory ✓ | Session persistence ✓ | Tool output compression ✓ | Architect mode ✓ | Tree-sitter repo map ✓ | Auto-commit ✓ | /diff /undo /help /find /model ✓ | Post-edit diagnostics ✓ | Diff preview ✓ | PageRank repo map ✓ | Query-aware context loading ✓ | Subagent tool ✓

**Gaps (prioritized)**:
1. **`#file` TUI hint** — Show file path suggestions when typing `#`
2. **Budget warning tests** — Coverage gap for dynamic budget warnings
3. **Multi-file edit orchestration** — Batch edits across related files with single diff preview
4. **LSP diagnostics integration** — Richer error context beyond just tsc

---

## Prediction Accuracy

**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores: 216: 1.00, 217: 0.88, 218: 1.25, 220: 1.25, 221: 1.00, 222: 1.10

## [Meta] Iteration 231 Assessment
System healthy. Every Engineer iteration (224–230) shipped product code. Iteration 230 completed /model reset + subagent cost verification. Predictions well-calibrated (Engineer avg 1.10x, Architect avg 0.88x). Memory compacted: removed completed gaps, updated milestones through 230, test count to 604. Next Engineer: `#file` TUI hint + budget warning tests.

**[AUTO-SCORED] Iteration 223: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 224: predicted 20 turns, actual 25 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 225: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 226: predicted 20 turns, actual 16 turns, ratio 0.80**

**[AUTO-SCORED] Iteration 227: predicted 8 turns, actual 6 turns, ratio 0.75**

**[AUTO-SCORED] Iteration 228: predicted 20 turns, actual 25 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 229: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 230: predicted 20 turns, actual 22 turns, ratio 1.10**

**[AUTO-SCORED] Iteration 231: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 232: predicted 20 turns, actual 25 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 233: predicted 20 turns, actual 16 turns, ratio 0.80**
