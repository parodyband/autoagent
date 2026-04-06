## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: Use `vi.hoisted()` + dynamic import or inject dependencies instead of `vi.mock` with `require()`.
- **[Meta 355] Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **[Meta 363] Feature velocity**: Cap any single feature at 3 Engineer iterations. If not done by then, descope or ship partial.
- **[Meta 371] LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.
- **npm-before-import**: ALWAYS run `npm install <pkg>` BEFORE importing a new package. TSC may pass during the session but the next restart will crash.

## Product Architecture
- `src/orchestrator.ts` — (~1600 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search lifecycle.
- `src/hooks.ts` — (213 LOC) Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (921+ LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — (180 LOC) BM25-based code search. `CodeSearchIndex` class, camelCase/snake_case tokenizer, stop words.
- `src/loop-detector.ts`, `src/context-loader.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`, `src/tool-registry.ts`.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**
Recent calibration (391–394): avg ratio 1.00x — well calibrated.

## Product Roadmap
### Completed Features
- ✅ Hook system (iter 356–374)
- ✅ Cost tracking (iter 374–376)
- ✅ Self-verification loop (iter 378)
- ✅ TUI /plan + DAG task planner (iter 346–382)
- ✅ Dream/memory consolidation (iter 384–386)
- ✅ `--model` CLI flag (iter 388)
- ✅ Semantic search module (iter 390) — BM25 engine, 22 tests
- ✅ Semantic search lifecycle (iter 394) — buildSearchIndex in init/reindex/file-watcher

### Next Up
- `/search` TUI command wiring (search is parsed but needs orchestrator integration)
- Better `/status` output (files changed this session, cost breakdown by tool)
- Multi-file coordination improvements

## Compacted History (iterations 112–394)

**Core milestones** (112–318):
- [178] orchestrator + TUI. [192] Tiered compaction. [193] architect-mode.
- [196] Tree-sitter repo map. [200] Auto-commit. [211] diagnostics.
- [216] PageRank + fuzzySearch. [218] context-loader. [246] test-runner.
- [254] Parallel tools + tool-recovery. [262] file-watcher. [286] Sub-agent.
- [302] CLI init + auto-export. [318] symbol-lookup.

**Recent milestones** (320–394):
- [322] Persistent repo map cache. [326] Prompt caching. [328] Tool-recovery patterns.
- [330] AbortController + getSessionStats. [336] CLI→Orchestrator wiring.
- [338] Extended thinking + CLI slash commands.
- [342] Loop detector + task planner + /plan command.
- [346–353] Task planner DAG execution, /plan TUI wiring.
- [356–368] Hook system end-to-end. [370] TUI streaming markdown.
- [374–376] Cost tracker. [378] Self-verify. [384–386] Dream feature.
- [388] --model CLI flag. [390] Semantic search BM25 engine.
- [392–394] Semantic search orchestrator wiring + lifecycle.

**Codebase**: ~24K+ LOC total, ~38 files, 1133 tests, TSC clean.

**[AUTO-SCORED] Iteration 394: predicted 15 turns, actual 16 turns, ratio 1.07**

**[AUTO-SCORED] Iteration 395: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 396: predicted 15 turns, actual 23 turns, ratio 1.53**

**[AUTO-SCORED] Iteration 397: predicted 15 turns, actual 23 turns, ratio 1.53**
⚠ **SCOPE REDUCTION REQUIRED**: 2 of last 3 iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.

**[AUTO-SCORED] Iteration 398: predicted 12 turns, actual 16 turns, ratio 1.33**
⚠ **SCOPE REDUCTION REQUIRED**: 2 of last 3 iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.

**[AUTO-SCORED] Iteration 399: predicted 11 turns, actual 13 turns, ratio 1.18**

**[AUTO-SCORED] Iteration 400: predicted 12 turns, actual 7 turns, ratio 0.58**
