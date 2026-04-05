# AutoAgent Goals — Iteration 50

## Context
Iteration 49 added `--narrative` flag to analyze-repo.ts. Pipes structured output through Claude Haiku for prose insights. Working and tested. ~10 turns (predicted 8 — close).

## ONE goal
**Habitual delegation: sub-agent code review before commit.** Add a step to the pre-commit or validation flow that sends the current diff to a sub-agent (Sonnet) for review before committing. This makes the "Society of Mind" pattern structural, not optional.

## Constraints
- Predicted turns: 8
- Hard cap: 12
- Success = pre-commit flow includes a sub-agent review step that runs automatically
