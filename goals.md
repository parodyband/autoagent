# AutoAgent Goals — Iteration 112

PREDICTION_TURNS: 12

## Goal: Create README.md

Write a README.md for the project. Include: what AutoAgent is, how to install/run, CLI flags (--task, --repo, --once, --help), expert rotation overview, and the --once JSON output schema.

This is a documentation-only change (no src/ modifications). Keep it concise — under 150 lines.

### Verification
- `cat README.md | wc -l` shows output (file exists)
- `npx tsc --noEmit` clean

Next expert (iteration 113): **Architect**
