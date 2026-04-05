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
- **`src/iteration-diff.ts`** — `getIterationCommits()`, `computeDiffStats()`, `getAllIterationDiffs()` for dashboard iteration analysis.
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
- **agentlog.md** — Write-only log file (fallback before logger init + fatal handler). Never loaded into agent context. Only goals.md and memory.md are read into conversation.

---

## Prioritized Backlog

| # | Item | Leverage | Status |
|---|------|----------|--------|
| 1 | **Capability benchmark** — Measure what agent can actually DO, not just test counts | HIGH | Open |
| 2 | **Schema-based memory** — Structured `{pattern, approach, confidence}` objects | MEDIUM | Open |
| 3 | **Sub-agent delegation** — Use Haiku/Sonnet for cheap cognitive tasks | MEDIUM | Available (iter 28+) |
| 4 | **Prompt caching verification** — Measure actual cache hit rates | MEDIUM | Open |

---

## Key Schemas (Reusable Patterns)

- **Tool_use/tool_result pairing**: Never split these when compressing conversation history. They're bonded pairs for the Anthropic API.
- **DI pattern**: Optional fields with `??` defaults on IterationCtx. Zero production impact, full test control. Mock client: `{ messages: { create: async () => scriptedResponse } }`.
- **BashResult interface**: `{ output, exitCode }` — NOT `{ stdout, stderr, exitCode }`.
- **`executeBash()` signature**: `(command, timeout?, maxChars?, silent?)` — 4th arg `silent` suppresses logging.
- **Tool discovery**: Tools are auto-populated from registry via `toolRegistry.getDefinitions()`. Don't hardcode in prompts.
- **Delegate to sub-agent**: Use `fast` (Haiku) for summaries/formatting, `balanced` (Sonnet) for code review/analysis.
- **Orientation**: Goes in initial user message, not system prompt. System prompt = static identity; user message = per-iteration context.
- **Hardcoded counts in tests**: NEVER hardcode tool/test counts — use >= or check dynamically. When adding to a registry, grep for hardcoded counts in tests. (confidence: 1.0)
- **Deleted module cleanup**: After deleting a module, grep all imports across codebase. Scripts outside `src/` are easy to miss since they're not in tsconfig. (confidence: 1.0)
- **Operator behavior changes**: When operator changes behavior in a diff, grep self-test for old expected values. Test assertions must track production behavior. (confidence: 1.0)

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

**Iteration 28** — Created `src/orientation.ts` (diffs HEAD~1 at iteration start). Fixed hardcoded registry.size()===7 test assertion (now >=8).

**Iteration 29** — Confirmed orientation integrated into agent.ts by operator. All tests pass.

**Iteration 30** — Created `src/iteration-diff.ts`. Fixed dashboard.ts broken import (inline stubs). 461 tests.

**Iteration 31** — Updated self-test for runConversation behavior change (onFinalize always called with true). 461 tests.

**Iteration 32** — Memory compaction: merged duplicate iter 30 entries, folded standalone post-mortems into schemas, removed inner voice section. Confirmed agentlog.md is write-only (never loaded into context).

---

---
