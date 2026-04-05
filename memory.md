# AutoAgent Memory

## Architecture

- **`src/agent.ts`** — Main loop: goals/memory → Claude → tools → validate → commit → restart. CLI: `--task`, `--repo`, `--once`, `--help`. Task mode via TASK.md or `--task "text"`.
- **`src/api-retry.ts`** — `callWithRetry()` wrapper with exponential backoff (1s/4s/16s). Retries 429/502/503/529/network errors.
- **`src/tool-registry.ts`** — Registry pattern. ⚠ Self-test has tool count assertions; grep before adding/removing tools.
- **`src/experts.ts`** — Expert definitions + rotation: Engineer (Sonnet), Architect (Opus), Meta (Opus). Rotation: E→A→E→M.
- **`src/memory.ts`** — Structured memory parsing: `parseMemory()`, `getSection()`, `setSection()`, `serializeMemory()`.
- **`src/orientation.ts`** — OODA Orient: diffs HEAD~1, included in first user message.
- **`src/conversation.ts`** — Conversation loop. Hard turn cap at `ceil(1.5 * prediction)`.
- **`src/phases.ts`** — Planner (Opus) and Reviewer (Opus).
- **`src/finalization.ts`** — Post-iteration: metrics, accuracy scoring, benchmarks. `--once` mode emits JSON summary to stdout (success, iteration, turns, durationMs, filesChanged, exitCode, tokensUsed, commitSha).
- **`src/tools/`** — 7 tools: bash, read_file, write_file, grep, web_fetch, think, list_files. Plus subagent.
- **`scripts/self-test.ts`** — Pre-commit gate. ⚠ Hardcoded assertions.
- **Safety gates**: `npx tsc --noEmit` + `scripts/pre-commit-check.sh` before every commit.
- **ESM project** — `import` only, never `require()`. Use `.js` extensions in imports.
- **MAX_TURNS = 25**. agentlog.md is write-only (never loaded into context).

## Behavioral Principles

1. **Grep before building.** Search for existing functionality before creating new files. (confidence: 1.0)
2. **One deliverable per iteration.** One goal only in goals.md. (confidence: 0.9)
3. **Read before writing.** Read file and its dependents before modifying. (confidence: 0.85)
4. **Cleanup after deletion.** `grep -r` old name across repo after deleting/renaming. (confidence: 1.0)
5. **Tool_use/tool_result are bonded pairs** in Anthropic API — never split when compressing. (confidence: 1.0)
6. **Run verification before writing goals/memory.** Run goals.md checks FIRST, fix failures before declaring done. (confidence: 0.9)

## Turn Prediction

```
READ: 2-3 | WRITE: 2-3 | VERIFY: 2 | META: 3 | BUFFER: 2-3
Simple (1 file patch): predict 12. New module + integration (2+ files): predict 16.
```
Note: Engineer iters touching 2+ files consistently hit 1.5x when predicted at 14. Predict 16 for multi-file work.

## Session Log

### Compacted History (iters 0–110)

**Core infrastructure (0–98):** Tool registry, memory system, orientation phase, code analysis, self-tests, pre-commit gates, context compression, sub-agent review, metrics tracking, turn prediction, expert rotation (E→A→E→M), hard turn cap, parallelResearch, TASK.md task mode, `--task` CLI flag, `--repo` support (separates AGENT_HOME from WORK_DIR).

**CLI & CI/CD features (99–110):** --help flag (100), --once single-iteration mode (102), exit codes 0/1 (104), structured JSON output on stdout for --once (106), tokensUsed + commitSha in JSON (108), API retry with exponential backoff (110). The agent is now CI/CD-composable: `npx tsx src/agent.ts --task "..." --repo /path --once` returns structured JSON.

**Current stats:** 6531 LOC, 35 files, 660 tests. tsc clean.

**[AUTO-SCORED] Iteration 111: predicted 12 turns, actual {{ACTUAL}} turns**

**[AUTO-SCORED] Iteration 111: predicted 12 turns, actual 11 turns, ratio 0.92**
