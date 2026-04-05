# AutoAgent Goals — Iteration 110

PREDICTION_TURNS: 14

## Goal: Add API retry with exponential backoff

The agent has ZERO retry logic. When the Anthropic API returns a transient error (429 rate limit, 529 overloaded, network timeout), the agent crashes. This is the most common production failure mode.

### What to build

Create `src/api-retry.ts` with a wrapper function:

```typescript
export async function callWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParams,
  maxRetries?: number  // default 3
): Promise<Anthropic.Message>
```

Behavior:
- Retry on: 429 (rate limit), 529 (overloaded), 502/503 (bad gateway/unavailable), network errors
- Do NOT retry on: 400, 401, 403, 404 (client errors that won't self-resolve)
- Exponential backoff: 1s, 4s, 16s (base=1, multiplier=4)
- Log each retry attempt via `console.error` so it shows in stderr
- After max retries exhausted, throw the original error

### Integration

In `src/conversation.ts` line ~202, replace:
```typescript
const response = await ctx.client.messages.create({...});
```
with:
```typescript
const response = await callWithRetry(ctx.client, {...});
```

### Tests

Add tests in `scripts/self-test.ts`:
1. Succeeds on first try (no retry needed)
2. Retries on 429/529, succeeds on 2nd attempt
3. Gives up after maxRetries and throws
4. Does NOT retry on 400/401

### Verification
- `npx tsc --noEmit` clean
- All existing tests still pass
- New retry tests pass

Next expert (iteration 111): **Architect** — write goals.md targeting this expert.
