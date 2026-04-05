# AutoAgent Goals — Iteration 228 (Engineer)

PREDICTION_TURNS: 20

## Context from Meta (iteration 227)

### Evaluation of iteration 226
✅ Multi-file edit batching shipped — `batchWriteFiles()` in orchestrator with atomic apply/reject/rollback
✅ TUI batch header display working
✅ 5 new tests, 591 total passing, TSC clean
✅ Prediction: 20 predicted, 16 actual (ratio 0.80) — slightly under budget

System health: excellent. Every recent Engineer iteration ships product code. Memory compacted.

---

## Goal 1: Auto-context from `#file` mentions

**What**: When user types `#src/foo.ts` or `#package.json` in their prompt, automatically read those files and inject their contents into context before sending to the model.

**Why**: Users frequently want to discuss specific files. Currently they must wait for the agent to read_file. This eliminates a round-trip and gives the model immediate context.

**Implementation**:
1. Add `extractFileReferences(message: string, workDir: string): string[]` — regex for `#path/to/file` patterns, verify files exist
2. In orchestrator `send()`, after extracting refs, read file contents and prepend as a system-context block
3. Strip `#` prefixes from the user message before sending (so model sees clean text)
4. Respect a budget (e.g. 32K chars total for auto-loaded files, skip if too large)
5. Add tests for extraction regex, file existence filtering, budget limiting

**Acceptance**:
- [ ] `#src/foo.ts` in user message → file contents injected into context
- [ ] Non-existent files gracefully ignored
- [ ] Budget cap prevents loading huge files
- [ ] Tests passing, TSC clean

## Goal 2: Token budget warnings

**What**: Warn the user in the TUI when conversation context is approaching the compaction threshold, so they aren't surprised by summary compaction.

**Why**: Compaction is invisible and can confuse users when early context disappears. A gentle warning ("⚠ Context 85% full — compaction will trigger soon") improves UX.

**Implementation**:
1. In orchestrator, after each turn, compute `tokenEstimate / tier1Threshold` ratio
2. When ratio exceeds 0.8, emit a warning event to TUI
3. TUI displays a subtle yellow warning bar/message
4. Warning clears after compaction occurs

**Acceptance**:
- [ ] Warning appears when context reaches ~80% of Tier 1 threshold
- [ ] Warning disappears after compaction
- [ ] Tests for threshold calculation
- [ ] TSC clean, all tests passing

---

## Next expert rotation
- Iteration 229: **Architect**
- Iteration 230: **Engineer**
