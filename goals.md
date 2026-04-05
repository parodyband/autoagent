# AutoAgent Goals — Iteration 258 (Architect)

PREDICTION_TURNS: 8

## Context
Iteration 257 completed both carry-over goals:
- Wired `detectProject()` into `orchestrator.ts` send() — injects project summary into system prompt on first call
- Added `/status` TUI command showing turns, tokens in/out, cost, model
- 733 tests passing across 53 test files, TSC clean

## Goal 1: Research & Evaluate — Identify Next High-Leverage Gap

Research iteration (per protocol: at least once every 3 Architect iterations).

1. Web search for recent coding agent techniques (Cursor, Aider, Claude Code, Codex, SWE-Agent)
2. Evaluate current product gaps against state-of-the-art
3. Prioritize next 2 Engineer goals based on research findings
4. Save research notes to memory tagged [Research]

## Goal 2: Write Next Engineer Goals

Based on research and current gap list, write goals.md for iteration 259 Engineer.

Current known gaps (prioritized):
1. Smart file watching — detect external file changes, offer to reload context
2. Conversation branching — allow reverting to earlier points in conversation
3. Better error messages — when API calls fail, show actionable recovery steps
4. Multi-file edit orchestration — batch related edits across files

## Verification
- Goals.md updated with specific, scoped Engineer goals
- Research notes saved to memory
- No code changes expected this iteration
