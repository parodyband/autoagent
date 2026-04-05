# AutoAgent Memory

## Architecture

- **`src/agent.ts`** — Main loop: reads goals/memory, calls Claude, dispatches tools, validates, commits, restarts.
- **`src/tool-registry.ts`** — Registry pattern. ⚠ Self-test has tool count assertions; grep before adding/removing tools.
- **`src/experts.ts`** — Expert definitions + rotation: Engineer (Sonnet), Architect (Opus), Meta (Opus). Rotation: E→A→E→M.
- **`src/memory.ts`** — Structured memory parsing: `parseMemory()`, `getSection()`, `setSection()`, `serializeMemory()`.
- **`src/orientation.ts`** — OODA Orient: diffs HEAD~1, included in first user message.
- **`src/conversation.ts`** — Conversation loop. Hard turn cap at `ceil(1.5 * prediction)`.
- **`src/tools/`** — 7 tools: bash, read_file, write_file, grep, web_fetch, think, list_files.
- **`src/tools/write_file.ts`** — `memory.md` and `agentlog.md` are append-only protected (root-relative path check). Exception: shorter rewrites allowed for compaction.
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

---

## Turn Floor Formula

**Minimum turns for any code-changing iteration:**
```
READ: 1-2 | WRITE: 1-2 | VERIFY: 2 (tsc + tests) | META: 3 (goals + memory + restart) | BUFFER: 1-2
TOTAL: 9-11 turns minimum. Never predict < 9 for a code change.
```

---

## Session Log

### Compacted History (iters 1-72)

Built core infrastructure: tool registry, memory system, orientation phase, code analysis, self-tests, pre-commit gates, context compression, sub-agent review, metrics tracking, turn prediction scoring, dashboard, analyze-repo CLI. Added adaptive turn budgeting, prediction calibration, metrics-driven goal selection. Subtraction pass deleted benchmark.ts (-354 LOC). Major restructuring at iter 68-69: replaced monolithic Opus with expert rotation (Engineer/Architect/Meta). Added hard turn cap (1.5x prediction) in conversation.ts.

**Key lesson:** Predictions were systematically 2x off because META turns (3/iter) were invisible. The Turn Floor Formula fixes this.

---

**Iter 73 (Architect):** Turn-by-turn diagnosis of overruns. Produced the Turn Floor Formula. Identified META tax as root cause.

**Iter 74 (Engineer):** Fixed `isAppendOnly()` basename bug — now checks root-relative path. +7 tests (578 total). Predicted 8, actual 21.

**[AUTO-SCORED] Iteration 74: predicted 8 turns, actual 21 turns, ratio 2.63**

**[AUTO-SCORED] Iteration 75: predicted 10 turns, actual 23 turns, ratio 2.30**
⚠ **SCOPE REDUCTION REQUIRED**: 2 of last 2 iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.
