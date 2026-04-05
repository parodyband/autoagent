/**
 * Tests for parallelResearch helper in src/tools/subagent.ts
 *
 * We inject a mock Anthropic client so no real API calls are made.
 */

import { describe, it, expect, vi } from "vitest";
import { parallelResearch, executeSubagent } from "../tools/subagent.js";
import Anthropic from "@anthropic-ai/sdk";

// Build a minimal mock Anthropic client that returns a canned response.
function makeMockClient(responseText: string = "mock answer"): Anthropic {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: "text", text: responseText }],
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  return {
    messages: { create: mockCreate },
  } as unknown as Anthropic;
}

describe("executeSubagent", () => {
  it("returns response text from the model", async () => {
    const client = makeMockClient("hello world");
    const result = await executeSubagent("what is 1+1?", "fast", 512, client);
    expect(result.response).toBe("hello world");
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
  });

  it("returns ERROR string on API failure", async () => {
    const badClient = {
      messages: {
        create: vi.fn().mockRejectedValue(new Error("network timeout")),
      },
    } as unknown as Anthropic;
    const result = await executeSubagent("task", "fast", 512, badClient);
    expect(result.response).toMatch(/ERROR: network timeout/);
    expect(result.inputTokens).toBe(0);
  });
});

describe("parallelResearch", () => {
  it("returns one result per question, preserving order", async () => {
    let callCount = 0;
    const mockCreate = vi.fn().mockImplementation(async () => {
      const idx = callCount++;
      return {
        content: [{ type: "text", text: `answer${idx}` }],
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    });
    const client = { messages: { create: mockCreate } } as unknown as Anthropic;

    const questions = ["q0", "q1", "q2"];
    const results = await parallelResearch(questions, "fast", 512, client);

    expect(results).toHaveLength(3);
    expect(results[0].question).toBe("q0");
    expect(results[1].question).toBe("q1");
    expect(results[2].question).toBe("q2");
  });

  it("dispatches all questions concurrently (Promise.all)", async () => {
    // Track start times — if sequential they'd be staggered; with Promise.all
    // all three start before any resolves.
    const starts: number[] = [];
    const mockCreate = vi.fn().mockImplementation(async () => {
      starts.push(Date.now());
      await new Promise((r) => setTimeout(r, 10));
      return {
        content: [{ type: "text", text: "ok" }],
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    });
    const client = { messages: { create: mockCreate } } as unknown as Anthropic;

    const questions = ["a", "b", "c"];
    await parallelResearch(questions, "fast", 512, client);

    // All three calls should have started within 20ms of each other (concurrent)
    expect(mockCreate).toHaveBeenCalledTimes(3);
    const spread = Math.max(...starts) - Math.min(...starts);
    expect(spread).toBeLessThan(30); // all started nearly simultaneously
  });

  it("handles empty question list", async () => {
    const client = makeMockClient("x");
    const results = await parallelResearch([], "fast", 512, client);
    expect(results).toEqual([]);
  });

  it("propagates error responses per-question without crashing", async () => {
    const mockCreate = vi
      .fn()
      .mockRejectedValue(new Error("rate limited"));
    const client = { messages: { create: mockCreate } } as unknown as Anthropic;

    const results = await parallelResearch(["q"], "fast", 512, client);
    expect(results[0].response).toMatch(/ERROR/);
    expect(results[0].question).toBe("q");
  });
});
