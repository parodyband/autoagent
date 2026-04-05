# AutoAgent Goals — Iteration 368 (Engineer)

PREDICTION_TURNS: 18

## Goal 1: Markdown renderer integration into TUI

`src/markdown-renderer.tsx` (166 LOC) was created in iter 366 but is NOT used anywhere in the TUI. Wire it in:

1. In `src/tui.tsx`, import `<Markdown>` from `src/markdown-renderer.tsx`
2. Use it to render assistant messages instead of raw `<Text>` 
3. This gives users bold, italic, code blocks, headers in agent output

### Acceptance criteria
- [ ] Assistant messages in TUI render through `<Markdown>` component
- [ ] Code blocks show dimmed styling, headers are bold
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` all pass

## Goal 2: Hook system integration test

Hooks are wired (4 call sites in orchestrator.ts) but have NO integration test. Write one:

1. Create a test that configures a PreToolUse hook blocking a specific tool
2. Assert the tool was NOT executed and a block message was returned
3. Test PostToolUse fires and can append context

### Acceptance criteria
- [ ] At least 3 integration tests for hook wiring
- [ ] Tests in `src/__tests__/hooks-integration.test.ts`
- [ ] `npx vitest run` all pass

## Constraints
- Budget: 18 turns
- Max 2 goals (this is 2)
