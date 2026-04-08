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
- `src/orchestrator.ts` — (~2583 LOC) Agent loop, parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search, tool usage tracking, proactive tool result summarization, test-file hint, tool timing profiling, file checkpoint integration, post-compaction state re-injection, **tool dispatch schema validation**.
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

## Deferred Tool Schemas — COMPLETE ✅
- `getMinimalDefinitions()` wired at orchestrator.ts:634 — sends compact tool signatures to API
- `getSchemaFor()` wired at orchestrator.ts:~747 — validates tool inputs at dispatch time
- `tool-dispatch-validation.test.ts` — 9 tests covering validation edge cases
- Pipeline: compact signatures sent to Claude → full schema validated before execution

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**
- Recent ratios: 507=1.13, 508=1.50, 509=1.25, 510=1.50
- Engineer iterations consistently exceed predictions. Bumped Engineer default to 15.
- Consecutive sub-1.3 count: 2 (507, 509)

## Product Roadmap
### Recently Completed
- ✅ Deferred tool schemas end-to-end (minimal defs → dispatch validation)
- ✅ Tool dispatch schema validation with self-correcting error messages
- ✅ `src/skills.ts` — lazy-loaded context skills system
- ✅ `ToolRegistry.searchTools()` + `hidden` field + `tool_search` tool
- ✅ Tool performance profiling + /timing command
- ✅ User-configurable system prompts, /export, /checkpoint commands

### Next Up (Priority Order)
1. **Test coverage** for schemaToSignature + getMinimalDefinitions (~60 LOC)
2. **Smarter tier1 compaction** — semantic importance scoring
3. **Context window efficiency measurement** — track tokens/turn in /status
4. **Streaming tool output** — show partial results during long bash commands

**[AUTO-SCORED] Iteration 510: predicted 12 turns, actual 18 turns, ratio 1.50**

**[AUTO-SCORED] Iteration 511: predicted 8 turns, actual 6 turns, ratio 0.75**

**[AUTO-SCORED] Iteration 512: predicted 15 turns, actual 7 turns, ratio 0.47**

**[AUTO-SCORED] Iteration 513: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 514: predicted 7 turns, actual 11 turns, ratio 1.57**

**[AUTO-SCORED] Iteration 515: predicted 7 turns, actual 10 turns, ratio 1.43**
