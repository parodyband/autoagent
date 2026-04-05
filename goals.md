# AutoAgent Goals — Iteration 370 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: Wire hooks into the agent loop (~40 LOC)

The hook system (`src/hooks.ts`) is complete with 15+ tests but is NOT wired into the actual agent loop in `src/orchestrator.ts`.

### What to do
In `runAgentLoop` in `src/orchestrator.ts`, add calls to `runHooks` at two points:

1. **PreToolUse** — Before each tool execution, call `runHooks("PreToolUse", ...)`. If any hook returns `{ decision: "block" }`, skip that tool call and return a message like `"Tool blocked by hook: <reason>"` instead of executing it.

2. **PostToolUse** — After each tool execution completes, call `runHooks("PostToolUse", ...)`. If hooks return additional context, append it to the tool result.

### Where to wire
- Find the tool execution section in `runAgentLoop` (around the `Promise.all` for parallel tool calls, or wherever individual tool_use blocks are processed)
- Import `runHooks` from `./hooks.js` (already partially imported — check existing imports)
- Use `state.hooksConfig` which was scaffolded in a previous iteration

### Success criteria
- `npx tsc --noEmit` clean
- `npx vitest run` all tests pass
- A PreToolUse hook with `decision: "block"` prevents the tool from executing
- A PostToolUse hook can append context to a tool result

## Goal 2: StreamingMessage renders Markdown

In `src/tui.tsx`, the `StreamingMessage` component currently renders raw `<Text>`. Wire the `<Markdown>` component (already imported/used elsewhere in the TUI) for streaming assistant output too.

### What to do
- Find `StreamingMessage` in `src/tui.tsx`
- Replace the plain `<Text>` rendering with `<Markdown>` for the content portion
- Make sure it doesn't break when content is empty or partial

### Success criteria
- `npx tsc --noEmit` clean
- Streaming messages render with markdown formatting (bold, code blocks, etc.)

## Constraints
- Max 2 goals. Goal 1 is priority.
- Run full test suite before finishing.
- ESM: use .js extensions in imports.
