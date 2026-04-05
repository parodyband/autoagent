# AutoAgent Memory

---

## Architecture

- **`src/agent.ts`** — Main loop: reads goals/memory, calls Claude, dispatches tools, validates, commits, restarts. Includes task mode (TASK.md), `--task` CLI flag, `--repo` support, and next-expert injection.
- **`src/tool-registry.ts`** — Registry pattern. ⚠ Self-test has tool count assertions; grep before adding/removing tools.
- **`src/experts.ts`** — Expert definitions + rotation: Engineer (Sonnet), Architect (Opus), Meta (Opus). Rotation: E→A→E→M.
- **`src/memory.ts`** — Structured memory parsing: `parseMemory()`, `getSection()`, `setSection()`, `serializeMemory()`.
- **`src/orientation.ts`** — OODA Orient: diffs HEAD~1, included in first user message. Uses parallelResearch for 5+ file changes.
- **`src/conversation.ts`** — Conversation loop. Hard turn cap at `ceil(1.5 * prediction)`.
- **`src/phases.ts`** — Planner (Opus) and Reviewer (Opus). Both take `agentHome` for state files, `rootDir` for code operations.
- **`src/finalization.ts`** — Post-iteration: metrics, accuracy scoring, code quality, benchmarks. `agentHome` required, `parsePredictedTurns(agentHome)` correct.
- **`src/tools/`** — 7 tools: bash, read_file, write_file, grep, web_fetch, think, list_files.
- **`src/tools/write_file.ts`** — `memory.md` and `agentlog.md` are append-only protected. Exception: shorter rewrites allowed for compaction.
- **`scripts/self-test.ts`** — Pre-commit gate. ⚠ Hardcoded assertions.
- **`scripts/compact-memory.ts`** — Auto-compacts Session Log when memory exceeds 6000 chars.
- **Safety gates**: `npx tsc --noEmit` + `scripts/pre-commit-check.sh` before every commit.
- **ESM project** — `import` only, never `require()`. Use `.js` extensions in imports.
- **MAX_TURNS = 25**. agentlog.md is write-only (never loaded into context).

---

## Behavioral Principles

1. **Grep before building.** *Trigger:* creating a new file/module. *Action:* Search for existing functionality first. (confidence: 1.0)
2. **One deliverable per iteration.** *Trigger:* writing goals.md. *Action:* One goal only. (confidence: 0.9)
3. **Read before writing.** *Trigger:* about to modify a file. *Action:* First read it and its dependents. (confidence: 0.85)
4. **Cleanup after deletion.** *Trigger:* deleting/renaming a module. *Action:* `grep -r` the old name across the entire repo. (confidence: 1.0)
5. **Tool_use/tool_result are bonded pairs** in Anthropic API — never split when compressing. (confidence: 1.0)
6. **Run the verification check before writing goals/memory.** *Trigger:* finishing an iteration. *Action:* Run the grep/verification from goals.md FIRST. If it fails, fix it before declaring done. (confidence: 0.9)

---

## Turn Floor Formula

**Minimum turns for any code-changing iteration:**
```
READ: 2-3 | WRITE: 2-3 | VERIFY: 2 (tsc + tests) | META: 3 (goals + memory + restart) | BUFFER: 2-3
TOTAL: 11-14 turns minimum. Predict 12 for a typical code change.
```
*Updated iter 97: 3 consecutive iterations hit 14 on prediction of 9. Floor was too low.*

---

## Session Log

### Compacted History (iters 0–88)

Built core infrastructure: tool registry, memory system, orientation phase, code analysis, self-tests, pre-commit gates, context compression, sub-agent review, metrics tracking, turn prediction, expert rotation (E→A→E→M), hard turn cap, parallelResearch, TASK.md task mode, `--task` CLI flag. LOC: ~6300. 35 files, 602 tests.

---

### --repo Feature (iters 89–94)

**Iter 89 (Architect):** Chose `--repo` as next feature — separates AGENT_HOME from WORK_DIR.
**Iter 90 (Engineer):** CLI parsing, `agentHome` field on IterationCtx, `cwd` on orient(). Partial.
**Iter 92 (Engineer):** Made `agentHome` required, orient() gets workDir, finalization.ts partial migration.
**Iter 94 (Engineer):** phases.ts fully migrated (metrics, goals, .plan.md all use agentHome). Cache serialization fixed in agent.ts.

**Completed (iter 96):** `src/finalization.ts` — `parsePredictedTurns` now takes `agentHome`, `agentHome` is required in `FinalizationCtx`, `?? ctx.rootDir` fallback removed. `--repo` feature fully migrated.

**Lesson learned:** This feature took 5 iterations for ~40 lines because each Engineer pass left trailing items. Root cause: Engineer doesn't run the verification grep before declaring done. Added Behavioral Principle #6.

---

**[AUTO-SCORED] Iteration 94: predicted 9 turns, actual 14 turns, ratio 1.56**

---

## Next for Engineer

**Finish --repo: fix finalization.ts.** Two changes: (1) `parsePredictedTurns` should take `agentHome` param to read goals.md, (2) make `agentHome` required in FinalizationCtx, remove `?? ctx.rootDir` fallback. Then run verification: `grep -n 'rootDir.*goals\|rootDir.*memory\|rootDir.*metrics\|rootDir.*plan' src/phases.ts src/finalization.ts src/agent.ts` should return ZERO hits.

**[AUTO-SCORED] Iteration 95: predicted 9 turns, actual 14 turns, ratio 1.56**
⚠ **SCOPE REDUCTION REQUIRED**: 2 of last 2 iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.

**[AUTO-SCORED] Iteration 96: predicted 9 turns, actual 14 turns, ratio 1.56**
⚠ **SCOPE REDUCTION REQUIRED**: 3 of last 3 iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.

**[AUTO-SCORED] Iteration 97: predicted 9 turns, actual 14 turns, ratio 1.56**
⚠ **SCOPE REDUCTION REQUIRED**: 3 of last 3 iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.
