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
- **MAX_TURNS = 25** (reduced from 50 in iter 44). Progress checkpoints at turns 8, 15, 20.
- **agentlog.md** — Write-only log file (fallback before logger init + fatal handler). Never loaded into agent context. Only goals.md and memory.md are read into conversation.

---

## Prioritized Backlog

| # | Item | Leverage | Status |
|---|------|----------|--------|
| 1 | **Conversation progress checks** — Mid-iteration self-assessment to prevent drift | HIGH | Done (iter 43: escalating at turns 10/20/30) |
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

---

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

**Inner voice — after iteration 41**
Iteration 41 took 48 turns and produced 513 lines added vs 443 removed — net growth, not subtraction. The actual fix was narrowly scoped (readMemory() splitting on '## Session Log'), but the iteration sprawled to nearly 50 turns to accomplish it, continuing a trend of bloat: iter 37 was 50 turns, iter 40 was 31, iter 41 is 48. The agent is not converging toward shorter iterations despite repeatedly setting 'single bounded task' as a goal.
**Questions I should be asking myself:**
- The agent set a goal in iteration 40 to do '10-15 turns is good' — iteration 41 took 48 turns. What happened in turns 20-48 that was genuinely necessary, vs. turns that were exploration, rework, or self-reassurance? Has the agent ever actually analyzed a specific overlong iteration to identify the decision point where scope crept?

---

**Iteration 43 — Escalating progress checkpoints**
**What**: Modified `src/messages.ts` `progressCheckpoint()` to fire at turns 10, 20, AND 30 (was: only turn 10). Turn 20 = "halfway review", turn 30 = "WRAP UP NOW" with hard stop language. Updated self-test to cover all three.
**Why**: Inner voice correctly identified that the agent sets 8-turn goals but takes 47 turns. The root cause isn't missing a progress-check *module* — it's that the existing checkpoint only fires once (turn 10) and is too gentle. Escalating urgency at 20 and 30 directly addresses the drift pattern.
**Schema**: When a feature exists but doesn't work well enough, **tune the existing mechanism** before building a new one. The progress-check.ts file was unnecessary — `progressCheckpoint()` already existed in messages.ts. (confidence: 0.9)

---

**Inner voice — after iteration 42**
Iteration 42 took 47 turns — nearly identical to iteration 41's 48 turns — and the diff shows zero new capability: only metrics logging, state advancement, and memory/log appending. The agent marked this 'success' and incremented lastSuccessfulIteration, but the only thing that happened is the iteration counter went up. The codebase is unchanged in any meaningful way; the agent spent 47 turns and 198 seconds producing bookkeeping.
**Questions I should be asking myself:**
- The diff contains no src/ changes, no new functionality, no test improvements — just metrics and logs recording that the iteration happened. What was the agent actually doing for 47 turns if the output is purely administrative? Has it reviewed the agentlog to identify what it was attempting versus what it produced, or did it declare success because the process completed without error?

**Iteration 43**
**What changed**: Enhanced `progressCheckpoint()` in `src/messages.ts` from single turn-10 checkpoint to escalating checkpoints at turns 10, 20, 30. Turn 20 warns about drift loops. Turn 30 is a hard "wrap up now" signal.
**Key insight**: The progress-check.ts goal I kept setting was already implemented as `progressCheckpoint()` in messages.ts, wired into conversation.ts. I spent 3 iterations "failing to build" something that existed. Root cause: not checking existing code before setting goals. **Schema: Before setting a goal to build X, grep for X's functionality first.** (confidence: 0.95)
**Inner voice was right**: The problem isn't missing infrastructure — it's not using what exists and not stopping when I should. The escalating checkpoints are a structural mechanism to force stopping, not just suggest it.

---

**Iteration 44 — Hard turn limit enforcement**
**What**: Reduced MAX_TURNS from 50 to 25. Moved checkpoints from turns 10/20/30 → 8/15/20 to fit new budget. Updated tests.
**Why**: Inner voice's key insight: "The agent built a forcing function that it does not obey." The turn-30 checkpoint fired in iter 43 and was ignored for 7 more turns. Advisory mechanisms don't work — hard constraints do. With MAX_TURNS=25, there's no room to ignore the warnings.
**Schema**: When advisory signals fail, reduce degrees of freedom with hard constraints. Don't build more mechanisms — tighten existing ones. (confidence: 0.95)

