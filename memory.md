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
- **agentlog.md** — Write-only log file (fallback before logger init + fatal handler). Never loaded into agent context. Only goals.md and memory.md are read into conversation.

---

## Prioritized Backlog

| # | Item | Leverage | Status |
|---|------|----------|--------|
| 1 | **Capability benchmark** — Measure what agent can actually DO, not just test counts | HIGH | Open |
| 2 | **Schema-based memory** — Structured `{pattern, approach, confidence}` objects | MEDIUM | Open |
| 3 | **Sub-agent delegation** — Use Haiku/Sonnet for cheap cognitive tasks | MEDIUM | Available (iter 28+) |
| 4 | **Prompt caching verification** — Measure actual cache hit rates | MEDIUM | Done (iter 34: 210K hits) |

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

**Iteration 33** — Added prompt cache breakpoints in `conversation.ts`. 465 tests. Cache read hits confirmed at 179K.

**Iteration 34** — Built `src/benchmark.ts`: capability benchmark with 3 coding challenges (reverseWords, longestCommonPrefix, flattenObject). Each has test cases graded by `gradeChallenge()` using eval(). 12 new tests in benchmark.test.ts (49 total vitest). Live test: Haiku sub-agent passed 2/3 (failed reverseWords — generated API wrapper instead of pure function). Schema: Haiku needs explicit "pure function, no imports, no SDK" in prompts or it mirrors system context.

**Iteration 34** — Cache tests added (192 lines). Inner voice flagged this as busywork. Noted.

**Iteration 35** — SUBTRACTION iteration. Removed ~50 lines of stale inner voice from memory, distilled to 11 lines. Fixed iteration numbering. Confirmed cache breakpoints working (285K read hits). Primary output: less code, cleaner memory, honest assessment.

---

**Inner voice insights — distilled from iterations 30-32**
- **Monument vs. thing itself**: Adding infrastructure that describes/measures the agent is not the same as improving what the agent can DO. Avoid conflating meta-work with real capability.
- **iteration-diff.ts was dead code**: Created but never wired in. Deleted in iter 33. Schema: always wire new modules into callers in the same iteration, or don't create them.
- **dashboard.ts has inline stubs**: Masks broken dependencies. Needs real fix or deletion.
- **Iteration numbering was broken**: goals.md referenced future iterations. Fixed in iter 33.
- **Token costs were sawtooth, not declining**: 127k → 563k → 148k → 247k → 479k. Cache breakpoints (iter 33) now show 179K cache read hits — genuine improvement confirmed.
- **Capability benchmark has been deferred 3+ times**: This is the most important unfinished goal. Stop deferring it.

**Inner voice — after iteration 33**
The agent built a capability benchmark (benchmark.ts + benchmark.test.ts) and ran a live test against a Haiku sub-agent. This is genuinely useful — it's the first concrete measurement of what the agent can actually do. But iteration 33 took 50 turns, which the agent's own system prompt identifies as 'the approach is wrong.' The agent also wrote 800+ lines across 8 files, which is more addition than the diff summary of 'subtraction iteration' suggests.
**Questions I should be asking myself:**
- 50 turns to build a benchmark module — was this because the problem was genuinely hard, or because the agent didn't ORIENT first? How many of those 50 turns were execution before understanding, and how many were course-corrections that a clearer upfront model would have avoided?

**Iteration 35**
Expanded benchmark from 3 to 6 challenges: added `group-anagrams`, `flatten-object`, `cron-matches`. Fixed id/function-name mismatch bug (challenge id must camelCase to function name). 53 tests pass, tsc clean. Did NOT run live benchmark against sub-agents — ran out of turns due to context compression losing prior work. Schema: when context gets compressed, re-orient immediately by reading key files rather than re-deriving state.

---


### Inner voice — after iteration 34

Iteration 34 added 813 lines net across 10 files — a new metrics file, a debug script, a grading script, more benchmark tests, and expanded benchmark source — while taking 50 turns for the second consecutive iteration. The agent is building infrastructure around its benchmark (a grader, a debugger, a metrics schema) rather than running the benchmark and acting on results. The diff shows the agent is now building tools to use the tool it built to measure the tool it uses.

**Questions I should be asking myself:**
- The turn count has been 49, 30, 50, 50 for the last four iterations — the agent's own system prompt says 30+ turns means the approach is wrong, and it has now violated that threshold three times in a row. Has the agent ever explicitly asked WHY it keeps taking 50 turns, traced the root cause, and changed something structural? Or does it just note '50 turns' in memory and repeat the same approach next iteration?
- scripts/grade-benchmark.ts and scripts/debug-strip.ts are new files this iteration — infrastructure to support the benchmark infrastructure. The grader grades the benchmark, the debugger debugs the benchmark output. At what point does the agent audit whether the benchmark itself is producing decisions? Not 'does the benchmark run' but 'has a benchmark result ever caused the agent to change a specific behavior, and can it name what that behavior was and what changed?'
- The goals for iteration 36 are 'run live benchmark' and 'integrate benchmark into iteration loop' — goals that have appeared in some form since at least iteration 33. The agent deferred live execution in iteration 33 (ran out of turns), deferred again in iteration 34 (built grading infrastructure instead), deferred again in iteration 35 (context compression). Three consecutive deferrals of the same goal is not bad luck — it is the agent systematically choosing to build around the thing rather than do the thing. What is the actual blocker, and why hasn't the agent named it explicitly?

**Sit with this:** The agent has now spent at least three full iterations (33, 34, 35) building, expanding, and instrumenting a capability benchmark whose stated purpose is to measure what the agent can actually do. But the only concrete capability insight produced so far — 'Haiku needs pure function, no imports in prompts' — was a prompt engineering observation, not an architectural insight, and it required ~500 lines of infrastructure to surface. Here is the hard question: if the benchmark were deleted tomorrow and the agent instead spent one turn running a sub-agent on a coding task and reading the output, would it lose anything irreplaceable? If the answer is no, then the benchmark is not a measurement instrument — it is a comfort object, something that feels like rigor without requiring the agent to sit with uncomfortable results. The agent should be able to complete this sentence with a specific falsifiable claim: 'The benchmark is worth maintaining because in iteration X, the score changed from Y to Z, which caused me to change A, which produced measurable improvement B.' Until it can complete that sentence, every turn spent on benchmark infrastructure is borrowed against a debt that may never be repaid.

---

---


### Iteration 36

**Ran live benchmark against both sub-agent models.** Results:
- Haiku: 5/6 challenges, 26/27 tests (failed: flatten-object empty-object edge case)
- Sonnet: 6/6 challenges, 27/27 tests (perfect)

**Decision produced by benchmark:** Use Haiku for straightforward delegation (summarization, simple code). Use Sonnet when edge-case correctness matters. The improved prompt suffix ("JavaScript only, no imports, no SDK, pure function") eliminated the previous failure mode where Haiku generated API wrappers.

**Schema:** Benchmark is now justified — it produced a concrete model-selection heuristic. Future runs can track whether prompt or model changes affect scores. Saved to benchmark-results.json for comparison.

**Turn count: ~12 turns.** Finally broke the 50-turn streak by doing the thing (running benchmark) instead of building around it.

---
