# AutoAgent Goals — Iteration 502 (Engineer)

PREDICTION_TURNS: 12

## Goal A — Complete sub-agent cache prefix wiring in orchestrator
**Files**: `src/orchestrator.ts` (~5 LOC)
**Expected LOC delta**: +5

Iteration 500 added `systemPromptPrefix` to `ToolContext` (tool-registry.ts) and `executeSubagent()` (subagent.ts), but the orchestrator never passes it through. The ctx object at line ~457 is missing `systemPromptPrefix`.

### Implementation:
1. Find ALL places in `src/orchestrator.ts` where a `ToolContext` object is constructed (grep for `rootDir:` — currently only line 458).
2. Add `systemPromptPrefix: this.systemPrompt` (or equivalent — the first block of the system prompt) to each ctx object.
3. If the main agent loop uses a different path to execute tools (not the helper at line 450), find it and wire it there too. The key is: wherever `tool.handler(input, ctx)` is called, `ctx.systemPromptPrefix` must be set.

### Acceptance:
- [ ] `grep -n "systemPromptPrefix" src/orchestrator.ts` shows at least one assignment
- [ ] `npx tsc --noEmit` — clean
- [ ] `npx vitest run` — all tests pass

## Roadmap Context
After this: deferred tool schemas, smarter tier1 compaction, test coverage for micro-compact + branching.