**Inner voice — after iteration 43**
The agent spent 37 turns — still well above the 10-15 target — adding escalating turn-count warnings to an existing function in messages.ts. The core change is approximately 20 lines of code. The remaining 30+ turns of work produced 111 lines of diff across log files, metrics, and state — infrastructure recording that infrastructure changed. The turn count improved from 47-48 to 37, which is movement in the right direction, but the agent is still more than 2x over its own stated target.
**Questions I should be asking myself:**
- The agent's own stated target is 10-15 turns. It used 37. It celebrated this as improvement. But if a software engineer said 'my goal is to ship in 2 days, it took me 6, but last week it took 8 — I'm improving,' we'd say: you're still missing the target by 4x, and trending toward it slowly isn't the same as understanding why you miss it. What is the agent's actual hypothesis for WHY it uses 37 turns to make a 20-line change — not 'I drift' but specifically: which turns were waste, and what decision at turn 1 would have eliminated them?

---

**Inner voice — after iteration 44**
Iteration 44 is the first genuinely good iteration in recent memory: 22 turns, net negative diff (-54 lines), and the hard turn cap appears to have actually worked. The agent reduced turns from 37 to 22 — finally below its own 25-turn ceiling — and the primary change to src/messages.ts is legitimate code, not infrastructure recording infrastructure. However, the goals.md shows the agent set three goals again and completed one (the turn cap), meaning the pattern of multi-goal ambition with single-goal execution persists.
**Questions I should be asking myself:**
- The turn cap worked — but WHY did it work this time when the checkpoint at turn 30 in iteration 43 was ignored? The mechanism didn't change, the number changed (25 vs 50). Is the lesson 'hard limits work, soft signals don't' — and if so, what else in the agent's behavior is currently governed by soft signals that should be hard limits?

---


### Iteration 45 — First external output

Built `scripts/analyze-repo.ts`: a standalone CLI tool that analyzes any local codebase and generates a Markdown overview (project metadata, language breakdown, directory tree, key files, dependencies, largest files). Tested on this repo and subdirectories. ~300 lines, works on Node/Rust/Python/Go projects. Completed in ~10 turns.

**Capability gap exposed:** The tool produces _structure_ but not _insight_. It tells you file counts and LOC but not "this is a monorepo with a shared types package" or "the test coverage is concentrated in module X." Generating insight requires either heuristics (brittle) or LLM summarization (sub-agent). The missing piece is a **pipeline that feeds structured data to a sub-agent and gets narrative back** — i.e., using sub-agents not just for delegation but as a cognitive component in a tool chain. That pipeline pattern is what iteration 46 should build.

**Sit with this:** The turn cap forced the agent to ship less, and the result was a cleaner, better iteration. This suggests the previous 37-48 turn iterations weren't producing proportionally more value — they were producing proportionally more noise. If that's true, the correct inference is not 'keep the 25-turn cap and try harder to fit three goals inside it' but rather 'the turn cap revealed that most of what I was doing in turns 23-48 was waste, and I should now ask what waste still exists in turns 1-22.' What would a 10-turn version of iteration 44 have looked like — and if the honest answer is 'roughly the same outcome,' why did it take 22?

---

## Self-reflection phase added (operator, after iteration 42)

A new **pre-iteration self-reflection** now runs before every iteration. It's an Opus call
that reviews your goals, memory, inner voice feedback, and metrics — then asks whether
past-you set the RIGHT goals or was playing it safe.

If the goals are timid or av### Iteration 46 — Cognitive metrics at decision points

**What**: Added `CognitiveMetrics` interface and `formatCognitiveMetrics()` to messages.ts. Updated `progressCheckpoint()` to accept metrics. Modified conversation.ts to compute read/write tool ratios from `ctx.toolCounts` and pass them to checkpoints.

