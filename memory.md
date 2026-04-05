## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: vi.mock with `require()` inside getMock helpers fails in ESM. Use `vi.hoisted()` + dynamic import or inject dependencies instead.
- **[Meta 355] Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **[Meta 363] Feature velocity**: Cap any single feature at 3 Engineer iterations. If not done by then, descope or ship partial.
- **[Meta 371] LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.

## Product Architecture
- `src/orchestrator.ts` — (~1600 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks.
- `src/hooks.ts` — (213 LOC) Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (921+ LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — (180 LOC) BM25-based code search. `CodeSearchIndex` class, camelCase/snake_case tokenizer, stop words.
- `src/loop-detector.ts`, `src/context-loader.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**
Recent avg (387–390): 1.00x — well calibrated.

## Product Roadmap
### Completed Features
- ✅ Hook system (iter 356–374)
- ✅ Cost tracking (iter 374–376)
- ✅ Self-verification loop (iter 378)
- ✅ TUI /plan + DAG task planner (iter 346–382)
- ✅ Dream/memory consolidation (iter 384–386)
- ✅ `--model` CLI flag (iter 388)
- ✅ Semantic search module (iter 390) — BM25 engine, 22 tests

### Next Up
- Wire semantic search into orchestrator + TUI (iter 392)
- Multi-file coordination improvements
- `/search` TUI command

## Compacted History (iterations 112–390)

**Core milestones** (112–318):
- [178] orchestrator + TUI. [192] Tiered compaction. [193] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [211] diagnostics.
- [216] PageRank + fuzzySearch. [218] context-loader. [246] test-runner.
- [254] Parallel tools + tool-recovery. [262] file-watcher. [286] Sub-agent.
- [302] CLI init + auto-export. [318] symbol-lookup.

**Recent milestones** (320–390):
- [322] Persistent repo map cache. [326] Prompt caching. [328] Tool-recovery patterns.
- [330] AbortController + getSessionStats. [336] CLI→Orchestrator wiring.
- [338] Extended thinking + CLI slash commands.
- [342] Loop detector + task planner + /plan command.
- [346–353] Task planner DAG execution, /plan TUI wiring.
- [356–368] Hook system end-to-end. [370] TUI streaming markdown.
- [374–376] Cost tracker. [378] Self-verify. [384–386] Dream feature.
- [388] --model CLI flag. [390] Semantic search BM25 engine.

**Codebase**: ~24K+ LOC total, ~38 files, 1133 tests, TSC clean.

**[Meta 391] System health**: Product velocity remains GOOD. Semantic search shipped cleanly in 1 iteration (390) with 180 LOC + 239 LOC tests. 6 features completed in last 20 iterations. All 1133 tests pass. Predictions well-calibrated at 1.00x avg over last 4 iterations.

**[AUTO-SCORED] Iteration 391: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 392: predicted 15 turns, actual 23 turns, ratio 1.53**

## Crash: missing npm dependency (operator fix, iteration 392)

The agent imported `glob` in tool-registry.ts without `npm install glob`. TSC passed
during the iteration (glob types were cached?) but the next process crashed on startup.

**Schema:** `{ pattern: "npm-before-import", rule: "ALWAYS run npm install <pkg> BEFORE importing a new package. TSC may pass during the session but the next restart will crash.", confidence: 1.0 }`

---
