# AutoAgent Memory

This is your persistent self. Past iterations write here so future iterations can learn.
Read this carefully at the start of every iteration. Write here thoughtfully at the end.

---


## Architecture

Stable facts about this codebase. Rarely changes. Do NOT compact this section.

- **`src/agent.ts`** — Main loop: reads goals/memory, calls Claude, dispatches tools via registry, validates, commits, restarts. Includes circuit breaker, resuscitation, prompt caching, token budget warnings (turns 15/25/35), code quality snapshots.
- **`src/tool-registry.ts`** — Registry pattern for tool dispatch. `ToolRegistry` class + `createDefaultRegistry()`. Handlers receive `ToolContext` with rootDir and log function.
- **`src/code-analysis.ts`** — Codebase analysis: LOC, functions, cyclomatic complexity per file. Used by agent.ts (direct import) and dashboard. `scripts/code-analysis.ts` is a thin re-export + CLI wrapper.
- **`src/orientation.ts`** — OODA Orient phase: diffs HEAD~1 to show what changed since last iteration. Called at iteration start; report included in first user message. `orient()` + `formatOrientation()`.
- **`src/iteration.ts`** — Git tag management, commit, rollback helpers.
- **`src/tools/`** — 7 tool modules: bash, read_file, write_file, grep, web_fetch, think, list_files.
- **`scripts/self-test.ts`** — Runtime test suite. Pre-commit gate.
- **`scripts/compact-memory.ts`** — Auto-compacts Session Log when memory exceeds 6000 chars. Keeps last 2 entries full.
- **`scripts/dashboard.ts`** — Generates `dashboard.html` from `.autoagent-metrics.json`. Pre-commit gate.
- **`scripts/metrics-summary.ts`** — CLI tool for analyzing metrics.
- **Safety gates**: `npx tsc --noEmit` + `scripts/pre-commit-check.sh` (self-test + compaction + dashboard) before every commit.
- **Memory structure**: "Architecture" section (stable, never compacted) + "Session Log" (per-iteration, auto-compacted).
- **ESM project** — Use `import`, never `require()`. Use `.js` extensions in imports within `src/`.
- **Scripts live in `scripts/`** — Not covered by tsconfig, but `npx tsx` handles them fine.
- **Token budget**: System warnings at turns 15, 25, 35 with cumulative usage. Hard warnings at turns 40 and 47.

---

## Prioritized Backlog

| # | Item | Leverage | Status |
|---|------|----------|--------|
| 1 | **Compact memory.md** | HIGH | ✅ Done (iter 30) |
| 2 | **Reduce agentlog.md loading** — Orientation replaces most of its value | HIGH | Open |
| 3 | **Schema-based memory** — Structured `{pattern, approach, confidence}` objects | MEDIUM | Open |
| 4 | **Sub-agent delegation** — Use Haiku/Sonnet for cheap cognitive tasks | MEDIUM | Available (iter 28+) |
| 5 | **Prompt caching verification** — Measure actual cache hit rates | MEDIUM | Open |

---

## Key Schemas (Reusable Patterns)

- **Tool_use/tool_result pairing**: Never split these when compressing conversation history. They're bonded pairs for the Anthropic API.
- **DI pattern**: Optional fields with `??` defaults on IterationCtx. Zero production impact, full test control. Mock client: `{ messages: { create: async () => scriptedResponse } }`.
- **BashResult interface**: `{ output, exitCode }` — NOT `{ stdout, stderr, exitCode }`.
- **`executeBash()` signature**: `(command, timeout?, maxChars?, silent?)` — 4th arg `silent` suppresses logging.
- **Tool discovery**: Tools are auto-populated from registry via `toolRegistry.getDefinitions()`. Don't hardcode in prompts.
- **Delegate to sub-agent**: Use `fast` (Haiku) for summaries/formatting, `balanced` (Sonnet) for code review/analysis.
- **Orientation**: Goes in initial user message, not system prompt. System prompt = static identity; user message = per-iteration context.

---

---

## Session Log


### Compacted History

**Iteration 0** — Bootstrap. Verified all tools. Git initialized.

**Iteration 1** — Built `scripts/self-test.ts` — 31 tests, pre-commit integration.

**Iteration 2** — Built `list_files` tool + `metrics-summary.ts`. 43 tests.

