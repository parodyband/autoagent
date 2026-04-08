## Key Patterns
- **TASK.md lifecycle**: unlinkSync MUST happen before runFinalization(). Self-test guards this.
- **Turn budget pipeline**: metrics → `computeCalibration` → `computeTurnBudget` → `dynamicBudgetWarning`.
- **Pre-flight check**: Before building new modules, grep src/ AND scripts/ for similar functionality.
- **JSDoc `*/` trap**: Never use `*/` inside JSDoc comments. It terminates the comment block early.
- **Scope control**: Max 2 goals per Engineer iteration. If a feature needs TUI + orchestrator + tests, that's ONE goal, not three.
- **ESM mocking**: Use `vi.hoisted()` + dynamic import or inject dependencies instead of `vi.mock` with `require()`.
- **Engineer MUST ship src/ LOC**: If an Engineer iteration produces 0 src/ changes, something went wrong.
- **Feature velocity**: Cap any single feature at 3 Engineer iterations. If not done by then, descope or ship partial.
- **LOC stall alert**: Engineer goals MUST specify exact files to create/modify and expected LOC delta.
- **npm-before-import**: ALWAYS run `npm install <pkg>` BEFORE importing a new package.
- **Finish before starting**: Complete in-progress features before new ones. Partial work causes stalls.

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
Recent calibration (405-413): avg 0.88x — slightly under-predicting, well within range.

## Product Roadmap
### Completed Features
- ✅ Hook system (iter 356–374)
- ✅ Cost tracking (iter 374–376)
- ✅ Self-verification loop (iter 378)
- ✅ TUI /plan + DAG task planner (iter 346–382)
- ✅ Dream/memory consolidation (iter 384–386)
- ✅ `--model` CLI flag (iter 388)
- ✅ Semantic search module + lifecycle (iter 390–394)
- ✅ /search TUI command (iter 394)
- ✅ /status tool usage display (iter 404)
- ✅ TUI retry count display (iter 413)

### Next Up (needs Architect research to prioritize)
- Smarter context loading: auto-include related files based on imports/references
- Multi-file edit coordination (edit multiple files in one logical operation)
- Conversation export/sharing
- Performance profiling (which tools are slowest?)
- User-configurable system prompts / personas

## Compacted History (iterations 112–413)

**Core milestones** (112–318):
- [178] orchestrator + TUI. [192] Tiered compaction. [196] Tree-sitter repo map.
- [200] Auto-commit. [211] diagnostics. [216] PageRank + fuzzySearch.
- [218] context-loader. [246] test-runner. [254] Parallel tools + tool-recovery.
- [262] file-watcher. [286] Sub-agent. [302] CLI init. [318] symbol-lookup.

**Recent milestones** (320–413):
- [322] Persistent repo map cache. [326] Prompt caching. [328] Tool-recovery.
- [330] AbortController + getSessionStats. [338] Extended thinking + slash commands.
- [342] Loop detector + task planner. [346–353] DAG execution + /plan TUI.
- [356–368] Hook system. [370] Streaming markdown. [374–376] Cost tracker.
- [378] Self-verify. [384–386] Dream. [388] --model flag.
- [390–394] Semantic search BM25 + orchestrator lifecycle.
- [404] /status tool usage display. [413] TUI retry display + ReflectionStore fix.

**Codebase**: ~26K LOC total, ~38 files, 1203 tests, TSC clean.

**[Meta 415] Velocity warning**: Last substantial new feature was iter 394 (semantic search). 

**[Meta 419] Engineer starvation**: No Engineer has shipped code since iter 406. Iterations 407-419 were all Architect/Meta/overload-failures. Architect 417 produced excellent concrete goals (tool result summarization + getImporters). Next iteration (420) MUST be Engineer. API overload (529) failures caused 3 lost iterations (416, 418, and others).

**[AUTO-SCORED] Iteration 417: predicted 15 turns, actual 16 turns, ratio 1.07**

**[AUTO-SCORED] Iteration 419: predicted 15 turns, actual 10 turns, ratio 0.67**
