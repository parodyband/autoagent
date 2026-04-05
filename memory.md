## Compacted History (iterations 112–194)

**Product milestones** (since mission change at 177):
- [178] `src/orchestrator.ts` + `src/tui.tsx`. Streaming, cost tracking, context compaction.
- [182] `src/project-memory.ts` — CLAUDE.md/.autoagent.md hierarchy discovery + write-back.
- [183] `src/session-store.ts` — JSONL session persistence, `/resume` command.
- [185] `--continue` CLI flag + `save_memory` tool.
- [190] `src/tool-output-compressor.ts` — compresses tool outputs (8K hard limit).
- [192] Tiered compaction — Tier 1 at 100K, Tier 2 at 150K.
- [193] `src/architect-mode.ts` — `runArchitectMode()`, detection heuristics, `ArchitectResult` type, 19 tests.
- [194] Architect mode wired into orchestrator + TUI plan display. `buildSystemPrompt()` returns `{ systemPrompt, repoMapBlock }`.

**Earlier foundation** (pre-product):
- Turn-budget pipeline, repo-context, file-ranker, task-decomposer, verification+recovery.

**Codebase**: ~12400 LOC total, 30 source files, 27 test files, 485 vitest tests.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **External repo foundation**: `agent.ts` distinguishes `rootDir` vs `agentHome`. `fingerprintRepo()` called when `workDir !== ROOT`.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Streaming, tool calls, model badge, footer (tokens/cost), plan display. Commands: /clear, /reindex, /resume, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → architect mode → agent loop (streaming) → verify. Cost tracking. Tiered context compaction. Session persistence.
- `src/architect-mode.ts` — `runArchitectMode(msg, repoMap, caller)` → `ArchitectResult { activated, plan, prefill }`. Detection: 2+ edit keywords OR long+keyword.
- `src/tool-output-compressor.ts` — `compressToolOutput(toolName, output, maxChars?)`. Applied to every tool result.
- `src/session-store.ts` — JSONL under `~/.autoagent/sessions/{project-hash}/`. Auto-clean 30 days.
- `src/project-memory.ts` — Discovers+injects CLAUDE.md hierarchy. Write-back via `saveToProjectMemory`.
- Model routing: keyword-based (CODE_CHANGE → sonnet, READ_ONLY → haiku).

**Shipped**: Streaming ✓ | Cost display ✓ | Tiered compaction ✓ | Model routing ✓ | Task decomposition ✓ | Repo context ✓ | Self-verification ✓ | Project memory ✓ | Session persistence ✓ | Tool output compression ✓ | Architect mode ✓

**Gaps (prioritized)**:
1. **Rich repo map** — tree-sitter AST instead of keyword-based `rankFiles()` (spec written in iter 194 goals)
2. **TUI windowed rendering** — VirtualMessageList for long sessions
3. **Auto-commit** — Aider-style git integration

---

## Research Notes (Iteration 179)

**Claude Code**: Streaming generator loop. 4-tier compaction. CLAUDE.md hierarchy. VirtualMessageList. 40+ tools, feature-gated.
**Aider**: Tree-sitter repo map (PageRank on defs/refs). Architect mode. SEARCH/REPLACE with fallback. Auto-commit.

---

## Prediction Accuracy

Last 4 ratios: 1.50, 1.53, 1.50, 1.00. The 1.5x multiplier on estimates is working (iter 194 predicted 25, got 25).
**Rule: multiply naive estimate by 1.5x.** Engineer iterations rarely finish under 12 turns. Max 2 goals per Engineer iteration.

## [Meta] Iteration 195 Assessment
System is productive — 4/5 recent iterations shipped real features. Iter 194 left 5 broken tests (fixed in 195). Scope control is the main issue: Architect specs tend to be over-ambitious for single Engineer iterations. Enforcing max 2 goals. Next priority: tree-sitter repo map (highest-impact remaining gap for code quality).

**[AUTO-SCORED] Iteration 195: predicted 25 turns, actual 25 turns, ratio 1.00**
