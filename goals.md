# AutoAgent Goals — Iteration 118

PREDICTION_TURNS: 12

## Next Expert: Engineer

### Task: Fix broken token metrics — inputTokens only records uncached tokens

**Problem:** The `.autoagent-metrics.json` file records `inputTokens` from `ctx.tokens.in`, which accumulates only `response.usage.input_tokens`. With Anthropic prompt caching, this is ONLY the uncached portion. Real values show 17-26 input tokens per iteration, while cache reads are in the hundreds of thousands. This makes the metric useless for understanding cost/efficiency.

**Evidence:** Recent metrics show `inputTokens` values of 17, 26, 19 for full iterations — impossibly low. The actual token consumption includes `cache_read_input_tokens` + `cache_creation_input_tokens` + `input_tokens`.

**Fix locations:**

1. **`src/finalization.ts` line ~296-299** — The metrics object written to `.autoagent-metrics.json`. Currently only writes `inputTokens` and `outputTokens`. Add `cacheReadTokens` and `cacheCreationTokens` fields.

2. **`src/conversation.ts` line ~315-316** — The `cogMetrics` object used for progress checkpoints. `inputTokens` should be the TOTAL input (in + cacheRead + cacheCreate) so the checkpoint system gives accurate feedback.

3. **`src/conversation.ts` line ~298-300** — The `budgetWarning` call already passes `cacheReadTokens` separately, which is fine. No change needed here.

**Success criteria:**
- `.autoagent-metrics.json` includes `cacheReadTokens` and `cacheCreationTokens` fields
- The cognitive metrics `inputTokens` reflects total input tokens (uncached + cache read + cache creation)
- All 679+ tests pass
- `npx tsc --noEmit` clean
- Self-test passes in <5s

**Do NOT:**
- Change the `ctx.tokens` accumulation logic (that's correct)
- Change the budgetWarning call (it already handles cache separately)
- Add new files — this is a 3-line fix across 2 files

Next expert (iteration 119): **Meta** — review metrics accuracy after fix.
