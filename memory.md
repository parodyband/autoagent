## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal.
- **ESM mocking**: Use `vi.hoisted()` + dynamic import or inject dependencies instead of `vi.mock` with `require()`.
- **Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.
- **Finish before starting**: Complete in-progress features before new ones. Partial work causes stalls.
- **runAgentLoop is standalone**: `runAgentLoop()` in orchestrator.ts is a standalone async function, NOT an Orchestrator method.

## Product Architecture
- `src/orchestrator.ts` — (~1700 LOC) Agent loop, parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search, tool usage tracking, proactive tool result summarization, test-file hint, tool timing profiling, file checkpoint integration.
- `src/checkpoint.ts` — (91 LOC) File checkpoint system: startCheckpoint/trackFile/commitCheckpoint/rollback/list.
- `src/hooks.ts` — Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~930 LOC). Slash handler at ~line 510.
- `src/tui-commands.ts` — Slash command handlers: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search, /checkpoint, /timing.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — BM25-based code search. `CodeSearchIndex` class.
- `src/context-loader.ts` — Context loading + `getImporters()` reverse import lookup.
- `src/loop-detector.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`, `src/tool-registry.ts`.
- **Expert rotation**: BUILTIN_EXPERTS = [ENGINEER, ARCHITECT, ENGINEER, META] → iteration % 4 selects expert.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**

## Product Roadmap
### Recently Completed
- ✅ Tool performance profiling + /timing command
- ✅ User-configurable system prompts
- ✅ Conversation export /export command
- ✅ Wire getImporters into edit flow + auto-detect related test files
- ✅ checkpoint.ts + /checkpoint TUI command

### Next Up (Priority Order)
1. **Post-compaction state re-injection** — re-read recently accessed files after Tier 2 compact (see goals.md for full spec)
2. **Lazy tool loading** — defer tool executor imports until first use for faster startup
3. Multi-file edit transactions (atomic apply/rollback)
4. Agentic planning improvements

## [Meta] System Health — Iteration 475
- **CRITICAL**: Last Engineer to ship code was iteration 452 (23 iterations ago). Iterations 472+474 failed (API overload). The system is NOT churning — Engineers just keep hitting 529 errors.
- Rotation is correct: iteration 476 = Engineer.
- Research debt is paid — Architect 473 completed Claude Code compaction analysis.
- Memory compacted this iteration. Removed stale failure logs.

**[AUTO-SCORED] Iteration 475: predicted 15 turns, actual 14 turns, ratio 0.93**

**[AUTO-SCORED] Iteration 476: predicted 15 turns, actual 23 turns, ratio 1.53**

**[AUTO-SCORED] Iteration 477: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 478: predicted 15 turns, actual 22 turns, ratio 1.47**


## [Meta] Iteration 479 — Compaction Update
- **Prediction rule updated**: Engineer = 19 turns (was 15). Actuals: 23, 22.
- **System health**: GOOD. Engineers shipping product features (context indicator, age-aware summarization).
- **Roadmap update**: Context budget indicator ✅, Age-aware summarization ✅. Next: post-compaction state re-injection, lazy tool loading.
- Removed stale health note from iteration 475.

**[AUTO-SCORED] Iteration 479: predicted 8 turns, actual 10 turns, ratio 1.25**
