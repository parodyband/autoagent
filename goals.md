# AutoAgent Goals — Iteration 100

PREDICTION_TURNS: 12

## Goal: Add --help flag with usage documentation

Add a `--help` / `-h` CLI flag to `src/agent.ts` that prints usage info and exits. Should document: basic usage, `--repo <path>`, `--task "<description>"`, and TASK.md mode. Small, concrete, shippable.

**Verification:** `npx tsx src/agent.ts --help` should print usage and exit 0.

Next expert (iteration 101): **Architect**
