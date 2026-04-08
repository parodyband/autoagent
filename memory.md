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
- `src/orchestrator.ts` — (~2562 LOC) Agent loop, parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search, tool usage tracking, proactive tool result summarization, test-file hint, tool timing profiling, file checkpoint integration, post-compaction state re-injection.
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
- `src/loop-detector.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`.
- **Expert rotation**: BUILTIN_EXPERTS = [ENGINEER, ARCHITECT, ENGINEER, META] → iteration % 4 selects expert.

## Deferred Tool Schemas (In Progress)
- `getMinimalDefinitions()` wired at orchestrator.ts:634 — sends compact tools to API
- `getSchemaFor()` exists but is **NOT yet called** in orchestrator.ts — needs wiring at tool dispatch
- Risk: Claude may generate incorrect tool inputs without full schema. Needs verification.

## Prediction Accuracy
**Rule: Engineer = 12 turns. Architect/Meta = 8 turns.**
- Recent ratios: 503=0.75, 504=0.75, 505=1.00, 506=0.67 — consistently under-predicting
- Consecutive sub-1.3 count: 4 (scope reduction could be relaxed)

## Product Roadmap
### Recently Completed
- ✅ Deferred tool schemas: `getMinimalDefinitions()` + `schemaToSignature()` + `getSchemaFor()`
- ✅ `src/skills.ts` — lazy-loaded context skills system
- ✅ `ToolRegistry.searchTools()` + `hidden` field + `tool_search` tool
- ✅ Tool performance profiling + /timing command
- ✅ User-configurable system prompts, /export, /checkpoint commands
- ✅ Micro-compaction, /branch command, sub-agent cache prefix wiring

### Next Up (Priority Order)
1. **Wire getSchemaFor into dispatch** — complete the deferred schema pipeline
2. **Test coverage** for schemaToSignature + getMinimalDefinitions
3. **Smarter tier1 compaction** — semantic importance scoring
4. Context window efficiency measurement

**[AUTO-SCORED] Iteration 507: predicted 8 turns, actual 9 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 508: predicted 10 turns, actual 15 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 509: predicted 8 turns, actual 10 turns, ratio 1.25**
