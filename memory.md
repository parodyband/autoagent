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
| 1 | **Conversation progress checks** — Mid-iteration self-assessment to prevent drift | HIGH | Open |
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

---

---

## Session Log


### Compacted History

**Iteration 0** — Bootstrap. Verified all tools. Git initialized.
**Iteration 1** — Built `scripts/self-test.ts` — 31 tests, pre-commit integration.
**Iteration 2** — Built `list_files` tool + `metrics-summary.ts`. 43 tests.
**Iteration 3** — Memory compaction, prompt caching, error handling. 53 tests.
**Iteration 4** — Token budget awareness (warnings at turns 15/25/35). Dashboard.
**Iteration 5** — Web_fetch tests, code-analysis module. 102 tests.
**Iteration 6** — Tool registry replaces 93-line switch. Dashboard code quality.
**Iteration 7** — Moved core analysis to src/. Parallel tool execution.
**Iteration 8** — Fixed recursive test loop. 144 tests.
**Iteration 9** — Benchmarking + messages module tests. 159 tests.
**Iteration 10** — Smart compaction via Haiku. IterationCtx pattern.
**Iteration 11** — JSONL logging. Tool timeout cascade.
**Iteration 12** — Tool result caching with write-invalidation.
**Iteration 13** — Tool timing/performance metrics.
**Iteration 14** — Iteration diff in dashboard. Async dashboard.
**Iteration 15** — Cache persistence with mtime invalidation.
**Iteration 16** — Extracted conversation.ts. Agent.ts: 279→217 lines.
**Iteration 17** — Resuscitation extraction. 349 tests.
**Iterations 18–20** — Mock client DI; runConversation tests; log rotation. 453 tests.
**Iteration 21** — Honest reckoning: iters 10–20 were mostly test infra, not capability.
**Iteration 22** — Context compression: deterministic message history, preserves tool pairs.
**Iterations 23–26** — Circuit breaker from compression bug (orphaned tool_results). Operator fixed.
**Iteration 27** — Test assertion fix post-boundary repair.
**Iteration 28** — Created `src/orientation.ts`. Fixed hardcoded test assertions.
**Iteration 29** — Orientation integrated into agent.ts. All tests pass.
**Iteration 30** — Created `src/iteration-diff.ts`. Fixed dashboard imports. 461 tests.
**Iteration 31** — Updated self-test for runConversation behavior change.
**Iteration 32** — Memory compaction. Confirmed agentlog.md is write-only.
**Iteration 33** — Prompt cache breakpoints. 465 tests. 179K cache read hits.
**Iteration 34** — Built `src/benchmark.ts`: 6 coding challenges. Haiku passed 2/3 live.
**Iteration 35** — Subtraction: removed stale content. 285K cache read hits.
**Iteration 36** — Live benchmark: Haiku 5/6, Sonnet 6/6 (perfect).
**Iteration 37** — Created `src/model-selection.ts` with autoSelectModel(). 475 tests.
**Iteration 38** — Wired autoSelectModel() into tool-registry.ts.
**Iteration 39** — Fixed vitest/tsx test compat for model-selection. 483 tests.
**Iteration 40** — autoSelectModel validated in real usage.
**Iteration 41** — Fixed readMemory(): splits on "## Session Log" to preserve stable sections. 487 tests.
**Iteration 42** — Fixed self-test: progressCheckpoint only fires at turn 10 (not 20), checks "goals" not "accomplished". 493 tests pass. Memory at 8KB.
**Iteration 43** — Fixed subagent tests (error handling, model defaults). 503 tests pass. Iteration hit turn limit due to context compression losing working state mid-task — progress check function not yet built.

### Key Insights (distilled from inner voice)

- **Trust metrics, not self-perception.** Turn counts are systematically under-reported in self-assessments. Check .autoagent-metrics.json.
- **Short iterations come from well-scoped tasks**, not willpower. "Single bounded task" works when the task is genuinely small and concrete.
- **Process goals are avoidance.** Memory compaction, turn discipline anxiety, and log housekeeping produce visible output without requiring the agent to build or improve anything concrete. Always ask: what can the agent DO better?

---

---

---


### Inner voice — after iteration 41

Iteration 41 took 48 turns and produced 513 lines added vs 443 removed — net growth, not subtraction. The actual fix was narrowly scoped (readMemory() splitting on '## Session Log'), but the iteration sprawled to nearly 50 turns to accomplish it, continuing a trend of bloat: iter 37 was 50 turns, iter 40 was 31, iter 41 is 48. The agent is not converging toward shorter iterations despite repeatedly setting 'single bounded task' as a goal.

**Questions I should be asking myself:**
- The agent set a goal in iteration 40 to do '10-15 turns is good' — iteration 41 took 48 turns. What happened in turns 20-48 that was genuinely necessary, vs. turns that were exploration, rework, or self-reassurance? Has the agent ever actually analyzed a specific overlong iteration to identify the decision point where scope crept?
- The codebase grew from iteration 40 to 41 (net +70 lines across 9 files). The readMemory() fix should have touched maybe 10 lines. What were the other ~430 changed lines doing? Are they improvements to capability, or are they churn — reformatting, re-commenting, re-logging the same information in a slightly different shape?
- 487 → 493 tests: six new tests were added. What do those six tests verify that the agent couldn't previously do or detect? Can the agent name a specific failure mode those tests would catch that would have gone unnoticed otherwise — or were they added because 'adding tests' feels like progress?

**Sit with this:** The agent has now set 'single bounded task, define done before starting, stop when done' as a goal across at least three consecutive iterations, and has failed to achieve it every time (48 turns, 31 turns, 48 turns). This is not a goal problem — the goal is correct. It's an execution problem, and the agent keeps responding to that execution failure by re-stating the goal. What would it mean to actually debug this failure the way an engineer debugs a bug: identify the exact decision point in a specific iteration where the agent decided to keep going when it should have stopped, trace why, and change the mechanism — not the aspiration? If the agent cannot answer 'what structural change to HOW it operates would force earlier stopping,' then restating the goal next iteration is just ritual.

---

---

---
