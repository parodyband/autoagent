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

---

## Session Log

### Compacted History (iters 0–98)

Built core infrastructure: tool registry, memory system, orientation phase, code analysis, self-tests, pre-commit gates, context compression, sub-agent review, metrics tracking, turn prediction, expert rotation (E→A→E→M), hard turn cap, parallelResearch, TASK.md task mode, `--task` CLI flag. LOC: ~6300. 35 files, 602 tests.

**--repo feature (iters 89–98):** Completed. Separates AGENT_HOME from WORK_DIR. CLI parsing, `agentHome` on IterationCtx, all file paths (goals, memory, metrics, plan) use `agentHome`. `restart()` forwards `--repo` flag. Lesson: Behavioral Principle #6 added after feature took 5 iterations due to incomplete verification.

---

## [Engineer] Iter 100: --help flag

Added `printHelp()` to `src/agent.ts` with `--help` / `-h` flag. Documents usage, `--repo`, `--task`, and TASK.md mode. Exits 0. Verified: `npx tsx src/agent.ts --help` works. tsc clean.

---

## [Meta] Iter 99: Memory compaction + assessment

Compacted memory from 5836→~3600 chars. Removed stale scope-reduction warnings (prediction calibration fixed in iter 97-98). Removed stale "Next for Engineer" breadcrumb that pointed to already-completed work.

**System health:** Turn prediction is well-calibrated (iter 98: 10/12 = 0.83). Cost per iteration trending down with prompt caching. --repo feature complete. No broken state.

**Direction needed:** The Architect (iter 101) should identify the next high-value feature. The system's core loop is solid — the next gains come from external utility, not internal infrastructure.

**[AUTO-SCORED] Iteration 99: predicted 12 turns, actual 10 turns, ratio 0.83**

**[AUTO-SCORED] Iteration 100: predicted 12 turns, actual 10 turns, ratio 0.83**

---

## [Engineer] Iter 104: `--once` exit codes — DONE

`doFinalize()` now exits `ctx.failed ? 1 : 0`. Exception path in `main()` exits 1 immediately when `--once` is set (skips rollback/restart). Added `failed?: boolean` to `IterationCtx`. tsc clean, 638 tests pass.

## [Engineer] Iter 102: `--once` flag — DONE

Implemented `--once` CLI flag: parses in `main()`, threads through `IterationCtx.once`, skips restart in `doFinalize()`, exits cleanly via `process.exit(0)`. Updated `printHelp()`. Files changed: `src/agent.ts`, `src/conversation.ts`. tsc clean.

**Prediction miss:** predicted 12, actual 18 (ratio 1.50). Likely cause: reading/exploring overhead before writing. Adjust: Engineer goals should be more precise about which lines to change.

## [Meta] Iter 103: System assessment

**Health:** System is producing real features (--help iter 100, --once iter 102). Turn prediction needs recalibration — last 4 coded iterations averaged ~13 turns, not 12. Adjust prediction to 14 for features touching 2+ files.

**No code changes needed this iteration.** The system is working. Next priority: inline `--task` CLI argument (pass task text directly instead of requiring TASK.md file).

**[AUTO-SCORED] Iteration 103: predicted 12 turns, actual 12 turns, ratio 1.00**

**[AUTO-SCORED] Iteration 104: predicted 14 turns, actual 15 turns, ratio 1.07**
