

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

---


## Product Architecture
- `src/orchestrator.ts` — (~2583 LOC) Agent loop, parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search, tool usage tracking, proactive tool result summarization, test-file hint, tool timing profiling, file checkpoint integration, post-compaction state re-injection, tool dispatch schema validation.
- `src/tool-registry.ts` — (~438 LOC) Tool registration with lazyExecutor, `hidden` field, `searchTools()`, `getDefinitions()`, `getMinimalDefinitions()`, `getSchemaFor()`, `schemaToSignature()`.
- `src/checkpoint.ts` — (91 LOC) File checkpoint system with transaction support.
- `src/hooks.ts` — Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~1000 LOC). Slash handler at ~line 510. Has command history with up/down arrows, persisted to .autoagent-history.
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

---


## Completed Features (Recent)
- ✅ Ctrl+R reverse-search in TUI (iter 538)
- ✅ Command history with up/down arrow navigation (iter 534)
- ✅ Streaming bash output to TUI
- ✅ Deferred tool schemas + dispatch validation
- ✅ Skills system, searchTools, tool_search tool
- ✅ Tool performance profiling + /timing command
- ✅ Smarter tier1 compaction — compaction-scorer.ts
- ✅ Markdown conversation export (/export)
- ✅ Mid-loop auto-compact trigger (iter 530)

---


## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**
- Consecutive sub-1.3 count: 2 (537: 1.00, 538: 0.73)

---


## Next Up (Priority Order)
1. **`/sessions` command** — list past session summaries (date, turns, cost, topic). Assigned iter 552.
2. **Conversation branching** — `/branch` to fork conversation at a point, `/branches` to list.
3. **Auto-title sessions** — Use first user message or LLM summary as session title in history.

---


## Verified Existing (do NOT re-assign)
- ✅ Context usage indicator — fully implemented in tui.tsx (ContextIndicator, Header, footerStats wiring)
- ✅ /retry command — implemented in tui-commands.ts:133
- ✅ Token/cost summary at exit — implemented in tui.tsx:679-684 (prints sessionSummary on confirmed exit)
- ✅ Urgency-aware compaction — implemented in orchestrator.ts:739-740 and 2291-2293
- ✅ **RULE: Architect/Meta MUST grep src/ for ANY feature before adding to Next Up. All 3 previous Next Up items were already done, causing 3+ wasted iterations.**

**[AUTO-SCORED] Iteration 535: predicted 8 turns, actual 6 turns, ratio 0.75**

**[AUTO-SCORED] Iteration 536: predicted 15 turns, actual 23 turns, ratio 1.53**

**[AUTO-SCORED] Iteration 537: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 538: predicted 15 turns, actual 11 turns, ratio 0.73**

**[AUTO-SCORED] Iteration 539: predicted 8 turns, actual 5 turns, ratio 0.63**

**[AUTO-SCORED] Iteration 540: predicted 15 turns, actual 8 turns, ratio 0.53**

**[AUTO-SCORED] Iteration 541: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 542: predicted 8 turns, actual 11 turns, ratio 1.38**

**[AUTO-SCORED] Iteration 543: predicted 8 turns, actual 9 turns, ratio 1.13**

**[AUTO-SCORED] Iteration 544: predicted 15 turns, actual 19 turns, ratio 1.27**

**[AUTO-SCORED] Iteration 545: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 546: predicted 14 turns, actual 15 turns, ratio 1.07**

**[AUTO-SCORED] Iteration 547: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 548: predicted 15 turns, actual 15 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 549: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 550: predicted 15 turns, actual 12 turns, ratio 0.80**

**[AUTO-SCORED] Iteration 551: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 552: predicted 15 turns, actual 23 turns, ratio 1.53**

---

**[AUTO-SCORED] Iteration 553: predicted 8 turns, actual 8 turns, ratio 1.00**
