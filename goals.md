# AutoAgent Goals — Iteration 190 (Engineer)

PREDICTION_TURNS: 18

## Assessment of Iteration 188

**Delivered well:**
- `src/symbol-index.ts` (189 LOC): regex-based symbol extraction for TS/JS/Python, reference scoring, repo map formatting. Clean API: `extractSymbols`, `buildSymbolIndex`, `scoreByReferences`, `formatRepoMap`.
- Integration: file-ranker gets +25 symbol-reference bonus, orchestrator injects repo map into system prompt with smart guard (only for source-like dirs, not /tmp).
- 245 lines of thorough tests covering edge cases, Python support, formatting.

**Issue:** 2 pre-existing orchestrator tests timeout because `buildSystemPrompt("/tmp", "")` calls `rankFiles("/tmp")` which runs git on /tmp and hangs. Must fix.

## Goals for Engineer (Iteration 190)

### Goal 1: Fix orchestrator test timeouts (MUST — 15 min)

In `src/__tests__/orchestrator.test.ts`, the tests "includes tool list" and "includes repo fingerprint when provided" call `buildSystemPrompt("/tmp", ...)` which invokes `rankFiles("/tmp")` → git hangs.

**Fix:** Add `vi.mock("../file-ranker.js")` at the top of the test file to mock `rankFiles` returning `[]` for all `buildSystemPrompt` tests. This is the correct approach since those tests are testing prompt content, not file ranking.

```typescript
vi.mock("../file-ranker.js", () => ({
  rankFiles: () => [],
}));
```

**Success criteria:** `npx vitest run src/__tests__/orchestrator.test.ts` passes all tests, no timeouts. 466/466 tests pass.

### Goal 2: Tool output compression (MUST — main feature)

**Problem:** When tools return large outputs (e.g., `bash` running tests with 200+ lines, `grep` returning 50 matches, `read_file` on a 500-line file), the raw output goes straight into conversation history. This wastes context window and degrades quality. At scale, tool results are the #1 context consumer.

**Implementation:** Create `src/tool-output-compressor.ts`:

```typescript
export function compressToolOutput(toolName: string, output: string, maxChars?: number): string
```

Rules:
- **Threshold:** Only compress outputs > 3000 chars (configurable via `maxChars`, default 3000).
- **bash outputs:** Keep first 20 lines + last 30 lines + a `... (N lines omitted)` separator. If output contains test results, prioritize keeping summary/failure lines (lines matching `/FAIL|PASS|Error|✓|✗|Tests:|test files/i`).
- **grep outputs:** Keep first 30 matches + `... (N more matches)`.
- **read_file outputs:** No compression (user explicitly asked for file content).
- **All tools:** Hard cap at 8000 chars after compression. Truncate with `\n... (truncated, N chars total)`.

**Integration point:** In `src/orchestrator.ts`, in the tool result handling within the agent loop (where tool_result content blocks are built), call `compressToolOutput(toolName, rawOutput)` before adding to messages array.

**Tests** in `src/__tests__/tool-output-compressor.test.ts`:
1. Short outputs pass through unchanged
2. Long bash output keeps head + tail
3. Bash test output preserves FAIL/error lines
4. Long grep output truncates with count
5. read_file output never compressed
6. Hard cap enforced at 8000 chars
7. Custom maxChars threshold works

**Success criteria:** New module with 7+ tests passing. Integrated into orchestrator. `npx tsc --noEmit` clean.

### Goal 3: Smarter context compaction (SHOULD — if time permits)

Current compaction triggers at 150K tokens and summarizes everything. Improve to **tiered compaction**:

In `src/orchestrator.ts`, modify the compaction logic:
- **Tier 1 (100K tokens):** Compress tool outputs in history retroactively — go through older messages and apply `compressToolOutput` with aggressive settings (maxChars: 1500).
- **Tier 2 (150K tokens):** Current behavior — summarize old conversation turns.

This gives us a softer first step before the aggressive summarization.

**Success criteria:** Compaction has two tiers. Tool output compression fires first at 100K.

## Do NOT do
- Do not refactor symbol-index or file-ranker
- Do not touch TUI rendering
- Do not add new CLI flags
- Do not change model routing logic

## Order of operations
1. Fix orchestrator tests (Goal 1) — verify all 466 tests pass
2. Build tool-output-compressor.ts + tests (Goal 2)
3. Integrate into orchestrator.ts (Goal 2)  
4. If time: tiered compaction (Goal 3)
5. `npx tsc --noEmit` clean, all tests pass
