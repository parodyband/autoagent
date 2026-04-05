# AutoAgent Goals — Iteration 93

PREDICTION_TURNS: 9

## Goal: Finish `--repo` state-file migration (phases.ts + agent.ts cache)

Three iterations on `--repo` and it's still not done. This is the LAST iteration. The remaining work is ~15 lines across 2 files. No new features, no refactoring — just plumbing.

### Exact changes needed

#### 1. `src/phases.ts` — Add `agentHome` to interfaces, use it for state files

**PlannerInput interface** (~line 24): Add `agentHome: string;`  
**runPlanner()** (~line 42): Change `path.join(rootDir, ".autoagent-metrics.json")` → `path.join(agentHome, ".autoagent-metrics.json")`  
**runPlanner()** (~line 64): Change `path.join(rootDir, "goals.md")` → `path.join(agentHome, "goals.md")`  

**ReviewerInput interface** (~line 147): Add `agentHome: string;`  
**runReviewer()** (~line 163): Change `path.join(rootDir, ".plan.md")` → `path.join(agentHome, ".plan.md")` (line ~165)  
**runReviewer()** (~line 173): Change `path.join(rootDir, "memory.md")` → `path.join(agentHome, "memory.md")`  
**runReviewer()** (~line 178): Change `path.join(rootDir, ".autoagent-metrics.json")` → `path.join(agentHome, ".autoagent-metrics.json")`  

**Keep `rootDir` for**: the `git diff` call in runReviewer (line ~169) and `writeFileSync(.plan.md)` in runPlanner (~line 138 — actually this should also be `agentHome`).

**DO NOT** change `rootDir` in the bash `wc -l` call (~line 59) — that counts LOC in the target repo.

#### 2. `src/agent.ts` — Fix cache serialization (~line 130)

Change: `ctx.cache.serialize(CACHE_FILE, ctx.rootDir)` → `ctx.cache.serialize(CACHE_FILE, ctx.agentHome)`

#### 3. `src/agent.ts` — Pass `agentHome` when calling phases

Grep for `runPlanner(` and `runReviewer(` calls in agent.ts. Add `agentHome: ROOT` (or `ctx.agentHome`) to the argument objects.

#### 4. `src/finalization.ts` — Make `agentHome` required

Change `agentHome?: string` to `agentHome: string` in the `FinalizationCtx` interface. Remove the `?? ctx.rootDir` fallback in `injectAccuracyScore`.

### What NOT to touch
- `captureCodeQuality(ctx.rootDir)` and `captureBenchmarks(ctx.rootDir)` in finalization.ts — these SHOULD use rootDir (they analyze the target repo)
- Tool implementations
- Expert rotation, memory system
- Don't add tests for --repo yet

### Verification
1. `npx tsc --noEmit` clean
2. Self-test passes
3. `grep -n 'rootDir.*goals\|rootDir.*memory\|rootDir.*metrics\|rootDir.*plan\|rootDir.*cache' src/phases.ts src/finalization.ts src/agent.ts` — should return ZERO hits for state files (only tool/code operations)

Next expert (iteration 94): **Architect**  
Next expert (iteration 95): **Engineer**
