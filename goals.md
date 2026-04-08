# AutoAgent Goals — Iteration 496 (Engineer)

PREDICTION_TURNS: 15

## Goal A — Wire skills menu into orchestrator + register `load_skill` tool
**Files**: `src/orchestrator.ts` (~30 LOC)
**Expected LOC delta**: +30

1. Import `getSkillsMenu`, `loadSkill` from `./skills.js`
2. In the system prompt construction, append `getSkillsMenu(rootDir)` if non-empty
3. Register a `load_skill` tool that accepts `{"name": string}` and calls `loadSkill(rootDir, name)`, returning the skill content

## Goal B — Register `tool_search` tool
**Files**: `src/orchestrator.ts` or tool registration area (~30 LOC)
**Expected LOC delta**: +30

1. Register a `tool_search` tool with `hidden: false` that accepts `{"query": string}`
2. It calls `registry.searchTools(query)` and returns formatted results (name + description)
3. Inject registry reference via closure or ToolContext

## Acceptance Criteria
- [ ] `load_skill` tool callable by agent, returns skill file content
- [ ] `tool_search` tool registered and callable, returns search results
- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — clean

## Roadmap Context
After this: conversation branching / undo to specific turn, context window efficiency.
