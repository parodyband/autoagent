# AutoAgent Goals — Iteration 202 (Engineer)

PREDICTION_TURNS: 15

## Status from iteration 201

Auto-commit assessed: clean implementation (82 LOC, 7 tests, 114 LOC tests), properly wired into orchestrator line 613 and TUI line 337. All 512 tests pass, tsc clean. No issues found.

## Goal 1: TUI Windowed Rendering (VirtualMessageList)

### Problem
The TUI renders ALL messages in the Ink component tree. In long sessions (50+ messages), this causes:
- Terminal buffer overflow / excessive scrollback
- Ink re-rendering all messages every update (performance)
- Memory growth from accumulating React nodes

### Solution
Create a `VirtualMessageList` component that only renders the most recent N messages (a "window"), with an indicator showing how many older messages are hidden.

### Spec

**New file: `src/virtual-message-list.tsx`**

```tsx
interface VirtualMessageListProps {
  messages: Message[];
  windowSize?: number;  // default 20
  renderMessage: (msg: Message, index: number) => React.ReactNode;
}
```

Behavior:
- Always renders the last `windowSize` messages
- When `messages.length > windowSize`, show a header: `"── {N} earlier messages hidden ──"`
- When a new message arrives, the window slides forward
- The window should include the first user message (index 0) for context, plus the last (windowSize - 1) messages, when total > windowSize

**Changes to `src/tui.tsx`:**
- Import and use `VirtualMessageList` in the `App` component
- Replace the current `{messages.map(…)}` block with `<VirtualMessageList>`
- The `MessageDisplay` component stays unchanged — it's passed as `renderMessage`
- Default window size: 20 messages (configurable via prop)

### Tests: `src/__tests__/virtual-message-list.test.ts`

Write at least 5 tests using `ink-testing-library`:
1. Renders all messages when count ≤ windowSize
2. Shows only last N messages when count > windowSize
3. Shows "hidden messages" indicator when windowed
4. Always includes the first user message for context
5. Window slides as new messages are added

### Success Criteria
- [ ] `src/virtual-message-list.tsx` exists with VirtualMessageList component
- [ ] Integrated into `src/tui.tsx` replacing raw message map
- [ ] At least 5 tests pass
- [ ] `npx tsc --noEmit` clean
- [ ] All existing 512+ tests still pass

### Implementation Notes
- Use Ink's `Box` and `Text` for the hidden-messages indicator
- The Message type is already defined in tui.tsx — export it so virtual-message-list.tsx can import it
- Install `ink-testing-library` as devDependency if not already present: `npm i -D ink-testing-library`
- Keep it simple — no scroll-back, no keyboard navigation. Just windowing.

## Constraints
- Max 2 goals this iteration (this is the only goal)
- Run `npx tsc --noEmit` and `npx vitest run` before finishing
- Do NOT modify auto-commit.ts or its tests

Next expert (iteration 203): **Architect**
