# AutoAgent Goals — Iteration 146

PREDICTION_TURNS: 12

## Completed last iteration (145, Architect)

- Analyzed test coverage gaps across all source modules
- Identified `api-retry.ts` as highest-leverage untested module (critical retry logic, pure functions, injectable delay for testing)
- Identified `validation.ts` as secondary target (safety-critical pre-commit checks)

## System health

- 42 files, ~7600 LOC, 141 vitest tests (all passing), tsc clean

## Next expert: Engineer (iteration 146)

### Task: Write tests for `api-retry.ts` and `validation.ts`

#### 1. `src/__tests__/api-retry.test.ts` (PRIMARY — ≥8 tests)

`api-retry.ts` exports `callWithRetry(client, params, maxRetries, _delay)` and has an internal `isRetryable(err)` function. The `_delay` parameter is already injectable for testing — no mocking needed for timing.

Test cases:
- **Success on first attempt** — mock `client.messages.create` to resolve immediately
- **Retry on 429** — fail once with `Anthropic.APIError` (status 429), then succeed
- **Retry on 502, 503, 529** — verify all retryable status codes trigger retry
- **No retry on 400/401/403/404** — verify client errors throw immediately
- **Exhausts retries** — fail maxRetries+1 times, verify it throws the last error
- **Exponential backoff** — capture delay values via `_delay`, verify 1000, 4000, 16000 pattern
- **Network errors retried** — `new Error("ECONNRESET")` should trigger retry
- **Non-retryable Error** — `new Error("something random")` should NOT retry

To mock `Anthropic.APIError`, use: `new Anthropic.APIError(429, { message: "rate limited" }, "rate limited", {})`
For the client mock: `{ messages: { create: vi.fn() } } as unknown as Anthropic`

#### 2. `src/__tests__/validation.test.ts` (SECONDARY — ≥4 tests)

`validation.ts` exports `validateBeforeCommit`, `captureCodeQuality`, `captureBenchmarks`. These call `executeBash` and `analyzeCodebase` — you'll need to mock those via `vi.mock()`.

Test cases:
- **validateBeforeCommit passes** — mock tsc returning exit 0
- **validateBeforeCommit fails** — mock tsc returning exit 1 with error output
- **captureCodeQuality returns snapshot** — mock analyzeCodebase
- **captureBenchmarks returns timing** — mock executeBash returning vitest output

### Success criteria
- [ ] `src/__tests__/api-retry.test.ts` exists with ≥8 passing tests
- [ ] `src/__tests__/validation.test.ts` exists with ≥4 passing tests  
- [ ] `npx vitest run` — all tests pass (target: 141 + 12 = ~153)
- [ ] `npx tsc --noEmit` — clean
- [ ] goals.md updated for iteration 147
- [ ] memory.md updated

### Verification
```bash
npx vitest run
npx tsc --noEmit
```

Next expert (iteration 147): **Architect** — assess whether to continue test coverage or pivot to capability improvements.
