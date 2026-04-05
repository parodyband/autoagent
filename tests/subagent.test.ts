/**
 * Tests for sub-agent tool hardening: timeout, retry, and output truncation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { executeSubagent } from "../src/tools/subagent.js";

// Helper: build a fake Anthropic client whose messages.create calls the provided fn
function fakeClient(fn: (params: unknown, opts?: unknown) => Promise<unknown>): Anthropic {
  return {
    messages: { create: fn },
  } as unknown as Anthropic;
}

// Helper: build a successful API response
function successResponse(text: string) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

describe("executeSubagent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns truncated output when response exceeds 4096 chars", async () => {
    const longText = "a".repeat(5000);
    const client = fakeClient(async () => successResponse(longText));

    const result = await executeSubagent("test task", "fast", 2048, client);

    expect(result.response.length).toBeLessThanOrEqual(4096 + 100); // truncation marker adds chars
    expect(result.response).toContain("[truncated — showing first 4096 chars]");
    expect(result.response.startsWith("a".repeat(4096))).toBe(true);
  });

  it("does not truncate output within 4096 chars", async () => {
    const shortText = "hello world";
    const client = fakeClient(async () => successResponse(shortText));

    const result = await executeSubagent("test task", "fast", 2048, client);

    expect(result.response).toBe(shortText);
    expect(result.response).not.toContain("[truncated");
  });

  it("retries on 500 error and succeeds on second attempt", async () => {
    let callCount = 0;
    const client = fakeClient(async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error("Internal Server Error") as Error & { status: number };
        err.status = 500;
        throw err;
      }
      return successResponse("retry succeeded");
    });

    // Run executeSubagent but advance timers to skip backoff sleeps
    const promise = executeSubagent("task", "fast", 2048, client);
    // Advance past the 1s backoff
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(callCount).toBe(2);
    expect(result.response).toBe("retry succeeded");
  });

  it("retries on 429 rate limit error", async () => {
    let callCount = 0;
    const client = fakeClient(async () => {
      callCount++;
      if (callCount <= 2) {
        const err = new Error("Rate limit exceeded") as Error & { status: number };
        err.status = 429;
        throw err;
      }
      return successResponse("after rate limit");
    });

    const promise = executeSubagent("task", "fast", 2048, client);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(callCount).toBe(3);
    expect(result.response).toBe("after rate limit");
  });

  it("does not retry on AbortError (timeout), returns clean error message", async () => {
    let callCount = 0;
    const client = fakeClient(async (_params: unknown, opts?: unknown) => {
      callCount++;
      // Simulate the abort signal being triggered
      const signal = (opts as { signal?: AbortSignal })?.signal;
      if (signal) {
        return new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }
      throw new Error("no signal");
    });

    const promise = executeSubagent("task", "fast", 2048, client);
    // Advance past the 60s timeout
    await vi.advanceTimersByTimeAsync(65_000);
    const result = await promise;

    // Should only be called once — no retries on timeout
    expect(callCount).toBe(1);
    expect(result.response).toContain("ERROR:");
    expect(result.response).toContain("timed out");
  });

  it("does not retry on 400 client errors", async () => {
    let callCount = 0;
    const client = fakeClient(async () => {
      callCount++;
      const err = new Error("Bad Request") as Error & { status: number };
      err.status = 400;
      throw err;
    });

    const promise = executeSubagent("task", "fast", 2048, client);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(callCount).toBe(1);
    expect(result.response).toContain("ERROR:");
  });

  it("returns model id and token counts on success", async () => {
    const client = fakeClient(async () => ({
      content: [{ type: "text", text: "result" }],
      usage: { input_tokens: 42, output_tokens: 7 },
    }));

    const result = await executeSubagent("task", "fast", 2048, client);

    expect(result.inputTokens).toBe(42);
    expect(result.outputTokens).toBe(7);
    expect(result.model).toContain("haiku");
  });
});
