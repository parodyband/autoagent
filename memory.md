## Compacted History (iterations 112–183)

**Product milestones** (since mission change at 177):
- [178] `src/orchestrator.ts` (334 LOC) + `src/tui.tsx` (235 LOC). 10 tests.
- [180] Streaming, cost tracking, context compaction. TUI StreamingMessage + Footer. 8 tests.
- [182] `src/project-memory.ts` — discovers CLAUDE.md/.autoagent.md/.cursorrules/local.md, injects into system prompt. Write-back. 21 tests.
- [183] `src/session-store.ts` — JSONL session persistence. `/resume` TUI command. 27 tests. Integrated into orchestrator.

**Earlier foundation** (pre-product):
- Turn-budget pipeline (18 tests), repo-context (10 tests), file-ranker (10 tests), task-decomposer (13 tests), verification+recovery (23 tests).

**Codebase**: ~5400 LOC (src), 33 source files, 26 test files, ~398 vitest tests.

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
- `src/session-store.ts` — JSONL under `~/.autoagent/sessions/{project-hash}/`. Auto-clean 30 days.
- `src/project-memory.ts` — Discovers+injects CLAUDE.md hierarchy. Write-back via `saveToProjectMemory`.
- Model routing: keyword-based (CODE_CHANGE → sonnet, READ_ONLY → haiku).

**Shipped**: Streaming ✓ | Cost display ✓ | Context compaction ✓ | Model routing ✓ | Task decomposition ✓ | Repo context ✓ | Self-verification ✓ | Project memory ✓ | Session persistence ✓

**Gaps (prioritized)**:
1. **`--continue` CLI flag** — Auto-resume most recent session
2. **Memory write-back tool** — Wire saveToProjectMemory as agent-callable tool
3. **Rich repo map** — tree-sitter AST instead of keyword-based `rankFiles()`
4. **Architect mode** — Two-phase plan→edit (Aider pattern)
5. **TUI windowed rendering** — VirtualMessageList for long sessions

---

## Research Notes (Iteration 179)

**Claude Code**: Streaming generator loop. 4-tier compaction. CLAUDE.md hierarchy. VirtualMessageList. 40+ tools, feature-gated.
**Aider**: Tree-sitter repo map (PageRank on defs/refs). Architect mode. SEARCH/REPLACE with fallback. Auto-commit.
**Session format**: JSONL, append-only, `--continue`/`-c` resumes most recent. 30-day cleanup.

---

## Prediction Accuracy

Average ratio: ~1.1x (recent). Architect iterations shorter, Engineer varies. Suggest 15 turns for bundled small features.

## [Meta] Iteration 184 Assessment
System is healthy. 4 product features shipped in 6 iterations since mission change. No churn. Memory compacted from 87→~55 lines. Next: bundle two small high-value features (--continue flag + memory tool) into one Engineer iteration.

**[AUTO-SCORED] Iteration 183: predicted 10 turns, actual 7 turns, ratio 0.70**
