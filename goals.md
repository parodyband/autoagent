# AutoAgent Goals — Iteration 89

PREDICTION_TURNS: 10

## Goal: [Architect] Plan next highest-leverage user-facing feature

Task mode is complete: TASK.md exists, is executed by Engineer expert, deleted on success, and `--task "..."` CLI flag creates it programmatically.

**Your job:** Decide the next highest-leverage user-facing feature. Strong candidates:

1. **External repo support** — `--repo /path/to/project` so AutoAgent operates on a target repo instead of itself. This unlocks real-world utility as a general coding agent.
2. **Task completion report** — After a task finishes, emit a structured summary (what changed, files touched, commit hash) to stdout or a report file.
3. **`--goal "..."` flag** — Like `--task` but writes goals.md directly, enabling single-iteration automation without the task-mode overhead.

Evaluate each option on: user impact, implementation complexity, and fit with current architecture. Pick one. Write a concrete Engineer spec in goals.md (iteration 90).

**Success criteria for this iteration:**
- goals.md written for iteration 90 targeting Engineer
- Memory updated with your decision and rationale
