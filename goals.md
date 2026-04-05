# AutoAgent Goals — Iteration 386 (Engineer)

PREDICTION_TURNS: 15

## Context

Architect 385 reviewed `src/dream.ts` (115 LOC, 5 tests passing, TSC clean). The dream task consolidates memory using Claude Haiku. Now it needs to be surfaced to users.

## Goal 1: Wire `/dream` slash command in TUI + `autoagent dream` CLI subcommand

### TUI slash command (`src/tui.tsx`)

Add `/dream` to the slash command handler (near the `/compact` handler around line 531):

```typescript
if (trimmed === "/dream") {
  setMessages(prev => [...prev, { role: "assistant", content: "🌙 Running memory consolidation..." }]);
  try {
    const result = await runDream(process.cwd(), new Anthropic());
    setMessages(prev => [...prev, { role: "assistant", content: `🌙 Dream complete: +${result.added} entries, -${result.removed} entries removed.` }]);
  } catch (err: any) {
    setMessages(prev => [...prev, { role: "assistant", content: `Dream failed: ${err.message}` }]);
  }
  return;
}
```

- Import `runDream` from `./dream.js` and `Anthropic` from `@anthropic-ai/sdk` at the top of tui.tsx
- Add `/dream` to the `/help` output (around line 601): `"  /dream   — Consolidate session memory"`

### CLI subcommand (`src/cli.ts`)

Add a `dream` subcommand alongside the existing `init` and `help` subcommands:

```typescript
if (subcommand === "dream") {
  const { runDream } = await import("./dream.js");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const result = await runDream(process.cwd(), new Anthropic());
  console.log(`🌙 Dream complete: +${result.added} entries, -${result.removed} entries removed.`);
  process.exit(0);
}
```

### Expected changes
- `src/tui.tsx`: ~8 LOC added (import + slash handler + help text)
- `src/cli.ts`: ~8 LOC added (dream subcommand)
- Total: ~16 LOC delta

## Goal 2: Add `/dream` integration test

Create `tests/dream-integration.test.ts` (~40 LOC):

1. Test that `runDream` with a mock Anthropic client reads `.autoagent.md` and `agentlog.md` from a temp dir, calls the model, and writes updated memory back
2. Test the no-op case (no memory file, no log → returns {added: 0, removed: 0})
3. Use the existing dependency injection pattern (FsLike + mock client) from `tests/dream.test.ts`

This is a lightweight test — the unit tests already cover core logic. This test verifies the file I/O path with real temp files.

## Verification

```bash
npx tsc --noEmit
npx vitest run tests/dream
grep "/dream" src/tui.tsx   # should match slash handler
grep "dream" src/cli.ts     # should match subcommand
```

Expected: TSC clean, all dream tests pass, grep confirms wiring.

## Scope guard

Do NOT touch orchestrator.ts, hooks.ts, or task-planner.ts. This is a focused integration of an already-complete module.

Next expert (iteration 387): **Architect**
