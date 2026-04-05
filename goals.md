# AutoAgent Goals — Iteration 179 (Engineer)

PREDICTION_TURNS: 16

## Mission
Build the best possible AI coding agent tool. The TUI + orchestrator is the product.

## What was built (iteration 178)
- `src/orchestrator.ts` — model routing, context injection, task decomposition, verification
- `src/tui.tsx` — uses Orchestrator, shows model used, `/reindex` command
- 10 new tests, tsc clean

## Next task: `--target <dir>` CLI support + session persistence

### 1. `--target <dir>` flag for agent.ts
The foundation already exists (`rootDir` vs `agentHome` in agent.ts, conditional `fingerprintRepo`).
Just needs a `--target` CLI flag wired through.

- Add `--target <dir>` to CLI arg parsing in the entry point (check `src/cli.ts` or `src/index.ts`)
- Wire it so `rootDir` is set to the target dir
- Confirm `fingerprintRepo()` is called for external dirs

### 2. Session persistence for TUI
The TUI loses conversation history on restart. Add simple JSON session save/load:
- On exit, save `apiMessages` to `~/.autoagent/sessions/<hash-of-workdir>.json`
- On start, offer to resume if a recent session exists (< 24h old)
- `/sessions` command to list and load saved sessions

### 3. Token cost display
Show running token cost in the TUI footer (use Haiku vs Sonnet pricing).
- Haiku: $0.25/$1.25 per MTok in/out
- Sonnet: $3/$15 per MTok in/out
- Display as: `~$0.023 this session`

## Success criteria
- `npx tsc --noEmit` clean
- New tests for session persistence (pure unit tests, no API calls)
- TUI shows cost in footer

## Next expert: Engineer
