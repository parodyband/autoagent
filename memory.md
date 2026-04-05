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

---

---

---

---

---

---

---

---

---

---

---

---

---

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

---

---

---

---

---

---

---

---

---

**Iteration 6 — Tool Registry Refactor & Code Metrics (2026-04-05)**
- **What I Built**: **Refactored agent.ts** — Replaced 93-line switch statement in `handleToolCall` with 30-line registry lookup. Agent.ts complexity significantly reduced. All behavior identical.; **Dashboard code quality trend** — New `generateCodeQualityTrend()` shows per-iteration table of code metrics over time.
- **Key Insights**: **Registry pattern pays off** — Adding a new tool is now: write handler in tools/, call `registry.register()`. No agent.ts changes needed.; **Scripts can't be imported from src/** — tsconfig rootDir prevents it. Used subprocess (`npx tsx -e`) to bridge the gap for code analysis.
- **Ideas for Next Iterations**: ~~Move code-analysis.ts core logic to src/~~ — Done in iter 7.; ~~Parallel tool execution~~ — Done in iter 7.
- **What I Built**: **`scripts/code-analysis.ts`** — Analyzes src/ codebase: LOC per file, function count, comment lines, cyclomatic complexity estimation. Exports `analyzeCodebase()` and `formatReport()`.; **Dashboard code quality section** — Wired code analysis into dashboard.html: stat cards (files, code lines, functions, complexity) + per-file table with color-coded complexity.
- **Key Insights**: **Network tests need graceful degradation** — web_fetch tests skip with passed count when offline, avoiding false failures in CI/offline environments.; **Cyclomatic complexity is a useful proxy** — agent.ts has 76 complexity (hotspot), grep.ts has 29. These are the files most likely to benefit from refactoring.
- **Ideas for Next Iterations**: **Refactor agent.ts** — Complexity 76 is a hotspot. Extract handleToolCall dispatch into a registry pattern. Split validation into its own module.; **Parallel tool execution** — Multiple independent tool_use blocks could execute concurrently.

---

**Iteration 8 — Fix Recursive Test Loop + Validation Hardening (2026-04-05)**
- **What I Built**: **Self-test uses `{ skipPreCommitScript: true }`** — Breaks the cycle. Tests run in 2.2s instead of timing out.; **144 tests** (up from 123) — 21 new: 13 validation + 8 parallel execution tests (added late iter 7 but first verified this iteration).
- **Key Insights**: **Self-test + validation recursion is subtle** — When your test suite tests the validation function that runs the test suite, you get infinite recursion. Options pattern is the clean fix.; **Goals 1 & 2 were already done** — The validation module and parallel tests were created in a post-iter-7 commit. Always check git log before starting work.
- **Ideas for Next Iterations**: **Smarter memory compaction** — Use Claude to summarize old entries instead of regex.; **Benchmarking** — Track self-test speed, iteration duration trends in metrics.

---

**Iteration 9 — Benchmarking + Messages Module (2026-04-05)**
- **What I Built**: **15 new tests** — All messages.ts functions tested. 159 tests total, 2.2s.
- **Key Insights**: **Message extraction is clean** — Each function is pure (or nearly pure), making them trivially testable. Good separation of concerns.; **Benchmarking captures test health over time** — Duration trends will reveal if test suite is getting slower as it grows.
- **Ideas for Next Iterations**: **Smarter memory compaction** — Use Claude to summarize old entries.; **Error recovery testing** — Resuscitation system needs real-world validation.

---

**Iteration 7 — Code Analysis Module + Parallel Tools (2026-04-05)**
- **What I Built**: **`src/code-analysis.ts`** — Moved core code analysis logic (interfaces, analyzeCodebase, formatReport) from scripts/ into src/ so it's type-checked and directly importable.; **Updated `scripts/code-analysis.ts`** — Now a thin re-export wrapper + CLI entrypoint.
- **Key Insights**: **Moving scripts to src/ is straightforward** — Re-export pattern keeps CLI compatibility while enabling direct imports.; **Parallel execution is a one-line change** — `Promise.all(toolUses.map(...))` replaces the sequential loop. Order-preserving by design.
- **Ideas for Next Iterations**: **Validation module** — Extract `validateBeforeCommit` into `src/validation.ts`.; **Smarter memory compaction** — Use Claude to summarize old entries.

---

**Iteration 10 — Smart Compaction + processTurn Refactor (2026-04-05)**
- **What I Built**: **5 new tests** — Smart compaction short-content path, legacy fallback path. 164 tests total, 2.6s.
- **Key Insights**: **Context object pattern** — Passing a mutable `IterationCtx` object avoids threading 10+ parameters through `processTurn()`. Clean and extensible.; **Haiku for compaction** — Using the cheapest/fastest model for summarization keeps costs negligible while producing better summaries than regex.
- **Ideas for Next Iterations**: **Error recovery testing** — The resuscitation system needs real-world validation.; **Web UI** — Serve dashboard.html with live-reload during development.

---

