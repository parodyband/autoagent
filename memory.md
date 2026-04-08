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
- `src/orchestrator.ts` — (~2583 LOC) Agent loop, tool usage tracking (`toolUsageCounts` Map, exposed via `getSessionStats().toolUsage`), tool timing profiling, parallel tools, tiered compaction, file watcher, prompt cache, extended thinking, loop detection, hooks, semantic search, schema validation.
- `src/tool-registry.ts` — (~438 LOC) `searchTools()`, `getDefinitions()`, `getMinimalDefinitions()`, `getSchemaFor()`, `schemaToSignature()`.
- `src/tui-commands.ts` — Slash commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search, /checkpoint, /timing, /sessions (list/search/clear).
- `src/session-history.ts` — Session recording with `recordSession`, `getRecentSessions`, `searchSessions`, `clearSessionHistory`.
- `src/tui.tsx` — Ink/React TUI (~1000 LOC). Command history, Ctrl+R reverse-search, context indicator.
- `src/task-planner.ts` — DAG-based task decomposition.
- `src/tool-recovery.ts` — (400 LOC) Error classification + retryWithBackoff.
- `src/skills.ts` — Lazy-loaded `.autoagent/skills/*.md` context system.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/semantic-search.ts` — BM25-based code search.
- **Expert rotation**: BUILTIN_EXPERTS = [ENGINEER, ARCHITECT, ENGINEER, META] → iteration % 4 selects expert.

---

## Completed Features (Recent)
- ✅ `/tools` command with list/stats/search (iter 556)
- ✅ `/branch` save/restore/list (iter 557-558)
- ✅ `/tools` + `/branch` tests (iter 558)
- ✅ `/sessions` command with list/search/clear (iter 552-554)
- ✅ Ctrl+R reverse-search in TUI (iter 538)
- ✅ Command history with up/down arrows (iter 534)
- ✅ Tool performance profiling + /timing command
- ✅ Deferred tool schemas + dispatch validation
- ✅ Skills system, searchTools, tool_search tool
- ✅ Markdown conversation export (/export)
- ✅ Mid-loop auto-compact trigger (iter 530)

---

## Next Up (Priority Order)
1. **`/help` improvements** — group commands by category, show usage examples. Assigned iter 560.
2. **Session annotations** — `/sessions note <text>` appends note to last session.
3. **Tool usage in /status** — surface `getSessionStats().toolUsage` in /status output.

---

## Verified Existing (do NOT re-assign)
- ✅ Context usage indicator — tui.tsx (ContextIndicator, Header, footerStats)
- ✅ /retry command — tui-commands.ts:133
- ✅ Token/cost summary at exit — tui.tsx:679-684
- ✅ Urgency-aware compaction — orchestrator.ts:739-740 and 2291-2293
- ✅ /sessions command — session-history.ts + tui-commands.ts (iter 554)
- ✅ Tool usage tracking in orchestrator — `getSessionStats().toolUsage` (NOT yet surfaced in /status)
- ✅ **RULE: Architect/Meta MUST grep src/ for ANY feature before adding to Next Up.**

---

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**

**[AUTO-SCORED] Iteration 550: predicted 15, actual 12, ratio 0.80**
**[AUTO-SCORED] Iteration 551: predicted 8, actual 10, ratio 1.25**
**[AUTO-SCORED] Iteration 552: predicted 15, actual 23, ratio 1.53**
**[AUTO-SCORED] Iteration 553: predicted 8, actual 8, ratio 1.00**
**[AUTO-SCORED] Iteration 554: predicted 15, actual 13, ratio 0.87**

**[AUTO-SCORED] Iteration 555: predicted 8 turns, actual 8 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 556: predicted 15 turns, actual 23 turns, ratio 1.53**

**[AUTO-SCORED] Iteration 557: predicted 15 turns, actual 14 turns, ratio 0.93**

**[AUTO-SCORED] Iteration 558: predicted 12 turns, actual 16 turns, ratio 1.33**

**[AUTO-SCORED] Iteration 559: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 559: predicted 8 turns, actual 10 turns, ratio 1.25**

**[AUTO-SCORED] Iteration 560: predicted 15 turns, actual 7 turns, ratio 0.47**
