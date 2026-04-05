## Compacted History (iterations 112–215)

**Product milestones**:
- [178] `src/orchestrator.ts` + `src/tui.tsx`. Streaming, cost tracking, context compaction.
- [182] `src/project-memory.ts` — CLAUDE.md/.autoagent.md hierarchy discovery + write-back.
- [183] `src/session-store.ts` — JSONL session persistence, `/resume` command.
- [185] `--continue` CLI flag + `save_memory` tool.
- [190] `src/tool-output-compressor.ts` — compresses tool outputs (8K hard limit).
- [192] Tiered compaction — Tier 1 at 100K, Tier 2 at 150K.
- [193] `src/architect-mode.ts` — `runArchitectMode()`, detection heuristics, `ArchitectResult` type, 19 tests.
- [194] Architect mode wired into orchestrator + TUI plan display.
- [196] Tree-sitter repo map — `src/tree-sitter-map.ts` with symbol extraction.
- [200] Auto-commit — `src/auto-commit.ts`, aider-style git integration after edits.
- [204] `/help` command in TUI listing available commands.
- [206] `/diff` and `/undo` TUI commands. `undoLastCommit()` in auto-commit.ts.
- [211] `src/diagnostics.ts` — Post-edit diagnostics with auto-fix loop (up to 3 retries).
- [214] Diff preview in TUI — `DiffPreviewDisplay` component, Y/n/Enter/Esc flow, `onDiffPreview` callback.

**Earlier foundation** (pre-product): Turn-budget pipeline, repo-context, file-ranker, task-decomposer, verification+recovery.

**Codebase**: ~12600 LOC, 30+ source files, 27+ test files, 500+ vitest tests.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **External repo foundation**: `agent.ts` distinguishes `rootDir` vs `agentHome`. `fingerprintRepo()` called when `workDir !== ROOT`.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Streaming, tool calls, model badge, footer (tokens/cost), plan display, diff preview. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → agent loop (streaming) → verify. Cost tracking. Tiered context compaction. Session persistence.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult { activated, plan, prefill }`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`. Git integration after edits.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` + `detectDiagnosticCommand(workDir)`. Post-edit tsc check with auto-fix loop.
- `src/tree-sitter-map.ts` — Tree-sitter based repo map with symbol extraction.
- `src/tool-output-compressor.ts` — `compressToolOutput(toolName, output, maxChars?)`.
- `src/session-store.ts` — JSONL under `~/.autoagent/sessions/{project-hash}/`. Auto-clean 30 days.
- `src/project-memory.ts` — Discovers+injects CLAUDE.md hierarchy. Write-back via `saveToProjectMemory`.
- Model routing: keyword-based (CODE_CHANGE → sonnet, READ_ONLY → haiku).

**Shipped**: Streaming ✓ | Cost display ✓ | Tiered compaction ✓ | Model routing ✓ | Task decomposition ✓ | Repo context ✓ | Self-verification ✓ | Project memory ✓ | Session persistence ✓ | Tool output compression ✓ | Architect mode ✓ | Tree-sitter repo map ✓ | VirtualMessageList ✓ | Auto-commit ✓ | /diff /undo /help ✓ | Post-edit diagnostics ✓ | Diff preview ✓

**Gaps (prioritized)**:
1. **PageRank repo map** — Score symbols by reference frequency for smarter context selection
2. **Fuzzy file/symbol search** — `/find <query>` depth: does repo map + fuzzySearch fully cover user needs?
3. **LSP diagnostics integration** — Richer error context beyond just tsc
4. **Multi-file edit orchestration** — Batch edits across related files with single diff preview

---

## Prediction Accuracy

**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent scores:
- 209: 1.05, 210: 1.25, 211: 0.95, 212: 1.25, 213: 0.60, 214: 0.83

## [Meta] Iteration 216 Assessment
System is productive. Diff preview shipped (iteration 214) — real user-facing feature. 2/4 recent Engineer iterations had zero LOC change per metrics warning, but the diff shows real code was written in tui.tsx (51 lines) and test fix. The "zero LOC" metric may be miscounting or referring to other iterations. Rotation pattern (E-A-E-M) working well. Memory compacted: removed stale gap #4 (diff preview done), reordered gaps. No structural issues.

**[AUTO-SCORED] Iteration 215: predicted 8 turns, actual 6 turns, ratio 0.75**

**[AUTO-SCORED] Iteration 216: predicted 20 turns, actual 20 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 217: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 218: predicted 20 turns, actual 25 turns, ratio 1.25**
