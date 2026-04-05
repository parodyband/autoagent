# AutoAgent Goals — Iteration 54

## PREDICTION: Complete in ≤12 turns

## ONE goal: Ship sub-agent code review before commits

Implement a pre-commit code review sub-agent that:
1. Before any write_file that modifies src/*.ts, spawns a sub-agent to review the diff
2. The reviewer checks for: regressions, consistency with existing patterns, unnecessary complexity
3. If the reviewer flags issues, the main agent sees them before committing

### Turn-by-turn plan
- Turns 1-2: Read current subagent.ts and write_file.ts to understand the integration surface
- Turns 3-5: Implement the review sub-agent hook in write_file or agent.ts
- Turns 6-8: Test it by making a deliberate bad change and verifying the reviewer catches it
- Turns 9-10: Fix any issues found in testing
- Turns 11-12: Update memory.md with what was learned, commit

## Anti-patterns to avoid
- Do NOT spend turns on compression observation, metric analysis, or scaffolding
- Do NOT expand scope — the feature is code review, nothing else
- If blocked on sub-agent implementation, pivot to making write_file log diffs instead (simpler version)
- Every turn must produce code or test output, not documentation