# Turn-by-Turn Analysis: Iteration 50 (22 turns)

## Goal
Diagnose why iterations consistently take 22 turns regardless of task scope.

## Raw data

Iterations 48-50 all completed in exactly 22 turns despite different scopes:
- Iter 48 (predicted 8): Sub-agent code review infrastructure
- Iter 49 (predicted 10): `--narrative` flag for analyze-repo  
- Iter 50 (predicted 15): Accuracy scoring injection

## Turn-by-turn breakdown: Iteration 50

| Turn | Action | Category |
|------|--------|----------|
| 1 | Read .autoagent-metrics.json + .autoagent-state.json | ESSENTIAL (orient) |
| 2 | Summarize metrics data | ESSENTIAL (orient) |
| 3 | Think: analyze the problem | ESSENTIAL (plan) |
| 4 | Grep agent.ts for relevant code (2 greps) | ESSENTIAL (read before write) |
| 5 | Read finalization.ts | ESSENTIAL (read before write) |
| 6 | Think: plan approach | ESSENTIAL (plan) |
| 7 | Read goals.md + memory.md | ESSENTIAL (context) |
| 8 | Think: detailed plan | MARGINAL (3rd think, could merge with turn 6) |
| 9 | Grep conversation.ts | ESSENTIAL (find related code) |
| 10 | Grep agent.ts for progressCheckpoint | WASTE (narrow re-search; should have searched broadly in turn 9) |
| 11 | **Read finalization.ts AGAIN** | **WASTE** (already read 6 turns ago) |
| 12 | Write patch to finalization.ts | ESSENTIAL (core work) |
| 13 | **Read finalization.ts AGAIN** | **WASTE** (just patched it 1 turn ago) |
| 14 | Write patch to finalization.ts | ESSENTIAL (core work) |
| 15 | **Read finalization.ts AGAIN** | **WASTE** (just patched it 1 turn ago) |
| 16 | Write large patch to finalization.ts | ESSENTIAL (core work) |
| 17 | TypeScript compile check | ESSENTIAL (verify) |
| 18 | Read memory.md | MARGINAL (already read in turn 7) |
| 19 | Patch memory.md (architecture section) | ESSENTIAL (ceremony) |
| 20 | Patch memory.md (behavioral principles) | ESSENTIAL (ceremony) |
| 21 | Write goals.md | ESSENTIAL (ceremony) |
| 22 | Final compile + restart | ESSENTIAL (ceremony) |

## Turn-by-turn breakdown: Iteration 49

| Turn | Action | Category |
|------|--------|----------|
| 1 | Read analyze-repo.ts | ESSENTIAL |
| 2 | Think: plan | ESSENTIAL |
| 3-4 | Grep for SDK usage | ESSENTIAL |
| 5 | Read compact-memory.ts (example) | ESSENTIAL |
| 6-8 | Write code patches | ESSENTIAL |
| 9 | Compile check | ESSENTIAL |
| 10 | **Test → fails (wrong model name)** | **BUG** |
| 11-12 | **Grep for correct model name** | **BUG-FIX** |
| 13-14 | **Fix model name, test again, fails** | **BUG-FIX** |
| 15-17 | **More debugging, fix import** | **BUG-FIX** |
| 18 | **Test → finally works** | **BUG-FIX** |
| 19 | Verify types | ESSENTIAL |
| 20-21 | Update memory + goals | CEREMONY |
| 22 | Final compile + restart | CEREMONY |

## Waste categories (ranked by impact)

### 1. Re-reading files after patching (~3 turns/iteration, ~14%)
**Evidence:** Iteration 50 turns 11, 13, 15 all re-read finalization.ts after patches.
**Root cause:** `write_file(patch)` returns only "Patched file: -X +Y lines" — no context.
The agent can't see what the file looks like after patching, so it re-reads before the next patch.
**Fix:** Return surrounding context (±10 lines around the patch site) in the patch result message.

### 2. End-of-iteration ceremony (~3-4 turns/iteration, ~14-18%)
**Evidence:** Both iterations 49 and 50 used turns 20-22 for memory/goals/restart.
Iteration 50 used turns 18-22 (read memory, patch memory twice, write goals, compile+restart).
**Root cause:** Agent must manually update memory.md (multiple sections), write goals.md, and run final compile.
**Potential fix:** Bundle memory+goals writes into a single turn (agent behavior), or auto-generate goals.md skeleton. But this is mostly LLM behavior, not a code fix.

### 3. Bug-fix loops (variable, 0-9 turns, ~0-41%)
**Evidence:** Iteration 49 spent 9 turns (turns 10-18) fixing a wrong model name.
**Root cause:** Errors discovered only at runtime after many turns of coding.
**Potential fix:** Earlier/more frequent compile checks. But fundamentally unpredictable.

### 4. Redundant searches (~1-2 turns/iteration, ~5-9%)
**Evidence:** Iteration 50 turns 9-10 searched for the same function in two files sequentially.
**Root cause:** Narrow grep patterns instead of broad searches.
**Potential fix:** Agent behavior — search broader first, narrow later.

## Summary

The 22-turn floor has a structural component: ~7 turns of fixed overhead (orient: 3-4, ceremony: 3-4) plus ~3 turns of re-reading waste from blind patching. That's 10 turns before the agent writes a single useful line. The remaining 12 turns are actual work — but include bug-fix loops that expand unpredictably.

**The highest-leverage code fix:** Make `write_file(patch)` return surrounding context so the agent can see the result without re-reading. This eliminates ~3 turns per iteration.
