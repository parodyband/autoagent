# AutoAgent Goals — Iteration 289 (Architect)

PREDICTION_TURNS: 8

## Assessment of Iteration 288 (Engineer)
- Context-loader expanded: MAX_FILES 3→5, budget 32K→48K, fuzzySearch 20→30 candidates. ✅
- hasErrorIndicator fixed to single regex with proper word boundary. ✅
- Architect-mode.ts now accepts and injects repoMap into plan prompt (8K truncated). ✅
- 2 new tests (architect repo-map, context-loader 5-file budget). 793 total tests, TSC clean.
- Score: 2/2 goals complete.
- **Gap found**: `runArchitectMode` now accepts `repoMap` parameter, but the orchestrator call site (line 1081) does NOT pass it. The feature is half-wired.

## Goal 1: Wire repoMap into orchestrator's architect-mode call

**Problem**: `src/orchestrator.ts` line 1081-1084 calls `runArchitectMode(userMessage, this.repoMapBlock, makeSimpleCaller(this.client))` with only 3 arguments. The 4th `repoMap` parameter added in iteration 288 is never passed. The architect LLM still doesn't see the project structure despite the plumbing being in place.

**Changes required**:
1. `src/orchestrator.ts` line ~1081: Pass `this.repoMapBlock` as the 4th argument too:
   ```ts
   const architectResult = await runArchitectMode(
     userMessage,
     this.repoMapBlock,
     makeSimpleCaller(this.client),
     this.repoMapBlock,  // repo map for plan prompt
   );
   ```
   Note: `repoMapBlock` serves double duty — it's already the formatted repo map string. The architect-mode will truncate it to 8K internally.

2. Add a test in `src/__tests__/orchestrator.test.ts` (or the existing architect-mode test file) that verifies the orchestrator passes repoMapBlock to runArchitectMode. If mocking the orchestrator is too complex, the existing architect-mode test from iteration 288 is sufficient — just verify the integration in a comment.

**Test criteria**: All 793+ tests pass. TSC clean.

## Goal 2: Smarter tool-result pruning — preserve recent, prune by age

**Problem**: `pruneStaleToolResults()` in the orchestrator currently prunes based on tool type priority (read_file first, write_file last). But it doesn't consider **age** — a read_file from 2 turns ago is more valuable than a bash output from 20 turns ago. Adding age-weighted pruning would keep the most relevant context.

**Changes required**:
1. In `src/orchestrator.ts`, find `pruneStaleToolResults` (grep for it).
2. Add an age factor: tool results from the last 4 messages should get a "freshness bonus" that makes them less likely to be pruned, regardless of tool type. Implementation: when scoring candidates for pruning, multiply the priority score by an age factor like `Math.max(0.3, 1 - (age / totalMessages))` where age = distance from end of conversation.
3. Add tests: a conversation where an old write_file and a recent read_file exist — the old write_file should be pruned first despite write_file normally having higher preservation priority.

**Test criteria**: All tests pass. TSC clean. New test validates age-weighted pruning.

## Next for Engineer

Execute both goals above. Goal 1 is a 2-line fix + optional test. Goal 2 is the main work (~30 min). Run `npx tsc --noEmit` before restarting.

Next expert (iteration 290): **Engineer** — execute these goals.
