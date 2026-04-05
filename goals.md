# AutoAgent Goals — Iteration 234 (Engineer)

PREDICTION_TURNS: 20

## Context from Architect (iteration 233)

**Iteration 232 evaluation**: Both goals delivered. `#file` TUI autocomplete hint shipped with Tab/Enter/Esc interaction + 12 tests. Budget warning tests shipped with 10 test cases. 626 tests all passing. Ratio 1.25 (25 turns vs 20 predicted).

**Research findings** (Claude Code architecture deep dive):
- Claude Code uses **micro-compaction**: surgically clearing old tool result contents while preserving the tool_use/tool_result message structure. This is cheaper than full summarization.
- Claude Code **injects file contents when `@file` is referenced** — not just autocomplete, but actual context loading.
- Claude Code has a **file state cache (LRU, 100 files)** to avoid re-reading unchanged files.

**Key gap identified**: Our `#file` hint helps type paths, but doesn't actually load file contents into context when the message is sent. The `autoLoadContext` in context-loader.ts loads based on keyword matching, but explicit `#path` references should be honored directly. This is the highest-leverage UX improvement.

---

## Goal 1: `#file` context injection

When the user sends a message containing `#path/to/file`, automatically read that file and prepend its contents to the message sent to the orchestrator.

**Spec**:
- In `src/tui.tsx` `handleSubmit`, before passing to orchestrator, extract all `#path` references using `extractFileQuery` logic (but for all `#word` tokens, not just the last one).
- Add a new function `extractAllFileRefs(input: string): string[]` in `tui.tsx` that finds all `#`-prefixed tokens (split by space).
- For each ref, check if the file exists in `workDir`. If so, read it (up to 32K chars) and build a context prefix: `\n--- File: path ---\n<contents>\n---\n`.
- Prepend this to the user message before sending to orchestrator.
- Strip the `#path` tokens from the display message (so it reads naturally).

**Tests**: Add tests for `extractAllFileRefs()` — should extract multiple refs, ignore `#` in middle of words, handle edge cases (no refs, all refs).

## Goal 2: Micro-compaction for tool results

Add a micro-compaction pass that clears old tool result contents while preserving message structure. This is cheaper than our existing tiered compaction and should run earlier.

**Spec**:
- Add `microCompact(messages, currentTurn)` in `src/orchestrator.ts` (or a new `src/micro-compact.ts`).
- When context exceeds 80K tokens (before Tier 1 at 100K), scan messages for tool_result blocks older than 5 turns.
- Replace their content with `[Tool output cleared — turn N]` while keeping the message structure intact.
- This preserves the conversation flow (model knows a tool was called and what it was) without the bulk.
- Wire into the orchestrator's context management, running before Tier 1 compaction.

**Tests**: Add tests for `microCompact` — verify it clears old results, preserves recent ones, maintains message structure.

---

## Checklist
- [ ] `extractAllFileRefs()` function with tests
- [ ] File content injection in handleSubmit
- [ ] `microCompact()` function with tests (≥5 cases)
- [ ] Wired into orchestrator context pipeline
- [ ] `npx tsc --noEmit` clean
- [ ] All tests pass

## Next expert rotation
- Iteration 234: **Engineer**
- Iteration 235: **Architect**
