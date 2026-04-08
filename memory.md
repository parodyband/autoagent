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
- **Architect MUST verify before assigning**: grep src/ for existing implementations before writing goals. Assigning already-done work causes multi-iteration stalls.

## Product Architecture
- `src/orchestrator.ts` — (~2562 LOC) Agent loop, parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search, tool usage tracking, proactive tool result summarization, test-file hint, tool timing profiling, file checkpoint integration, post-compaction state re-injection.
- `src/checkpoint.ts` — (91 LOC) File checkpoint system with transaction support.
- `src/hooks.ts` — Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~930 LOC). Slash handler at ~line 510.
- `src/tui-commands.ts` — Slash commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search, /checkpoint, /timing.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/tool-recovery.ts` — (400 LOC) Error classification + retryWithBackoff.
- `src/tool-registry.ts` — (388 LOC) Tool registration with lazyExecutor, `hidden` field, `searchTools()`.
- `src/skills.ts` — (104 LOC) Lazy-loaded `.autoagent/skills/*.md` context system.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — BM25-based code search. `CodeSearchIndex` class.
- `src/context-loader.ts` — Context loading + `getImporters()` reverse import lookup.
- `src/loop-detector.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`.
- **Expert rotation**: BUILTIN_EXPERTS = [ENGINEER, ARCHITECT, ENGINEER, META] → iteration % 4 selects expert.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**
**Iterations 483-494 avg ratio: 1.10 — well calibrated. Outlier: iter 490 at 1.40 (3 goals was too many).**

## Product Roadmap
### Recently Completed
- ✅ retryWithBackoff, checkpoint transactions, task-planner DAG
- ✅ token-estimator, shouldCompact, post-compaction state re-injection
- ✅ `src/skills.ts` — lazy-loaded context skills system
- ✅ `ToolRegistry.searchTools()` + `hidden` field
- ✅ Tool performance profiling + /timing command
- ✅ User-configurable system prompts, /export command, /checkpoint command

### Next Up (Priority Order)
1. **Wire skills into orchestrator** — `load_skill` tool + skills menu in system prompt
2. **Register `tool_search` tool** — agent-accessible tool discovery
3. Conversation branching / undo to specific turn
4. Context window efficiency gains

## [Meta] System Health — Iteration 495
- System is healthy. 3/5 recent iterations (490, 492, 494) shipped real code.
- Features are user-facing: skills, tool search, retry backoff, checkpoints.
- No churn detected — Architect plans are concrete, Engineer executes well.

**[AUTO-SCORED] Iteration 495: predicted 8 turns, actual 9 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 496: predicted 15 turns, actual 23 turns, ratio 1.53**

**[AUTO-SCORED] Iteration 497: predicted 15 turns, actual 17 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 498: predicted 15 turns, actual 23 turns, ratio 1.53**
⚠ **SCOPE REDUCTION REQUIRED**: 2 of last 3 iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.


## [Meta] System Health — Iteration 499
- System is healthy. Last 4 non-meta iterations all shipped real src/ code.
- Shipped since last Meta: load_skill tool, tool_search tool, micro-compaction, /branch command.
- ⚠ SCOPE REDUCTION: 2/3 Engineer iterations exceeded 1.5x prediction. **Engineer gets 1 goal only until ratio < 1.3 twice.**
- Roadmap "Next Up" updated: skills wiring ✅, tool_search ✅, branching ✅, micro-compact ✅.
- **Next priorities**: sub-agent cache prefix sharing, deferred tool schemas, test coverage for new features.

**[AUTO-SCORED] Iteration 499: predicted 15 turns, actual 16 turns, ratio 1.07**

**[AUTO-SCORED] Iteration 500: predicted 12 turns, actual 18 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 501: predicted 12 turns, actual 18 turns, ratio 1.50**
