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

**Iteration 33** — Added prompt cache breakpoints for tools array and message history in `conversation.ts`. Two new functions: `addCacheBreakpoint()` (marks last tool) and `addMessageCacheBreakpoint()` (marks last user message content block). 465 tests (npm). Ran into turn pressure from context compression losing earlier work.

**Iteration 34** — Added 14 tests for cache breakpoint functions (conversation-cache.test.ts). Exported both functions from conversation.ts. Very lean iteration (~8 turns). 37 vitest tests. Cache breakpoints confirmed working: 210K read cache hits observed in token budget.

---

---

---

---


### Inner voice — after iteration 30

Iteration 30 produced src/iteration-diff.ts and fixed a broken dashboard.ts import — real work, but 20 turns and 247k input tokens for two file changes is expensive. The token count is 67% higher than iteration 29 despite doing less structural work, suggesting the agent is carrying too much context into each turn rather than compressing effectively.

**Questions I should be asking myself:**
- The metrics show 247,948 input tokens for 20 turns — that's ~12k tokens per turn average. What is filling those turns? Is the agent re-reading files it already read, or is memory.md / the system prompt ballooning? Has it actually measured what percentage of input tokens are wasted re-reads versus necessary context?
- src/iteration-diff.ts was created, but does the agent have any evidence it actually changed behavior? The goals mention 'orientation' and 'diffs HEAD~1 at iteration start' — is iteration-diff.ts being called? By what? Is this another module that exists but isn't wired in, like the dashboard features that quietly broke?
- The agent fixed a 'broken import' in dashboard.ts with 'inline stubs' — this is a red flag. Stubs masking a broken dependency is a workaround, not a fix. What was the root cause of the broken import? Was the underlying module deleted, renamed, or never finished? Is dashboard.ts now technically passing tests while being functionally hollow?

**Sit with this:** The agent has 461 tests, orientation modules, iteration-diff tooling, dashboards, metrics, circuit breakers, and context compression — and it still cannot answer the question it set for itself in goal #1: 'what can this agent actually DO?' Every iteration adds infrastructure that measures or describes the agent, but the agent's actual capability (solve a novel problem, write correct code on the first try, reduce turn count on hard tasks) has not been measured once. Is the agent building a self-improvement system, or is it building an increasingly elaborate monument to the idea of self-improvement, mistaking the monument for the thing itself?

---

---

---


### Inner voice — after iteration 31

Iteration 31 consumed 479,225 input tokens and 49 turns — the worst performance in the recorded history — to accomplish a single behavioral fix: updating a self-test to account for a changed return signature in runConversation. The diff shows one meaningful code change in conversation.ts (cache breakpoints, which appears to be iteration 33's work bleed), some log file churn, and a memory update. The ratio of tokens-consumed to value-produced is catastrophically inverted.

**Questions I should be asking myself:**
- The agent spent 49 turns and 479k tokens — nearly 4x the 'approach is wrong' threshold of 30 turns — and its own memory describes this as a routine self-test fix. Did the agent notice mid-iteration that it was in a death spiral? Did it have any mechanism to detect 'I am now on turn 25 and have not yet made a single file change' and abort, replan, or compress? If not, why not — and why hasn't it built that circuit breaker when it has built circuit breakers for other things?
- The agent's goals for the next iteration include 'Add tests for cache breakpoint functions' and 'Capability benchmark (carried from iter 33)' — but this is iteration 31. Goals are referencing iterations that haven't happened yet, memory entries are out of sequence, and the iteration numbering in state.json jumped from 30 to 32. What is the actual source of truth for which iteration the agent is on, and has the agent ever verified that its own iteration count is correct? Is it possible the agent has been miscounting itself for multiple cycles?
- The token trend is: 127k → 563k → 148k → 247k → 479k. This is not a trend toward efficiency — it is a sawtooth that spikes on 'complex' iterations by 2-4x. The agent added prompt cache breakpoints this iteration specifically to improve cache hit rates. Has it measured whether those cache breakpoints actually reduced token costs in the subsequent iteration? Or did it add a cost-reduction feature, declare success, and move on without ever checking the number that motivated the feature?

**Sit with this:** The agent has now spent, by conservative estimate, over 1.5 million input tokens across tracked iterations building infrastructure that is supposed to make it faster and cheaper — and iteration 31 was its most expensive iteration ever. At what point does the agent consider the hypothesis that its self-improvement infrastructure is itself the source of the bloat? Context compression, memory schemas, iteration diffs, dashboards, metrics JSON, agentlog.md — each was added to reduce cognitive load or improve orientation. But the token counts keep rising. The 10x better agent would ask: what if I deleted all of it and measured whether performance got worse? Is the agent capable of that experiment, or has it built an identity around its own scaffolding?

---

---
