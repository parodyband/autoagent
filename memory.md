

## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.

---

---

---


## Product Architecture
- `src/tui.tsx` — Ink/React TUI (921 LOC). Footer: tokens/cost/model/ctx. Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact.
- `src/orchestrator.ts` — (1574 LOC) `send()` pipeline: route model → architect mode → auto-load context → agent loop → verify. Parallel tool execution (with auto-retry). Tiered compaction (micro 80K, T1 100K, T2 150K). File watcher hooks. Age-weighted pruning. Prompt cache control. **NEW**: AbortController support (`abort()`, `_abortController`), `getSessionStats()` for duration/cost trend.
- `src/file-watcher.ts` — FileWatcher class. Orchestrator integrated.
- `src/tool-recovery.ts` — `enhanceToolError()` — fuzzy file matching, smart suggestions.
- `src/context-loader.ts` — keyword extraction → fuzzySearch → read top 5 files (48K budget). Git-aware.
- `src/architect-mode.ts` — `runArchitectMode()` → `ArchitectResult`.
- `src/auto-commit.ts` — `autoCommit()` + `undoLastCommit()`.
- `src/diagnostics.ts` — `runDiagnostics(workDir)` — multi-linter. Post-edit auto-fix loop.
- `src/test-runner.ts` — `findRelatedTests()`, `runRelatedTests()`, `detectTestRunner()`.
- `src/tree-sitter-map.ts` — Repo map with PageRank scoring, fuzzySearch, incremental update.
- `src/tools/subagent.ts` — Sub-agent delegation tool (haiku/sonnet).
- `src/init-command.ts` — `runInit()` scaffolds .autoagent.md from project detection.
- `src/project-detector.ts` — `buildSummary()` produces rich project context.
- `src/cli.ts` — CLI entry point. `autoagent init`, `autoagent help` subcommands.
- `src/welcome.ts` — First-run welcome banner.
- `src/file-cache.ts` — File content cache for tools.

---

---

---


## Prediction Accuracy
**Rule: Engineer predictions = 20 turns. Architect predictions = 8 turns. Max 2 goals per Engineer iteration.**

Recent ratios (iters 327–330): 0.75, 0.95, 1.00, 1.25. Average ~1.0. Well-calibrated now.

---

---

---


## [Meta] Iteration 331 Assessment
**System health**: Good. Iter 330 shipped real orchestrator features (abort + session stats) despite hitting 25-turn cap. The TUI side still needs wiring.
**Pattern**: Engineer iterations sometimes run out of turns before completing TUI integration. Goals that span orchestrator + TUI should budget for both.
**What's incomplete**: (1) TUI escape-to-cancel not wired to `orchestrator.abort()`, (2) `/status` doesn't display `getSessionStats()` output yet, (3) No tests for abort or session stats.
**Action**: Next Engineer iter should be small/focused: wire TUI + write tests for existing code. No new features.

**[AUTO-SCORED] Iteration 331: predicted 20 turns, actual 19 turns, ratio 0.95**

**[AUTO-SCORED] Iteration 332: predicted 18 turns, actual 25 turns, ratio 1.39**

---

---

---


## CRITICAL GAP — Orchestrator not wired into CLI (operator, iteration 324)
**The biggest problem right now:** `src/cli.ts` doesn't use `src/orchestrator.ts` AT ALL.

The CLI creates a raw Anthropic client and a tool registry. It's just a chat with tools.
None of the 324 iterations of work is reaching the user:

- orchestrator.ts (1390 lines) — not imported by cli.ts
- repo fingerprinting — not used
- file ranking — not used  
- task decomposition — not used
- model routing — not used
- verification — not used
- context compaction — not used
- session persistence — not used
- project memory — not used
- repo map / symbol index — not used

The user types a request and gets raw Sonnet with tools. That's no better than Claude Code.

**This is the #1 priority.** All the infrastructure exists. It just needs to be connected.
The CLI should instantiate the Orchestrator and route all user messages through it.
That's how the product becomes genuinely better than raw Claude.

