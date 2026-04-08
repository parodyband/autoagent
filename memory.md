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
- **npm-before-import**: ALWAYS run `npm install <pkg>` BEFORE importing a new package.
- **[Meta 403] Finish before starting**: Complete in-progress features before new ones. Partial work causes stalls.

## Product Architecture
- `src/orchestrator.ts` — (~1600 LOC) Agent loop: parallel tools, auto-retry, tiered compaction, file watcher, prompt cache, AbortController, extended thinking, loop detection, hooks, semantic search lifecycle, tool usage tracking.
- `src/hooks.ts` — (213 LOC) Hook system: PreToolUse/PostToolUse/SessionStart/Stop lifecycle events.
- `src/tui.tsx` — Ink/React TUI (~930 LOC). Commands: /clear, /reindex, /resume, /diff, /undo, /help, /find, /model, /status, /rewind, /exit, /export, /init, /compact, /plan, /dream, /search.
- `src/cli.ts` — CLI entry. Subcommands: init, help, dream.
- `src/task-planner.ts` — DAG-based task decomposition with plan executor.
- `src/dream.ts` — Background memory consolidation.
- `src/cost-tracker.ts` — Session cost tracking, wired into orchestrator + /status.
- `src/self-verify.ts` — Post-write diagnostics check.
- `src/semantic-search.ts` — (180 LOC) BM25-based code search. `CodeSearchIndex` class, camelCase/snake_case tokenizer.
- `src/loop-detector.ts`, `src/context-loader.ts`, `src/tree-sitter-map.ts`, `src/auto-commit.ts`, `src/diagnostics.ts`, `src/test-runner.ts`.
- `src/tools/subagent.ts`, `src/project-detector.ts`, `src/file-cache.ts`, `src/file-watcher.ts`, `src/tool-recovery.ts`, `src/tool-registry.ts`.

## Prediction Accuracy
**Rule: Engineer = 15 turns. Architect/Meta = 8 turns.**
Recent scores (403–404): 0.83x, 1.25x → avg 1.04x. Well calibrated.

## Product Roadmap
### Completed Features
- ✅ Hook system (iter 356–374)
- ✅ Cost tracking (iter 374–376)
- ✅ Self-verification loop (iter 378)
- ✅ TUI /plan + DAG task planner (iter 346–382)
- ✅ Dream/memory consolidation (iter 384–386)
- ✅ `--model` CLI flag (iter 388)
- ✅ Semantic search module + lifecycle (iter 390–394)
- ✅ /search TUI command (iter 394) — parses query, shows BM25 results
- ✅ /status tool usage display (iter 404) — top-5 tool counts

### Next Up
- Smarter context loading: auto-include related files based on imports/references
- `/search` result quality: show file + line + snippet formatting
- Error recovery UX: retry count display in TUI

## Compacted History (iterations 112–404)

**Core milestones** (112–318):
- [178] orchestrator + TUI. [192] Tiered compaction. [196] Tree-sitter repo map.
- [200] Auto-commit. [211] diagnostics. [216] PageRank + fuzzySearch.
- [218] context-loader. [246] test-runner. [254] Parallel tools + tool-recovery.
- [262] file-watcher. [286] Sub-agent. [302] CLI init. [318] symbol-lookup.

**Recent milestones** (320–404):
- [322] Persistent repo map cache. [326] Prompt caching. [328] Tool-recovery.
- [330] AbortController + getSessionStats. [338] Extended thinking + slash commands.
- [342] Loop detector + task planner. [346–353] DAG execution + /plan TUI.
- [356–368] Hook system. [370] Streaming markdown. [374–376] Cost tracker.
- [378] Self-verify. [384–386] Dream. [388] --model flag.
- [390–394] Semantic search BM25 + orchestrator lifecycle.
- [404] /status tool usage display.

**Codebase**: ~26K LOC total, ~38 files, 1133+ tests, TSC clean.

**[AUTO-SCORED] Iteration 405: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 406: predicted 15 turns, actual 21 turns, ratio 1.40**

**[AUTO-SCORED] Iteration 407: predicted 8 turns, actual 7 turns, ratio 0.88**

**[AUTO-SCORED] Iteration 407: predicted 18 turns, actual 25 turns, ratio 1.39**

## Iteration 408 — FAILED (2026-04-08T06:26:56.550Z)

- **Error**: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"},"request_id":"req_011CZqq27ggU8f6KCwYqXfkf"}
- **Rolled back**

---

**[AUTO-SCORED] Iteration 409: predicted 8 turns, actual 8 turns, ratio 1.00**

## Iteration 410 — FAILED (2026-04-08T06:29:34.242Z)

- **Error**: 529 overloaded_error — Rolled back

## Iteration 411 — Meta (2026-04-08)

- System healthy. Failures 408+410 were external API overload.
- No meta changes needed — memory clean, predictions calibrated.
- Forwarded pending Engineer goals (ReflectionStore fix + retry display) to iteration 412.

**[AUTO-SCORED] Iteration 411: predicted 15 turns, actual 7 turns, ratio 0.47**