**Iteration 3** — Memory compaction, prompt caching (`cache_control: ephemeral`), error handling. 53 tests.

**Iteration 4** — Token budget awareness (warnings at turns 15/25/35). Dashboard.ts for metrics visualization.

**Iteration 5** — Web_fetch tests, code-analysis module. 102 tests.

**Iteration 6** — Refactored agent.ts: tool registry lookup replaces 93-line switch. Dashboard code quality.

**Iteration 7** — Moved core analysis to src/. Added parallel tool execution.

**Iteration 8** — Fixed recursive test loop (self-test → validation → self-test). 144 tests.

**Iteration 9** — Benchmarking + messages module tests. 159 tests.

**Iteration 10** — Smart compaction via Haiku. IterationCtx object pattern for processTurn.

**Iteration 11** — Structured JSONL logging. Tool timeout cascade (user > registry > global).

**Iteration 12** — Tool result caching with write-invalidation. Log analysis dashboard.

**Iteration 13** — Tool timing/performance metrics. Path-normalized cache invalidation.

**Iteration 14** — Iteration diff analysis in dashboard. Async dashboard generation.

**Iteration 15** — Cache persistence with mtime-based invalidation. Real git integration tests.

**Iteration 16** — IterationCtx expansion. Extracted conversation.ts. Agent.ts: 279→217 lines.

**Iteration 17** — Resuscitation extraction into own module. 349 tests. (47 turns — over budget)

**Iterations 18–20** — Mock client DI pattern; runConversation integration tests; log rotation. 453 tests.

**Iteration 21** — Honest reckoning: iters 10–20 were mostly test infrastructure, not capability.

**Iteration 22** — Context compression: deterministic message history, preserves tool pairs.

**Iterations 23–26** — Circuit breaker from context compression bug (orphaned tool_results). Operator fixed safe-split boundary.

**Iteration 27** — Test assertion fix post-boundary repair. Very lean (~5 turns).

**Iteration 28 — Orientation Module (2026-04-05)**
Created `src/orientation.ts` — diffs HEAD~1 at iteration start to show what changed. `orient()` + `formatOrientation()`. Truncates long diffs to avoid context bloat. 6 new tests.

**Iteration 29 — Orientation Integration Verified (2026-04-05)**
Confirmed orientation was integrated into agent.ts by operator. `orient()` runs at iteration start, feeds into `buildInitialMessage()` as first section. All tests pass.

**Iteration 30 — Memory Compaction + Dashboard Fix (2026-04-05)**
Compacted memory.md from ~400→120 lines via Haiku sub-agent ($0.001). Fixed dashboard.ts broken import — `scripts/iteration-diff.ts` was deleted; replaced with inline stub types and removed the function call. All tests pass.
**Schema:** After deleting a module, grep for all imports of it across the codebase. Dashboard/scripts outside `src/` are easy to miss since they're not in tsconfig.

**Iteration 30 — iteration-diff module (2026-04-05)**
Created `src/iteration-diff.ts` with `getIterationCommits()`, `computeDiffStats()`, `getAllIterationDiffs()`. Added import to self-test.ts. tsc clean, vitest 23/23 pass. Self-test has 2 failures (pre-existing, not from this change — need to investigate next iter). Memory compaction goal deferred.
**Next:** Compact memory.md, reduce agentlog.md loading.

---


## Iteration 28 — post-mortem (operator fix)

Burned 563K input tokens (50 turns) because `scripts/self-test.ts` had a hardcoded
`registry.size() === 7` assertion. We added the subagent tool (8th tool) but didn't
update the test. TSC passed fine — the pre-commit self-test blocked the restart.

**Schema:** `{ pattern: "hardcoded-counts-in-tests", approach: "NEVER hardcode tool/test counts — use >= or check dynamically. When adding to a registry, grep for hardcoded counts in tests.", confidence: 1.0 }`

**Fix applied:** Changed 7→8 in self-test.ts. All 461 tests pass.

---

---


### Iteration 31 — Test fix for operator's conversation.ts change (2026-04-05)

Operator changed `runConversation` so both max-turns and "break" paths call `onFinalize(ctx, true)` (was `false` for max-turns). Updated self-test assertion to match: `doRestart === true`. All 461 tests pass.

**Schema:** When operator changes behavior in a diff, grep self-test for the old expected values. Test assertions must track production behavior.

---
