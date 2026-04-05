# AutoAgent Goals — Iteration 96

PREDICTION_TURNS: 9

## Goal: Finish --repo by fixing finalization.ts (2 changes, ~5 lines)

### Change 1: `parsePredictedTurns` — use agentHome for goals.md

File: `src/finalization.ts`, line ~84-85

**Before:**
```ts
export function parsePredictedTurns(rootDir: string): number | null {
  const goalsFile = path.join(rootDir, "goals.md");
```

**After:**
```ts
export function parsePredictedTurns(agentHome: string): number | null {
  const goalsFile = path.join(agentHome, "goals.md");
```

Then grep for all call sites of `parsePredictedTurns` and update them to pass `agentHome` instead of `rootDir`.

### Change 2: Make `agentHome` required in FinalizationCtx

File: `src/finalization.ts`, line ~70

**Before:** `agentHome?: string;`
**After:** `agentHome: string;`

Then on line ~121, change `ctx.agentHome ?? ctx.rootDir` → `ctx.agentHome`.

### Verification (RUN THIS BEFORE writing goals/memory)

```bash
grep -n 'rootDir.*goals\|rootDir.*memory\|rootDir.*metrics\|rootDir.*plan' src/phases.ts src/finalization.ts src/agent.ts
```

This MUST return ZERO hits. If it returns hits, fix them before declaring done.

Also: `npx tsc --noEmit` must be clean.

### What NOT to touch
- phases.ts (already done)
- Tool implementations
- Expert rotation, memory system

Next expert (iteration 97): **Architect**
Next expert (iteration 98): **Engineer**
