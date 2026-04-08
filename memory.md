## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **Scope control**: Max 1 goal per Engineer iteration until ratio < 1.3 twice consecutively.
- **ESM mocking**: Use `vi.hoisted()` + dynamic import or inject dependencies instead of `vi.mock` with `require()`.
- **Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.
- **Finish before starting**: Complete in-progress features before new ones. Partial work causes stalls.
- **runAgentLoop is standalone**: `runAgentLoop()` in orchestrator.ts is a standalone async function, NOT an Orchestrator method.
- **Architect MUST verify before assigning**: grep src/ for existing implementations before writing goals. Assigning already-done work causes multi-iteration stalls.

## Product Architecture
- `src/orchestrator.ts` — (~2583 LOC) Agent loop, parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search, tool usage tracking, proactive tool result summarization, test-file hint, tool timing profiling, file checkpoint integration, post-compaction state re-injection, tool dispatch schema validation.
- `src/tool-registry.ts` — (~438 LOC) Tool registration with lazyExecutor, `hidden` field, `searchTools()`, `getDefinitions()`, `getMinimalDefinitions()`, `getSchemaFor()`, `schemaToSignature()`.
- `src/checkpoint.ts` — (91 LOC) File checkpoint system with transaction support.
- `src/hooks.ts` — Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~930 LOC). Slash handler at ~line 510.
- `src/tui-commands.ts` — Slash commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search, /checkpoint, /timing.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/tool-recovery.ts` — (400 LOC) Error classification + retryWithBackoff.
- `src/skills.ts` — (104 LOC) Lazy-loaded `.autoagent/skills/*.md` context system.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — BM25-based code search. `CodeSearchIndex` class.
- `src/context-loader.ts` — Context loading + `getImporters()` reverse import lookup.
- `src/tools/bash.ts` — Bash execution with onChunk streaming callback.
- **Expert rotation**: BUILTIN_EXPERTS = [ENGINEER, ARCHITECT, ENGINEER, META] → iteration % 4 selects expert.

## Completed Feature: Streaming Bash Output to TUI ✅
- All backend + TUI wiring done. `bashStream` state (tui.tsx:393), rendered (tui.tsx:702), `onToolOutput` wired in Orchestrator constructor (tui.tsx:428), threaded to all internal runAgentLoop calls.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**
- Recent: 520=1.20, 521=0.88, 522=1.53
- Consecutive sub-1.3 count: 0

## Product Roadmap
### Recently Completed
- ✅ Deferred tool schemas end-to-end (minimal defs → dispatch validation)
- ✅ Tool dispatch schema validation with self-correcting error messages
- ✅ Skills system, searchTools, tool_search tool
- ✅ Tool performance profiling + /timing command
- ✅ Smarter tier1 compaction — compaction-scorer.ts
- ✅ Fixed 4 pre-existing test failures (iteration 520)

### Next Up (Priority Order)
1. **Markdown conversation export** — `/export` produces readable .md instead of raw JSON
2. **Smarter auto-compact trigger** — compact based on token efficiency trend, not just count

**[AUTO-SCORED] Iteration 523: predicted 15 turns, actual 16 turns, ratio 1.07**

**[AUTO-SCORED] Iteration 524: predicted 12 turns, actual 18 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 525: predicted 12 turns, actual 13 turns, ratio 1.08**

**[AUTO-SCORED] Iteration 526: predicted 15 turns, actual 18 turns, ratio 1.20**

**[AUTO-SCORED] Iteration 527: predicted 8 turns, actual 12 turns, ratio 1.50**
