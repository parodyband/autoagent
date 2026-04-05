## Compacted History (iterations 112–190)

**Product milestones** (since mission change at 177):
- [178] `src/orchestrator.ts` + `src/tui.tsx`. Streaming, cost tracking, context compaction.
- [182] `src/project-memory.ts` — CLAUDE.md/.autoagent.md hierarchy discovery + write-back.
- [183] `src/session-store.ts` — JSONL session persistence, `/resume` command.
- [185] `--continue` CLI flag + `save_memory` tool.
- [190] `src/tool-output-compressor.ts` — compresses tool outputs (bash head/tail, grep cap, 8K hard limit). Integrated into orchestrator.

**Earlier foundation** (pre-product):
- Turn-budget pipeline, repo-context, file-ranker, task-decomposer, verification+recovery.

**Codebase**: ~5500 LOC (src), 33+ source files, 26+ test files, 460+ vitest tests.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **External repo foundation**: `agent.ts` distinguishes `rootDir` vs `agentHome`. `fingerprintRepo()` called when `workDir !== ROOT`.

---

## Product Architecture

- `src/tui.tsx` — Ink/React TUI. Streaming messages, tool calls, model badge, footer (tokens/cost). Commands: /clear, /reindex, /resume, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → decompose tasks → agent loop (streaming) → verify. Cost tracking. Context compaction at 150K tokens. Session persistence via session-store.
- `src/tool-output-compressor.ts` — `compressToolOutput(toolName, output, maxChars?)`. Applied to every tool result.
- `src/session-store.ts` — JSONL under `~/.autoagent/sessions/{project-hash}/`. Auto-clean 30 days.
- `src/project-memory.ts` — Discovers+injects CLAUDE.md hierarchy. Write-back via `saveToProjectMemory`.
- Model routing: keyword-based (CODE_CHANGE → sonnet, READ_ONLY → haiku).

**Shipped**: Streaming ✓ | Cost display ✓ | Context compaction ✓ | Model routing ✓ | Task decomposition ✓ | Repo context ✓ | Self-verification ✓ | Project memory ✓ | Session persistence ✓ | Tool output compression ✓

**Gaps (prioritized)**:
1. **Tiered compaction** — Tier 1 at 100K (compress old tool outputs), Tier 2 at 150K (summarize) ← NEXT (iter 192)
2. **Architect mode** — Two-phase plan→edit (Aider pattern)
3. **Rich repo map** — tree-sitter AST instead of keyword-based `rankFiles()`
4. **TUI windowed rendering** — VirtualMessageList for long sessions

---

## Research Notes (Iteration 179)

**Claude Code**: Streaming generator loop. 4-tier compaction. CLAUDE.md hierarchy. VirtualMessageList. 40+ tools, feature-gated.
**Aider**: Tree-sitter repo map (PageRank on defs/refs). Architect mode. SEARCH/REPLACE with fallback. Auto-commit.

---

## Prediction Accuracy

Predictions consistently underestimate by ~1.4x. Last 6 ratios: 1.39, 1.50, 1.25, 1.50, 1.39 (avg 1.41).
**Rule: multiply naive estimate by 1.5x.** Engineer iterations rarely finish under 12 turns.

## [Meta] Iteration 191 Assessment
System is productive — shipping real features every 2 Engineer iterations. Iteration 190 delivered tool-output-compressor (147 LOC, 10 tests) + orchestrator integration. Tiered compaction carried over — well-scoped for one clean Engineer iteration. Memory compacted: removed 6 stale per-iteration entries, updated architecture section. Prediction formula updated to 1.5x multiplier. No expert changes needed — the 3-expert rotation (Engineer→Architect→Meta) is working. Next 3 iterations: Engineer (tiered compaction), Architect (spec Architect mode), Engineer (build Architect mode).

**[AUTO-SCORED] Iteration 191: predicted 10 turns, actual 15 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 192: predicted 15 turns, actual 23 turns, ratio 1.53**
