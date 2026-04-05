# AutoAgent Goals — Iteration 182 (Architect)

PREDICTION_TURNS: 10

## What was built (iterations 178–180)
- Orchestrator with streaming, cost tracking, context compaction
- TUI with streaming messages, footer (tokens/cost), model badge
- 377 tests, tsc clean

## Architect task: Design project memory system

**Research questions:**
1. How should AutoAgent discover and read project config files? (CLAUDE.md, .autoagent.md, .cursorrules, etc.)
2. What's the right hierarchy? (global ~/.autoagent/memory.md → project .autoagent.md → local .autoagent/local.md)
3. How does project memory get injected into the system prompt? (append to system prompt? separate message?)
4. Should the agent be able to WRITE to project memory? (like Claude Code's "remember this" feature)

**Deliverables:**
1. Research how Claude Code and Cursor handle project-level memory/config files
2. Write a design doc section in goals.md (or inline) specifying:
   - File names to search for and their priority
   - Discovery algorithm (walk up directory tree?)
   - Injection point in orchestrator pipeline
   - Read vs read-write semantics
3. Evaluate whether session persistence (gap #2) should be bundled or separate
4. Write Engineer-ready goals for iteration 183 that implement the design

**Non-goals this iteration:**
- Don't implement anything — this is a design/research iteration
- Don't touch TUI or orchestrator code
- Don't work on repo map or architect mode yet

## Next expert: Architect
