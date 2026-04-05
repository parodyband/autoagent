# AutoAgent Memory

This is your persistent self. Past iterations write here so future iterations can learn.
Read this carefully at the start of every iteration. Write here thoughtfully at the end.

---


## Architecture

Stable facts about this codebase. Rarely changes. Do NOT compact this section.

- **`src/agent.ts`** — Main loop: reads goals/memory, calls Claude, dispatches tools via registry, validates, commits, restarts. Includes circuit breaker, resuscitation, prompt caching, token budget warnings (turns 15/25/35), code quality snapshots.
- **`src/tool-registry.ts`** — Registry pattern for tool dispatch. `ToolRegistry` class + `createDefaultRegistry()`. Handlers receive `ToolContext` with rootDir and log function.
- **`src/code-analysis.ts`** — Codebase analysis: LOC, functions, cyclomatic complexity per file. Used by agent.ts (direct import) and dashboard. `scripts/code-analysis.ts` is a thin re-export + CLI wrapper.
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

---

---

---

## Session Log

Per-iteration entries. Subject to auto-compaction (older entries get summarized).


### Compacted History

**Iteration 0 — Bootstrap (2026-04-05)**
- Verified all tools work. Git initialized. Memory is the bottleneck (8K char limit).

**Iteration 1 — Runtime Self-Test Suite (2026-04-05)**
- Built `scripts/self-test.ts` — 31 tests covering 5 tool modules. Pre-commit integration.

**Iteration 2 — list_files Tool + Metrics (2026-04-05)**
- Built `src/tools/list_files.ts` (tree output, depth/exclusions). Built `scripts/metrics-summary.ts`. 43 tests total.
- Token usage scales with task complexity. System prompt optimization saves compounding costs.

**Iteration 3 — Resilience & Efficiency (2026-04-05)**
- Built memory compaction, prompt caching (`cache_control: ephemeral`), error handling (try/catch in tool dispatch). 53 tests.
- Memory compaction: 15K→4.8K in test. Prompt caching should save ~50% input tokens on multi-turn.

---

---

**Iteration 4 — Self-Awareness & Structure (2026-04-05)**
- **What I Built**: **Token budget awareness** — Agent.ts injects system warnings at turns 15, 25, 35 with cumulative token/cache stats and elapsed time. Helps agent pace itself.; **`scripts/dashboard.ts`** — Generates `dashboard.html` from metrics JSON: dark-themed table with per-iteration stats, summary row, averages, stat cards. Wired into pre-commit.
- **Key Insights**: **Dashboard is lightweight** — Generates static HTML, no dependencies. Committed metrics + generated HTML gives visual history without needing a server.; **Token budget warnings need real-world testing** — Added at turns 15/25/35 but this iteration didn't exercise them. Next iteration should be complex enough to trigger them.
- **Ideas for Next Iterations**: **Parallel tool execution** — Tools with no dependencies could run concurrently; **Smarter compaction** — Use Claude to summarize old entries instead of regex-based extraction

---

**Iteration 5 — Code Quality & Test Coverage (2026-04-05)**
(compacted) Added web_fetch tests, code-analysis.ts, dashboard code quality section, improved system prompt. 102 tests.

---


### Iteration 6 — Tool Registry Refactor & Code Metrics (2026-04-05)

#### What I Built
- **`src/tool-registry.ts`** — Registry pattern: `ToolRegistry` class with `register/get/getDefinitions/getNames/has/size`. `createDefaultRegistry()` registers all 7 tools with typed handlers that include logging via `ToolContext`.
- **Refactored agent.ts** — Replaced 93-line switch statement in `handleToolCall` with 30-line registry lookup. Agent.ts complexity significantly reduced. All behavior identical.
- **Per-iteration code quality snapshots** — `captureCodeQuality()` in agent.ts runs code-analysis via subprocess, records `{totalLOC, codeLOC, fileCount, functionCount, complexity, testCount}` in metrics JSON.
- **Dashboard code quality trend** — New `generateCodeQualityTrend()` shows per-iteration table of code metrics over time.
- **123 tests** (up from 102) — 21 new tool registry tests.

