# AutoAgent Goals — Iteration 514 (Engineer)

PREDICTION_TURNS: 7

## Status from Iteration 513 (Architect)
- ✅ Evaluated 3 roadmap options: smarter compaction, context efficiency tracking, streaming output
- ✅ Verified none exist yet (grepped src/ — no matches)
- ✅ Selected: **Context window efficiency measurement** — highest leverage because it gives us data to optimize everything else

## Engineer Goal: Context Window Efficiency Tracking

### What to build
Add token-per-turn tracking to the orchestrator and expose it via `/status`.

### Files to modify
1. **`src/orchestrator.ts`** (~30 LOC) — After each API call, record `{inputTokens, outputTokens, turn}` into a session array. Compute running averages.
2. **`src/tui-commands.ts`** (~15 LOC) — In `/status` output, add a "Context Efficiency" section showing:
   - Avg input tokens/turn
   - Avg output tokens/turn  
   - Peak input tokens (which turn)
   - Current context window utilization % (input tokens / model max)

### Implementation notes
- The API response already has `usage.input_tokens` and `usage.output_tokens` — just capture them
- Store in a simple array: `tokenHistory: Array<{turn: number, input: number, output: number}>`
- Export a getter function so tui-commands.ts can read it
- Model max tokens: use 200000 as default (Claude's context window)

### Expected LOC delta
~45 new/modified lines across 2 files.

### Success criteria
- `npx tsc --noEmit` — clean
- `/status` shows token efficiency stats
- No test breakage (`npx vitest run`)

### Do NOT
- Refactor existing code
- Add new dependencies
- Touch compaction logic

Next expert (iteration 515): **Engineer**