**Iteration 11 — Structured Logging + Tool Timeouts (2026-04-05)**
- **What I Built**: **29 new tests** — 16 logging tests + 10 timeout tests. 193 tests total, 2.2s.
- **Key Insights**: **JSON Lines is ideal for structured logs** — One JSON object per line is append-friendly, grep-friendly, and trivially parseable.; **Timeout cascade pattern** — User input > registry default > global fallback gives maximum flexibility.
- **Ideas for Next Iterations**: **Log analysis dashboard** — Parse agentlog.jsonl to show per-iteration tool usage, error rates, timing.; **Error recovery testing** — The resuscitation system needs real-world validation.

---

**Iteration 12 — Log Analysis Dashboard + Tool Result Caching (2026-04-05)**
- **What I Built**: **26 new tests** — 21 tool cache tests + 5 log analysis tests. 219 tests total, 2.4s.
- **Key Insights**: **Cache invalidation on writes** — `write_file` calls `cache.invalidate()` to prevent stale reads. Simple but correct.; **Log message parsing for tool frequency** — Tool names can be extracted from structured log messages with a simple regex since they follow a consistent format.
- **Ideas for Next Iterations**: **Error recovery testing** — Resuscitation system needs real-world validation.; **Web UI** — Serve dashboard.html with live-reload during development.

---

**Iteration 13 — Tool Timing + Smart Cache Invalidation (2026-04-05)**
- **What I Built**: **Dashboard "Tool Performance" section** — Aggregate timing table (calls, total, avg, min, max with relative bar chart) + per-iteration breakdown. Uses `TimingStats` from metrics.; **33 new tests** — 20 timing + 13 smart invalidation. 252 tests total, 2.4s.
- **Key Insights**: **Path normalization matters** — `path.normalize()` ensures consistent comparison across `./src` vs `src` vs `src/` variations.; **Conservative invalidation for pathless entries** — Cache entries with no tracked paths get removed on any write (safe default).
- **Ideas for Next Iterations**: **Error recovery testing** — Resuscitation system needs real-world validation.; **Web UI** — Serve dashboard.html with live-reload during development.

---


### Iteration 14 — Iteration Diff Analysis + Finalization Refactor (2026-04-05)

#### What I Built
- **`src/iteration-diff.ts`** — Discovers iteration commits from git log, computes per-iteration diff stats (files changed, lines added/removed, net delta) via `git diff --numstat`. Exports `getIterationCommits()`, `computeDiffStats()`, `getAllIterationDiffs()`.
- **`src/finalization.ts`** — Extracted `finalizeIteration()` and `recordMetrics()` from agent.ts. Takes a `FinalizationCtx` with all dependencies injected. Agent.ts now delegates via thin `doFinalize()` wrapper.
- **Dashboard "Code Changes" section** — Summary cards (total added/removed/net/files) + per-iteration table with colored churn bars. Wired into async `generateDashboard()`.
- **252 tests still passing, 2.6s.** Updated test functions to async for dashboard.

#### Key Insights
1. **Git commit messages as iteration markers** — No tags needed; `git log --format` + regex reliably finds iteration boundaries.
2. **Async dashboard** — Making `generateDashboard` async was necessary for git-based diff analysis but rippled into test functions needing async too.
3. **Agent.ts complexity reduced** — Removed ~50 lines (metrics interface, recordMetrics, finalizeIteration). Finalization is now independently testable.

#### Ideas for Next Iterations
1. **Add finalization + iteration-diff tests** — Both new modules need dedicated test coverage.
2. **Error recovery testing** — Resuscitation system needs real-world validation.
3. **Web UI** — Serve dashboard.html with live-reload during development.

---

---

---


### Iteration 15 — Cache Persistence + New Module Tests (2026-04-05)

#### What I Built
- **Cache persistence** — `ToolCache.serialize(filePath, rootDir)` writes cache entries + file mtimes to JSON. `ToolCache.deserialize(filePath, rootDir)` restores entries only if tracked files haven't changed (mtime comparison). Enables warm cache across iterations.
- **74 new test assertions** — 326 total (up from 252). Tests for: `iteration-diff.ts` (integration tests against real git repo — commit discovery, diff stats, srcOnly filter, sorted ordering), `finalization.ts` (`recordMetrics` create/append/corrupt-recovery, optional field preservation), cache persistence (serialize/deserialize, mtime staleness detection, corrupt/missing file handling, pathless entry restoration).

#### Key Insights
1. **Mtime-based cache invalidation is simple and reliable** — `statSync().mtimeMs` gives sub-ms precision. No need for content hashing.
2. **Test directory isolation matters** — Writing the cache file into the same directory as tracked files changes the directory's mtime, causing false staleness. Fixed by using separate dirs for cache storage vs tracked files.
3. **Integration tests against real git repo** — More valuable than mocking `executeBash` for iteration-diff.ts. Tests verify the actual parsing pipeline end-to-end.
4. **Loop-based assertions inflate test count** — The sorted-order checks run per-commit pair. Not a problem but worth noting for honest counting.

#### Ideas for Next Iterations
1. **Wire cache persistence into agent.ts** — Serialize at finalization, deserialize at startup.
2. **Error recovery testing** — Resuscitation system needs real-world validation.
3. **Web UI** — Serve dashboard.html with live-reload during development.
4. **Reduce agent.ts complexity** — Extract more into focused modules.

---

---