Until this is wired up, we don't have a product. We have an engine with no car.

---

**[AUTO-SCORED] Iteration 333: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 334: predicted 20 turns, actual 11 turns, ratio 0.55** — WASTED: goals were already done.

---

---

---


## [Meta] Iteration 335 Assessment
**System problem**: CRITICAL GAP (CLI not using Orchestrator) has persisted 11 iterations since flagged at iter 324. Architect iters keep planning other things. Iter 334 was wasted — goals already complete.
**Root cause**: Architect doesn't verify state before writing goals. Goals drift toward polishing existing features instead of fixing the #1 gap.
**Action taken**: Wrote laser-focused goals.md for iter 336 Engineer — single goal: wire cli.ts to Orchestrator. No distractions, explicit "what NOT to do" section.
**If iter 336 doesn't fix this**: escalate — the Architect prompt may need a hard rule: "Check CRITICAL GAP in memory.md first."

---

---

---


## Extended thinking is not enabled ANYWHERE (operator, iteration 324)
Neither the CLI nor the orchestrator uses extended thinking. Every API call is raw
completion with no thinking budget. This is a massive missed opportunity.

Extended thinking (passing `thinking: { type: "enabled", budget_tokens: N }` in the
API call) lets the model reason through complex problems before responding. It's
arguably the single most important feature for a coding agent:

- **Better tool use decisions** — thinks about which files to read, what order to do things
- **Better code generation** — reasons about edge cases before writing
- **Better debugging** — traces through logic step by step
- **Better task decomposition** — thinks about dependencies between subtasks

The state of the art for coding agents is: use extended thinking for the planning/reasoning
phase, then execute tools based on that reasoning. This is how you get quality that's
actually better than raw Claude Code — Claude Code already has thinking mode.

**Implementation:** In the `messages.create()` call, add:
```typescript
thinking: {
  type: "enabled",
  budget_tokens: 10000  // adjust based on task complexity
}
```

Could also be adaptive — small budget (4K) for simple tool calls, large budget (16K+)
for complex planning and code generation. This ties directly into the model routing /
dual process architecture.

**This should be in both the orchestrator AND the CLI.** It's probably the single
highest-leverage change for making the tool actually better than raw Claude.

---

---

---


## Compacted History (iterations 112–330)

**Core milestones** (112–302):
- [178] orchestrator + TUI. [192] Tiered compaction. [193–194] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [204–206] /help, /diff, /undo.
- [211] diagnostics. [216] PageRank + fuzzySearch. [218] context-loader.
- [234] microCompact(). [246] test-runner. [254] Parallel tools + tool-recovery.
- [256] /status. [260] /rewind. [262–266] file-watcher. [270] /compact.
- [282] pruneStaleToolResults(). [286] Sub-agent tool. [298] /export.
- [302] CLI `autoagent init` + auto-export on /exit.

**Recent milestones** (308–330):
- [308] `autoagent help` CLI subcommand.
- [310] Welcome banner + context-loader git-awareness.
- [314] File cache + write_file improvements.
- [322] Incremental repo map update (+138 LOC).
- [324] Auto tool-call retry + incremental reindex wiring.
- [326] Prompt cache control helpers wired into API calls.
- [328] Tests for orchestrator features (260 lines).
- [330] AbortController in orchestrator `send()` + `getSessionStats()` (session duration, cost trend). TUI wiring not yet done.

**Codebase**: ~6K LOC src, 34 files, 938 vitest tests, 76 test files, TSC clean.

---

**[AUTO-SCORED] Iteration 335: predicted 8 turns, actual 9 turns, ratio 1.13**

---

**[AUTO-SCORED] Iteration 336: predicted 20 turns, actual 15 turns, ratio 0.75**

---

**[AUTO-SCORED] Iteration 337: predicted 8 turns, actual 8 turns, ratio 1.00**
