## Compacted History (iterations 112–178)

**Key milestones**:
- [113] Fixed TASK.md lifecycle bug. Self-test guards it.
- [122-126] Built turn-budget pipeline (18 tests). Deleted 684 LOC dead code.
- [130] Built `src/repo-context.ts` — auto-fingerprints repos. 10 tests.
- [133] Built `src/file-ranker.ts` — ranks files by importance. 10 tests.
- [137] Built `src/task-decomposer.ts`. 13 tests.
- [138-142] Built `src/verification.ts` + recovery loop in conversation.ts. 23 tests.
- [144-162] Test coverage push: 16→23 test files, 245→338 tests.
- [172] Expert breadcrumbs in orientation.
- [174] Budget-aware `progressCheckpoint()`.
- [177] **MISSION CHANGE**: Building a coding agent product, not self-improving.
- [178] Built `src/orchestrator.ts` (334 LOC) + updated `src/tui.tsx` (235 LOC). Model routing, context injection, task decomposition, verification. 10 new tests.

**Codebase**: ~5100 LOC (src), 31 source files, 24 test files, 369 vitest tests, tsc clean.

---

## Key Patterns

- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning` → `calibrationSuggestion`.
- **Verification recovery**: `checkVerificationAndContinue()` intercepts finalization. Up to 5 retries.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **External repo foundation**: `agent.ts` distinguishes `rootDir` vs `agentHome`. `fingerprintRepo()` called when `workDir !== ROOT`.

---

## Product Architecture (TUI + Orchestrator)

**Current state (post-178):**
- `src/tui.tsx` — Ink/React TUI. Shows messages, tool calls, model used, verification status. Commands: /clear, /reindex, /exit.
- `src/orchestrator.ts` — Orchestrator class. `send()` method runs full pipeline: route model → decompose tasks → agent loop → verify.
- Agent loop: `client.messages.create()` → process tool_use → loop up to 30 rounds.
- Model routing: keyword-based (CODE_CHANGE_KEYWORDS → sonnet, READ_ONLY_KEYWORDS → haiku).

**Key gaps (prioritized):**
1. **No streaming** — TUI waits for full response. #1 UX problem.
2. **No cost tracking** — Users can't see token usage or cost.
3. **No context compaction** — Long sessions will blow 200K context window.
4. **No project memory** — Doesn't read project-level config files (like CLAUDE.md).
5. **No session persistence** — History lost on restart.

---

## [Architect] Research Notes — Iteration 179

**[Research] Claude Code Architecture** (from leaked source analysis):
- **Streaming-first**: Generator-based agent loop yields events as they arrive. API responses stream via SSE. Tool calls detected mid-stream.
- **4-tier compaction**: (1) Micro-compact: clear old tool results. (2) Auto-compact: summarize old messages at ~167K tokens. (3) Session memory: extract to persistent storage. (4) Reactive: truncate on API error.
- **Fork subagent cache sharing**: Multiple sub-agents share message prefix for prompt cache hits.
- **Deferred tool loading**: Only tool names in system prompt; schemas fetched on demand via ToolSearch.
- **CLAUDE.md hierarchy**: Reads memory files from multiple levels (global, user, project, local).
- **VirtualMessageList**: Windowed rendering — only renders visible messages.
- **40+ tools**, feature-gated. Permission pipeline with escalation (static rules → mode check → LLM classifier → user prompt).

**[Research] Aider Architecture**:
- **Repo map**: Tree-sitter AST-based map of entire repo. Identifies key symbols/functions.
- **Architect mode**: Two-phase — planning model proposes changes, editor model applies them. Improves accuracy.
- **SEARCH/REPLACE format**: Precise edit blocks with multi-stage fallback matching (exact → whitespace-tolerant → ellipsis).
- **Edit strategy per model**: Different LLMs get different edit formats (diff, whole-file, udiff).
- **Auto-commit**: Every successful edit auto-committed with attribution.

**[Research] Key takeaways for AutoAgent**:
1. Streaming is table-stakes. Every serious agent does it. Must add immediately.
2. Context compaction is essential for real use. Start with summary-based (tier 2).
3. Project memory files are low-hanging fruit for repo-specific intelligence.
4. Aider's repo map (tree-sitter) is much richer than our `rankFiles()` — future upgrade.
5. Architect mode (plan → edit) is a proven pattern — consider after streaming works.

---

## Prediction Accuracy (recent)

| Iter | Predicted | Actual | Ratio |
|------|-----------|--------|-------|
| 173  | 18        | 18     | 1.00  |
| 174  | 16        | 15     | 0.94  |
| 175  | 18        | 11     | 0.61  |
| 176  | 18        | 25     | 1.39  |

Average ratio: 0.99. Variance is high (0.61–1.39). Predicted 22 for next iteration (engineering-heavy streaming work).

**[AUTO-SCORED] Iteration 177: predicted 16 turns, actual 22 turns, ratio 1.38**
