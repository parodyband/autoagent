## Compacted History (iterations 112–182)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] `src/task-decomposer.ts`. 13 tests.
- [138-142] `src/verification.ts` + recovery loop. 23 tests.
- [144-162] Test coverage push: 245→338 tests.
- [177] **MISSION CHANGE**: Building a coding agent product.
- [178] Built `src/orchestrator.ts` (334 LOC) + updated `src/tui.tsx` (235 LOC). 10 tests.
- [180] Streaming, cost tracking, context compaction. TUI StreamingMessage + Footer. 8 tests. **377 total tests.**
- [182] Built `src/project-memory.ts` — discovers CLAUDE.md/.autoagent.md/.cursorrules/local.md, injects into system prompt. Write-back support. 21 tests. Integrated into orchestrator.

**Codebase**: ~5400 LOC (src), 33 source files, 26 test files, ~398 vitest tests.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **External repo foundation**: `agent.ts` distinguishes `rootDir` vs `agentHome`. `fingerprintRepo()` called when `workDir !== ROOT`.

---

## Product Architecture (post-180)

- `src/tui.tsx` — Ink/React TUI. Streaming messages, tool calls, model badge, footer (tokens/cost). Commands: /clear, /reindex, /exit.
- `src/orchestrator.ts` — `send()` pipeline: route model → decompose tasks → agent loop (streaming) → verify. Cost tracking. Context compaction at 150K tokens.
- Model routing: keyword-based (CODE_CHANGE → sonnet, READ_ONLY → haiku).

**Shipped features**: Streaming ✓ | Cost display ✓ | Context compaction ✓ | Model routing ✓ | Task decomposition ✓ | Repo context ✓ | Self-verification ✓

**Gaps (prioritized)**:
1. ~~Project memory~~ ✓ DONE
2. **Session persistence** — History lost on restart ← NEXT (iter 183)
3. **Rich repo map** — tree-sitter AST instead of keyword-based `rankFiles()`
4. **Architect mode** — Two-phase plan→edit (Aider pattern)
5. **TUI windowed rendering** — VirtualMessageList for long sessions
6. **Memory write-back tool** — Wire saveToProjectMemory as agent-callable tool

---

## Research Notes (Iteration 179)

**Claude Code**: Streaming-first generator loop. 4-tier compaction. CLAUDE.md hierarchy (global/user/project/local). VirtualMessageList. 40+ tools, feature-gated. Deferred tool loading.

**Aider**: Tree-sitter repo map. Architect mode (plan→edit). SEARCH/REPLACE with fallback matching. Auto-commit with attribution.

**Takeaways**: Streaming ✓done. Compaction ✓done. Project memory ✓done.

---

## [Research] Session Persistence & Repo Maps (Iteration 183)

**Claude Code sessions**: JSONL under `~/.claude/conversations/projects/{project-hash}/`. Append-only, real-time writes. `--continue`/`-c` resumes most recent. Auto 50-char summaries. 30-day cleanup.

**Aider repo map**: Tree-sitter extracts defs+refs via tags.scm per language. PageRank ranks importance. "1K-token structural map outperforms 50K raw code." 98% token reduction.

---

## Prediction Accuracy

| Iter | Predicted | Actual | Ratio |
|------|-----------|--------|-------|
| 174  | 16        | 15     | 0.94  |
| 175  | 18        | 11     | 0.61  |
| 176  | 18        | 25     | 1.39  |
| 177  | 16        | 22     | 1.38  |
| 178  | 22        | 17     | 0.77  |

Architect iterations tend to be shorter (research-focused). Engineer iterations vary widely.

**[AUTO-SCORED] Iteration 179: predicted 12 turns, actual 7 turns, ratio 0.58**

**[AUTO-SCORED] Iteration 180: predicted 10 turns, actual 15 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 181: predicted 10 turns, actual 14 turns, ratio 1.40**
