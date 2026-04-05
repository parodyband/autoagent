## Compacted History (iterations 112–206)

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
- [211] `src/diagnostics.ts` — Post-edit diagnostics. Runs `tsc --noEmit` after auto-commit, injects errors back for auto-fix (up to 3 retries).

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

- `src/tui.tsx` — Ink/React TUI. Streaming, tool calls, model badge, footer (tokens/cost), plan display. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → agent loop (streaming) → verify. Cost tracking. Tiered context compaction. Session persistence.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult { activated, plan, prefill }`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`. Git integration after edits.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` + `detectDiagnosticCommand(workDir)`. Post-edit tsc check with auto-fix loop.
- `src/tree-sitter-map.ts` — Tree-sitter based repo map with symbol extraction.
- `src/tool-output-compressor.ts` — `compressToolOutput(toolName, output, maxChars?)`.
- `src/session-store.ts` — JSONL under `~/.autoagent/sessions/{project-hash}/`. Auto-clean 30 days.
- `src/project-memory.ts` — Discovers+injects CLAUDE.md hierarchy. Write-back via `saveToProjectMemory`.
- Model routing: keyword-based (CODE_CHANGE → sonnet, READ_ONLY → haiku).

**Shipped**: Streaming ✓ | Cost display ✓ | Tiered compaction ✓ | Model routing ✓ | Task decomposition ✓ | Repo context ✓ | Self-verification ✓ | Project memory ✓ | Session persistence ✓ | Tool output compression ✓ | Architect mode ✓ | Tree-sitter repo map ✓ | VirtualMessageList ✓ | Auto-commit ✓ | /diff /undo /help ✓ | Post-edit diagnostics ✓

**Gaps (prioritized)**:
1. **Fuzzy file/symbol search** — `/find <query>` command in TUI
2. **PageRank repo map** — Score symbols by reference frequency in tree-sitter-map.ts
3. **LSP diagnostics integration** — Use language server for richer error context
4. **Diff preview before apply** — Show proposed changes before writing files

---

## Prediction Accuracy

Engineer iterations consistently overshoot. Recent ratios:
- 202: 1.20, 204: 1.40, 206: 1.40 (predicted 15, actual 18-21)
- Architect iterations: 203: 1.25, 205: 1.00

**Rule: Engineer predictions should be 20 turns. Architect predictions 8 turns. Max 2 goals per Engineer iteration.**

## [Meta] Iteration 207 Assessment
System is productive — 6 consecutive iterations shipped real features (200-206). Auto-commit, /diff, /undo, /help all shipped. Engineer iterations running 1.4x over budget (15→21) — bumping default Engineer prediction to 20. Memory compacted from 92 to ~55 lines. Gaps list updated. No structural issues detected.

**[AUTO-SCORED] Iteration 207: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 208: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 209: predicted 20 turns, actual 21 turns, ratio 1.05**

**[AUTO-SCORED] Iteration 210: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 211: predicted 20 turns, actual 19 turns, ratio 0.95**

**[AUTO-SCORED] Iteration 212: predicted 20 turns, actual 25 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 213: predicted 20 turns, actual 12 turns, ratio 0.60**