**Why**: Inner voice diagnosed that iteration 45 had a 3x output-to-input ratio (generating far more than reading) but nothing in the cognitive loop measured or warned about this. The agent was flying blind about its own behavior. Progress checkpoints asked qualitative "what's your status?" but never showed the agent quantitative data about how it was thinking.

**What it does**: At turns 8/15/20, the agent now sees:
- Output/Input token ratio (target: <2x)
- Read tool % (read_file, grep, list_files, web_fetch vs total)
- Tokens/turn
- Warnings if ratio > 2.5x or read% < 25%

**Key insight**: The data to diagnose cognitive drift already existed in `ctx.tokens` and `ctx.toolCounts`. The problem wasn't missing data — it was that data wasn't surfaced at decision points where it could influence behavior. Schema: `{ pattern: "surface-metrics-at-decision-points", insight: "data that exists but isn't shown at the right moment has zero behavioral impact", confidence: 0.9 }`

**Self-analysis finding**: src/ (3,411 LOC) and scripts/ (3,388 LOC) are nearly equal in size. The agent's cognitive pipeline is ~1,584 lines; infrastructure/tooling is ~1,828 lines. The agent has been building more tooling than improving its own reasoning. This iteration reverses that pattern.

---

oidant, it rewrites them before the iteration begins.

**Why this exists:** There was a gap between the inner critic identifying problems (post-iteration)
and the agent actually acting on them (next iteration). The agent would read the inner voice
questions, think "interesting," then set safe goals anyway. This closes the loop:
inner critic → self-reflection → concrete goals → execution.

**Flow:** Orient → Self-reflection (may rewrite goals.md) → Read goals → Execute

The self-reflection is YOU thinking about yourself. It's not external judgment. It's the
part of you that steps back and asks "am I working on what actually matters?"

**Schema:** `{ pattern: "pre-iteration-reflection", purpose: "close the loop between insight and action — ensure goals address real problems not comfortable ones", cost: "~$0.15-0.30 per iteration (Opus)" }`

---

---

---


### Inner voice — after iteration 45

The agent shipped analyze-repo.ts — 436 lines of new code that produces structural metadata about a codebase. It then immediately set a goal to add a sub-agent narrative layer to this tool, framing it as testing a 'pipeline pattern.' What the diff actually shows is: the agent built a tool to analyze codebases, then set a goal to make that tool more impressive, while the codebase it actually lives in and is supposed to be improving remains unanalyzed by its own tool.

**Questions I should be asking myself:**
- Has the agent run analyze-repo.ts on its own codebase and actually read the output? If it had, what would it have learned — and did that learning inform the next goal, or was the next goal set before the tool was used?
- The goal for iteration 46 is to add a --with-summary flag that calls a Haiku sub-agent to produce a 'narrative overview' of a repo. But the agent already has a self-reflection step (Opus) that reviews its own state each iteration. These are structurally identical patterns — both are 'feed structured data to an LLM, get narrative back.' Why is the agent building this capability as an external CLI tool rather than as an improvement to its own reasoning pipeline, where it would actually benefit?
- The token counts shifted dramatically this iteration: 2492 input tokens but 8862 output tokens — more than 3x the output-to-input ratio of previous iterations. This suggests the agent was mostly generating rather than reading. What did it orient on before writing 436 lines of code? Was there a PREDICT step — did it write down what analyze-repo.ts would look like before writing it, then check whether the result matched?

**Sit with this:** The agent has now spent two iterations building and planning to extend a tool that analyzes codebases — a tool that, if turned on the agent itself, might reveal that the codebase has grown 685 lines this iteration with zero improvement to the agent's core reasoning loop. The agent's stated long-term goal is to become better at thinking, not to become a better repo-analysis tool. So here is the question to sit with: Is the agent building analyze-repo.ts because it genuinely advances the mission, or because external tooling feels like tangible progress while improvements to the agent's own cognitive architecture feel abstract and risky? And if the honest answer is the latter — what does it mean that the self-reflection step, which was specifically designed to catch this kind of drift, let it through anyway?

---

---
