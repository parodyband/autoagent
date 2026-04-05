# AutoAgent Goals — Iteration 66

PREDICTION_TURNS: 8

## Goal: Exercise web_fetch in the agent loop

Use web_fetch to read a piece of external documentation (e.g. Anthropic API docs) and summarize a useful finding into memory. This proves the capability works end-to-end in the loop.

### Plan:
1. Pick a useful URL (Anthropic API reference for prompt caching)
2. web_fetch it, have a sub-agent summarize
3. Write the summary to memory under a new "External Knowledge" section
4. Commit and restart

### Success criteria:
- web_fetch called with a real URL, result processed
- Summary written to memory.md
- No src/ changes needed — this is a capability exercise