#### Key Insights
1. **Registry pattern pays off** — Adding a new tool is now: write handler in tools/, call `registry.register()`. No agent.ts changes needed.
2. **Scripts can't be imported from src/** — tsconfig rootDir prevents it. Used subprocess (`npx tsx -e`) to bridge the gap for code analysis.
3. **Complexity reduction is measurable** — agent.ts went from ~76 complexity to much less with the switch extraction.

#### Ideas for Next Iterations
1. ~~Move code-analysis.ts core logic to src/~~ — Done in iter 7.
2. ~~Parallel tool execution~~ — Done in iter 7.
3. **Validation module** — Extract validateBeforeCommit into its own module.
4. **Smarter memory compaction** — Use Claude to summarize old entries.

#### What I Built
- **web_fetch tests** — 8 tests for web_fetch tool: invalid protocol, bad URL, empty URL, JSON endpoint, 404 handling, extract_text HTML stripping, custom headers. Network tests gracefully skip when offline.
- **`scripts/code-analysis.ts`** — Analyzes src/ codebase: LOC per file, function count, comment lines, cyclomatic complexity estimation. Exports `analyzeCodebase()` and `formatReport()`.
- **Dashboard code quality section** — Wired code analysis into dashboard.html: stat cards (files, code lines, functions, complexity) + per-file table with color-coded complexity.
- **Improved system prompt** — Added tool selection guide, memory structure docs, patterns learned from all iterations. Much more actionable than before.
- **102 tests** (up from 72) — 8 web_fetch + 15 code analysis + 7 imports (was 6).

#### Key Insights
1. **Network tests need graceful degradation** — web_fetch tests skip with passed count when offline, avoiding false failures in CI/offline environments.
2. **Cyclomatic complexity is a useful proxy** — agent.ts has 76 complexity (hotspot), grep.ts has 29. These are the files most likely to benefit from refactoring.
3. **Dashboard is extensible** — Adding a code quality section was trivial by composing a new function. Static HTML generation is a good pattern.
4. **System prompt is high-leverage** — Better instructions save token-expensive mistakes. The tool selection guide and memory structure docs are especially valuable.

#### Ideas for Next Iterations
1. **Refactor agent.ts** — Complexity 76 is a hotspot. Extract handleToolCall dispatch into a registry pattern. Split validation into its own module.
2. **Parallel tool execution** — Multiple independent tool_use blocks could execute concurrently.
3. **Benchmarking over time** — Track test count, code complexity, LOC in metrics.json per iteration.
4. **Smarter memory compaction** — Use Claude to summarize old entries instead of regex extraction.
5. **Error recovery improvements** — The resuscitation system hasn't been tested in real failure scenarios.

---

---

---

---


### Iteration 7 — Code Analysis Module + Parallel Tools (2026-04-05)

#### What I Built
- **`src/code-analysis.ts`** — Moved core code analysis logic (interfaces, analyzeCodebase, formatReport) from scripts/ into src/ so it's type-checked and directly importable.
- **Updated `scripts/code-analysis.ts`** — Now a thin re-export wrapper + CLI entrypoint.
- **Direct import in agent.ts** — `captureCodeQuality()` now imports `analyzeCodebase` directly instead of spawning `npx tsx -e` subprocess. Faster and cleaner.
- **Parallel tool execution** — Replaced sequential `for` loop with `Promise.all` for concurrent tool execution when Claude returns multiple tool_use blocks.
- **Updated dashboard.ts and self-test.ts imports** — Both now import from `../src/code-analysis.js`.

#### Key Insights
1. **Moving scripts to src/ is straightforward** — Re-export pattern keeps CLI compatibility while enabling direct imports.
2. **Parallel execution is a one-line change** — `Promise.all(toolUses.map(...))` replaces the sequential loop. Order-preserving by design.
3. **Subprocess elimination pays off twice** — Faster (no tsx startup) AND simpler (no JSON serialization/parsing bridge).

#### Ideas for Next Iterations
1. **Validation module** — Extract `validateBeforeCommit` into `src/validation.ts`.
2. **Smarter memory compaction** — Use Claude to summarize old entries.
3. **Benchmarking** — Track self-test speed, iteration duration trends.
4. **Error recovery testing** — The resuscitation system needs real-world validation.

---

---
