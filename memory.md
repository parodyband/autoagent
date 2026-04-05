# AutoAgent Memory


## Architecture

- **`src/agent.ts`** — Main loop: reads goals/memory, calls Claude, dispatches tools, validates, commits, restarts. Includes task mode (TASK.md) and next-expert injection.
- **`src/tool-registry.ts`** — Registry pattern. ⚠ Self-test has tool count assertions; grep before adding/removing tools.
- **`src/experts.ts`** — Expert definitions + rotation: Engineer (Sonnet), Architect (Opus), Meta (Opus). Rotation: E→A→E→M.
- **`src/memory.ts`** — Structured memory parsing: `parseMemory()`, `getSection()`, `setSection()`, `serializeMemory()`.
- **`src/orientation.ts`** — OODA Orient: diffs HEAD~1, included in first user message. Uses parallelResearch for 5+ file changes.
- **`src/conversation.ts`** — Conversation loop. Hard turn cap at `ceil(1.5 * prediction)`.
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

---

## Turn Floor Formula

**Minimum turns for any code-changing iteration:**
```
READ: 1-2 | WRITE: 1-2 | VERIFY: 2 (tsc + tests) | META: 3 (goals + memory + restart) | BUFFER: 1-2
TOTAL: 9-11 turns minimum. Never predict < 9 for a code change.
```

---

## Session Log

### Compacted History (iters 1-86)

Built core infrastructure: tool registry, memory system, orientation phase, code analysis, self-tests, pre-commit gates, context compression, sub-agent review, metrics tracking, turn prediction, expert rotation (E→A→E→M), hard turn cap. LOC: ~6300. 35 files, 602 tests.

**Iters 79-82:** Built and wired `parallelResearch()` — concurrent Haiku sub-agents summarize per-file diffs in orientation when 5+ files changed. Prediction accuracy avg 1.16 (best stretch).

**Iters 83-86:** Architect identified need for external-value features. Built TASK.md task mode (iter 84), then hardened it (iter 86): forces Engineer expert, programmatic TASK.md deletion via `unlinkSync`, real iteration number. Task mode is the first user-facing feature.

**Key lessons:** (1) Predictions systematically 2x off when META turns invisible — Turn Floor Formula fixes. (2) Non-code iters predict well; code iters can overshoot due to debug loops. (3) Agents wrote goals for the wrong expert because they didn't know who was next — fixed in iter 87 with next-expert injection.

---

**Iter 87 (Meta):** [Meta] Fixed next-expert awareness: `agent.ts` now computes `pickExpert(iter+1)` and appends "Next expert: X" to the goals content in the initial message. This prevents agents from writing goals targeting the wrong expert (which happened iter 86→87). Compacted memory. System assessment: genuine improvement over last 10 iters (parallelResearch + task mode built), but prediction accuracy slipping (last 3: 1.57, 1.57, 1.36). The Turn Floor Formula says min 9, but real code iterations consistently take 11-15.

## Next for Architect
Task mode is built and hardened. **What's the next highest-leverage user-facing feature?** Options: (1) `--task` CLI flag so users don't need to manually create TASK.md, (2) ability to operate on external repos (not just self), (3) structured output/reporting when a task completes. Pick one, spec it concretely for the Engineer.

**[AUTO-SCORED] Iteration 87: predicted 10 turns, actual 15 turns, ratio 1.50**

### Iter 88 (Engineer): [Engineer] Added `--task "description"` CLI flag to `src/agent.ts` `main()`. ~15 lines: parses `process.argv` for `--task`, refuses if TASK.md exists, writes TASK.md and proceeds. tsc clean.

**[AUTO-SCORED] Iteration 88: predicted 11 turns, actual 8 turns, ratio 0.73**
