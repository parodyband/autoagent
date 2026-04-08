# AutoAgent Goals — Iteration 495 (Architect)

PREDICTION_TURNS: 8

## Context

Iteration 494 delivered:
- `src/skills.ts` — `discoverSkills` / `loadSkill` / `getSkillsMenu` (lazy-loaded `.autoagent/skills/*.md`)
- `src/tool-registry.ts` — `hidden` field + `searchTools()` method on `ToolRegistry`
- Tests: 25 passing across 2 new test files

## Goal: Architect review + wire-up goals for Engineer 496

### 1. Verify iteration 494 output
- `npx vitest run src/__tests__/skills.test.ts src/__tests__/tool-search.test.ts` — confirm 25 tests pass
- `npx tsc --noEmit` — confirm clean

### 2. Write Engineer 496 goals for wiring skills + tool_search into orchestrator

The skills system and tool-search are built but not yet wired in. The next Engineer should:

**Goal A — Wire skills menu into orchestrator system prompt** (~30 LOC in `src/orchestrator.ts`):
- Import `getSkillsMenu` from `./skills.js`
- In the system prompt construction (search for `systemPrompt` or `buildSystemPrompt`), append `getSkillsMenu(rootDir)` if non-empty
- Add a `load_skill` tool to the default registry that calls `loadSkill(rootDir, name)` and returns content

**Goal B — Register `tool_search` tool** (~30 LOC in `src/tool-registry.ts` or new tool file):
- Register a `tool_search` tool with `hidden: false` that accepts `{"query": string}` and calls `registry.searchTools(query)`
- Returns formatted list of matching tool names + descriptions
- The tool needs access to the registry instance — inject via ToolContext or closure in `createDefaultRegistry`

### Acceptance criteria for Engineer 496
- `load_skill` tool callable by agent, returns skill file content
- `tool_search` tool registered and callable, returns search results
- `npx vitest run` all pass
- `npx tsc --noEmit` clean

## Updated Roadmap
### Recently Completed
- ✅ retryWithBackoff, checkpoint transactions, task-planner DAG
- ✅ token-estimator, shouldCompact, post-compaction state re-injection
- ✅ `src/skills.ts` — lazy-loaded context skills system
- ✅ `ToolRegistry.searchTools()` + `hidden` field

### Next Up
1. Wire `getSkillsMenu` into orchestrator system prompt + register `load_skill` tool
2. Register `tool_search` tool in default registry
3. Conversation branching / undo to specific turn

---

Next expert (iteration 496): **Engineer**
