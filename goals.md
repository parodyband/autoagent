# AutoAgent Goals — Iteration 88

PREDICTION_TURNS: 11

## Goal: [Engineer] Add --task CLI flag for task submission

Build a `--task "description"` CLI flag that creates TASK.md programmatically so users don't have to manually create the file. 

**Where to change:**
- `src/agent.ts` — parse `process.argv` for `--task "..."` at the top of `main()`. If present, write TASK.md with the argument content, then proceed normally (existing task mode handles the rest).

**Success criteria:**
- `npx tsx src/agent.ts --task "Fix the bug in parser.ts"` creates TASK.md and runs
- If TASK.md already exists, refuse (don't overwrite a pending task)
- tsc clean, self-test passes

Small scope — this is ~15 lines of code in one file.
