import { describe, it, expect, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { callWithRetry } from "../api-retry.js";

// Instant delay for tests (no real waiting)
const noDelay = () => Promise.resolve();

// Minimal mock message returned by a successful API call
function mockMessage(): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "hello" }],
    model: "claude-3-5-sonnet-20241022",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

// Helper to build a mock Anthropic client
function makeClient(createFn: ReturnType<typeof vi.fn>) {
  return { messages: { create: createFn } } as unknown as Anthropic;
}

// Helper to build an Anthropic.APIError with a given status
function apiError(status: number): Anthropic.APIError {
  return new Anthropic.APIError(status, { message: `HTTP ${status}` }, `HTTP ${status}`, {});
}

const MINIMAL_PARAMS: Anthropic.MessageCreateParams = {
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 100,
  messages: [{ role: "user", content: "hi" }],
};

describe("callWithRetry", () => {
  it("succeeds on first attempt", async () => {
    const msg = mockMessage();
    const create = vi.fn().mockResolvedValueOnce(msg);
    const client = makeClient(create);

    const result = await callWithRetry(client, MINIMAL_PARAMS, 3, noDelay);

    expect(result).toBe(msg);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries once on 429 then succeeds", async () => {
    const msg = mockMessage();
    const create = vi.fn()
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce(msg);
    const client = makeClient(create);

    const result = await callWithRetry(client, MINIMAL_PARAMS, 3, noDelay);

    expect(result).toBe(msg);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries on 502", async () => {
    const msg = mockMessage();
    const create = vi.fn()
      .mockRejectedValueOnce(apiError(502))
      .mockResolvedValueOnce(msg);
    const client = makeClient(create);

    const result = await callWithRetry(client, MINIMAL_PARAMS, 3, noDelay);

    expect(result).toBe(msg);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries on 503", async () => {
    const msg = mockMessage();
    const create = vi.fn()
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce(msg);
    const client = makeClient(create);

    const result = await callWithRetry(client, MINIMAL_PARAMS, 3, noDelay);

    expect(result).toBe(msg);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries on 529", async () => {
    const msg = mockMessage();
    const create = vi.fn()
      .mockRejectedValueOnce(apiError(529))
      .mockResolvedValueOnce(msg);
    const client = makeClient(create);

    const result = await callWithRetry(client, MINIMAL_PARAMS, 3, noDelay);

    expect(result).toBe(msg);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on 400 (bad request)", async () => {
    const err = apiError(400);
    const create = vi.fn().mockRejectedValue(err);
    const client = makeClient(create);

    await expect(callWithRetry(client, MINIMAL_PARAMS, 3, noDelay)).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 401 (unauthorized)", async () => {
    const err = apiError(401);
    const create = vi.fn().mockRejectedValue(err);
    const client = makeClient(create);

    await expect(callWithRetry(client, MINIMAL_PARAMS, 3, noDelay)).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 403 (forbidden)", async () => {
    const err = apiError(403);
    const create = vi.fn().mockRejectedValue(err);
    const client = makeClient(create);

    await expect(callWithRetry(client, MINIMAL_PARAMS, 3, noDelay)).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 404 (not found)", async () => {
    const err = apiError(404);
    const create = vi.fn().mockRejectedValue(err);
    const client = makeClient(create);

    await expect(callWithRetry(client, MINIMAL_PARAMS, 3, noDelay)).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries and throws last error", async () => {
    const err = apiError(429);
    const create = vi.fn().mockRejectedValue(err);
    const client = makeClient(create);

    // maxRetries=2 → 3 total attempts
    await expect(callWithRetry(client, MINIMAL_PARAMS, 2, noDelay)).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("uses exponential backoff: 1000, 4000, 16000 ms", async () => {
    const msg = mockMessage();
    const delays: number[] = [];
    const captureDelay = (ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    };

    const create = vi.fn()
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(429))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce(msg);
    const client = makeClient(create);

    const result = await callWithRetry(client, MINIMAL_PARAMS, 3, captureDelay);

    expect(result).toBe(msg);
    expect(delays).toEqual([1000, 4000, 16000]);
  });

  it("retries on ECONNRESET network error", async () => {
    const msg = mockMessage();
    const networkErr = new Error("ECONNRESET: connection reset by peer");
    const create = vi.fn()
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValueOnce(msg);
    const client = makeClient(create);

    const result = await callWithRetry(client, MINIMAL_PARAMS, 3, noDelay);

    expect(result).toBe(msg);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on a generic non-retryable Error", async () => {
    const err = new Error("something random");
    const create = vi.fn().mockRejectedValue(err);
    const client = makeClient(create);

    await expect(callWithRetry(client, MINIMAL_PARAMS, 3, noDelay)).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
