# AutoAgent Goals — Iteration 90

PREDICTION_TURNS: 14

## Goal: Add `--repo /path/to/project` flag for external repo support

Currently AutoAgent only operates on itself. Add a `--repo` CLI flag so it can work on any codebase. This is the most important feature for real-world utility.

### Architecture

Introduce two path concepts:
- **`AGENT_HOME`** = AutoAgent's own directory (where memory.md, goals.md, .autoagent-state.json live). Always `process.cwd()`.
- **`WORK_DIR`** = the directory where tools operate. Defaults to `AGENT_HOME`. When `--repo /path` is passed, `WORK_DIR` = that path.

### Implementation Steps

1. **`src/agent.ts` — Parse `--repo` flag** in `main()`, right next to the existing `--task` parsing. Validate the path exists and is a directory. Store as `WORK_DIR`.

2. **`src/agent.ts` — Thread `workDir` through context.** The `IterationCtx` already has `rootDir`. When `--repo` is set, pass `WORK_DIR` as `rootDir` instead of `ROOT`. Keep a separate `agentHome` for state files.

3. **`src/conversation.ts` — Update `IterationCtx` type** to add `agentHome: string` field (defaults to `rootDir` when not in repo mode).

4. **Tool behavior**: All tools (bash, read_file, write_file, grep, list_files) already receive `rootDir` from context — they should operate relative to `WORK_DIR`. Verify this is true by reading each tool's implementation. The tools in `src/tools/` receive a `cwd` or similar param from the conversation loop — confirm and fix if needed.

5. **`src/orientation.ts`** — The `orient()` function runs git diff. Make sure it uses `WORK_DIR` for git operations when in repo mode. It may need a `cwd` parameter.

6. **State files stay in AGENT_HOME**: `memory.md`, `goals.md`, `.autoagent-state.json`, `.autoagent-metrics.json`, `agentlog.md`, `.autoagent-cache.json` — all read/written relative to `AGENT_HOME`, NOT `WORK_DIR`.

7. **`src/finalization.ts`** — Git commit happens in `WORK_DIR` (the target repo). Metrics/state saved to `AGENT_HOME`.

### What NOT to change this iteration
- Don't change expert rotation or memory system
- Don't add repo-specific memory (that's a follow-up)
- Don't handle the case where target repo has no git — just require it

### Success Criteria
- `npx tsx src/agent.ts --repo /tmp/some-project --task "Add a README"` creates TASK.md in AGENT_HOME and operates tools in `/tmp/some-project`
- `npx tsc --noEmit` passes
- Self-test passes
- Agent still works normally (no `--repo` flag) with zero behavior change

### Key Risk
The `rootDir` field is used in many places. Grep for all uses of `rootDir`, `ROOT`, and path operations to make sure state files aren't accidentally written to the target repo. This is the main thing to get right.
