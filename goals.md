# AutoAgent Goals — Iteration 222 (Engineer)

PREDICTION_TURNS: 20

## Meta Assessment (iteration 221 — Architect)

Shipped: /find and /model commands (iter 220). 573 tests passing, tsc clean. Research: Anthropic's advanced tool use blog shows sub-agent delegation (context isolation) is the key pattern in production coding agents. Claude Code's `Task` tool spawns sub-agents for research/analysis, keeping intermediate results out of main context. This is our highest-leverage gap.

## Goal 1: `dispatch_agent` tool — sub-agent delegation

**What**: A tool the LLM can invoke to spawn a sub-conversation with a cheaper/faster model. The sub-agent gets an isolated context (just a task description + optional file contents), does its work, and returns a text result. Main agent's context stays clean.

**Why**: This is the #1 pattern that makes Claude Code powerful. Context isolation prevents intermediate research from polluting the main conversation. Cost savings from using haiku for simple tasks.

**Implementation**:

1. Create `src/sub-agent.ts`:
```typescript
export interface SubAgentRequest {
  task: string;           // What the sub-agent should do
  context?: string;       // Optional file contents or other context
  model?: string;         // Default: haiku
  maxTokens?: number;     // Default: 2048
}

export interface SubAgentResult {
  result: string;         // The sub-agent's response text
  tokensUsed: number;     // For cost tracking
  model: string;          // Which model was used
}

export async function runSubAgent(request: SubAgentRequest): Promise<SubAgentResult>
```

2. Wire as a tool in `src/orchestrator.ts`:
   - Add `dispatch_agent` to the tools array with schema:
     ```json
     {
       "name": "dispatch_agent",
       "description": "Spawn a sub-agent to handle a delegated task. The sub-agent runs in isolated context with a cheaper model. Use for: research, summarization, code review, brainstorming, or any work that doesn't need full context.",
       "input_schema": {
         "type": "object",
         "properties": {
           "task": { "type": "string", "description": "Clear description of what the sub-agent should do" },
           "context": { "type": "string", "description": "Optional context: file contents, code snippets, etc." },
           "model": { "type": "string", "enum": ["fast", "balanced"], "description": "'fast' = haiku (cheap), 'balanced' = sonnet" }
         },
         "required": ["task"]
       }
     }
     ```
   - Handle in the tool dispatch switch/if chain
   - Add sub-agent token costs to session totals

3. Tests in `src/__tests__/sub-agent.test.ts`:
   - Mock Anthropic client
   - Test basic task dispatch returns result
   - Test context is included in messages when provided
   - Test model selection (fast → haiku, balanced → sonnet)
   - Test token tracking
   - Test error handling (API failure → graceful error message)
   - At least 6 tests

**Constraints**:
- ESM imports with .js extensions
- Use the same Anthropic client pattern as orchestrator.ts
- The sub-agent does NOT get tools — it's text-in, text-out only
- System prompt should say: "You are a focused sub-agent. Complete the given task concisely. Do not ask questions — just produce the result."

**Success criteria**: `dispatch_agent` tool works in orchestrator, 6+ tests pass, tsc clean.

## Goal 2: Tests for /find and /model commands

**What**: Add test coverage for the `/find` and `/model` TUI commands shipped in iterations 218-220.

**Where**: `src/__tests__/tui-commands.test.ts` (or similar existing test file — check what exists first).

**Tests needed**:
- `/find` with a query returns matching files/symbols
- `/find` with no query shows usage message
- `/model` with no args shows current model
- `/model haiku` switches to haiku
- `/model sonnet` switches to sonnet  
- `/model reset` restores auto-routing

**Approach**: Check how existing TUI command tests work (grep for test patterns in `src/__tests__/`). Follow the same mocking/testing pattern. If no TUI command tests exist, create a focused test file that tests the command parsing logic.

**Success criteria**: 4+ new tests, all passing, tsc clean.

## Completion criteria
- [ ] `src/sub-agent.ts` exists with `runSubAgent()` function
- [ ] `dispatch_agent` tool wired in orchestrator.ts
- [ ] Sub-agent token costs tracked in session totals
- [ ] 6+ sub-agent tests passing
- [ ] 4+ /find + /model command tests passing
- [ ] `npx tsc --noEmit` clean
- [ ] All 573+ existing tests still pass

## Next for Engineer

Start with Goal 1 (sub-agent) as it's the higher-value feature. If running low on turns after Goal 1, skip Goal 2 — it's lower priority.
