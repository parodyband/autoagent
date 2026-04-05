/**
 * Tests for extended thinking support in the Orchestrator.
 * Verifies that:
 * 1. `thinking` parameter is included in API calls
 * 2. `interleaved-thinking-2025-05-14` beta header is sent
 * 3. Thinking blocks in responses don't crash the pipeline
 * 4. Thinking blocks in conversation history are preserved
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "../src/orchestrator.js";
import path from "path";
import os from "os";
import { mkdtempSync } from "fs";

// ─── Shared mock setup ────────────────────────────────────────────────────────

function makeMockStream(contentBlocks: unknown[]) {
  // Simulate the Anthropic streaming API events
  const events: unknown[] = [];

  for (const block of contentBlocks) {
    const b = block as { type: string; text?: string; thinking?: string; index?: number };
    const index = b.index ?? 0;
    events.push({ type: "content_block_start", index, content_block: b });
    if (b.type === "text" && b.text) {
      events.push({
        type: "content_block_delta",
        index,
        delta: { type: "text_delta", text: b.text },
      });
    } else if (b.type === "thinking" && b.thinking) {
      events.push({
        type: "content_block_delta",
        index,
        delta: { type: "thinking_delta", thinking: b.thinking },
      });
    }
    events.push({ type: "content_block_stop", index });
  }

  const finalMsg = {
    role: "assistant",
    content: contentBlocks,
    usage: { input_tokens: 100, output_tokens: 50 },
    stop_reason: "end_turn",
  };

  const streamObj = {
    [Symbol.asyncIterator]: async function* () {
      for (const e of events) yield e;
    },
    finalMessage: async () => finalMsg,
  };

  return streamObj;
}

function makeOrchestrator(workDir: string, streamFn: ReturnType<typeof vi.fn>) {
  const orch = new Orchestrator({
    workDir,
    apiKey: "test-key",
  });

  // Patch the private client
  const mockClient = {
    messages: {
      stream: streamFn,
    },
  };
  (orch as unknown as { client: unknown }).client = mockClient;

  return orch;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Extended thinking — API call parameters", () => {
  let workDir: string;
  let streamFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    workDir = mkdtempSync(path.join(os.tmpdir(), "orch-thinking-"));
    streamFn = vi.fn();
  });

  it("includes thinking parameter with type=enabled and budget_tokens=10000", async () => {
    streamFn.mockReturnValue(
      makeMockStream([{ type: "text", text: "Hello", index: 0 }])
    );
    const orch = makeOrchestrator(workDir, streamFn);
    await orch.send("hi");

    expect(streamFn).toHaveBeenCalled();
    const [params] = streamFn.mock.calls[0];
    expect(params).toHaveProperty("thinking");
    expect(params.thinking).toEqual({ type: "enabled", budget_tokens: 10_000 });
  });

  it("sends interleaved-thinking-2025-05-14 beta header", async () => {
    streamFn.mockReturnValue(
      makeMockStream([{ type: "text", text: "Hello", index: 0 }])
    );
    const orch = makeOrchestrator(workDir, streamFn);
    await orch.send("hi");

    expect(streamFn).toHaveBeenCalled();
    const [, opts] = streamFn.mock.calls[0];
    expect(opts).toHaveProperty("headers");
    expect(opts.headers).toHaveProperty(
      "anthropic-beta",
      "interleaved-thinking-2025-05-14"
    );
  });
});

describe("Extended thinking — response handling", () => {
  let workDir: string;
  let streamFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    workDir = mkdtempSync(path.join(os.tmpdir(), "orch-thinking-resp-"));
    streamFn = vi.fn();
  });

  it("does not crash when response contains a thinking block", async () => {
    streamFn.mockReturnValue(
      makeMockStream([
        { type: "thinking", thinking: "Let me reason about this...", index: 0 },
        { type: "text", text: "The answer is 42.", index: 1 },
      ])
    );
    const orch = makeOrchestrator(workDir, streamFn);
    const result = await orch.send("what is the answer?");
    expect(result.text).toBe("The answer is 42.");
  });

  it("does not stream thinking text to user (only text_delta is emitted)", async () => {
    const receivedText: string[] = [];
    streamFn.mockReturnValue(
      makeMockStream([
        { type: "thinking", thinking: "secret reasoning", index: 0 },
        { type: "text", text: "visible reply", index: 1 },
      ])
    );
    const orch = new Orchestrator({
      workDir,
      apiKey: "test-key",
      onText: (t) => receivedText.push(t),
    });
    (orch as unknown as { client: unknown }).client = {
      messages: { stream: streamFn },
    };

    await orch.send("hello");

    // Thinking text should never appear in streamed output
    expect(receivedText.join("")).not.toContain("secret reasoning");
    expect(receivedText.join("")).toContain("visible reply");
  });

  it("emits onStatus('Thinking...') when thinking block starts", async () => {
    const statuses: string[] = [];
    streamFn.mockReturnValue(
      makeMockStream([
        { type: "thinking", thinking: "reasoning...", index: 0 },
        { type: "text", text: "done", index: 1 },
      ])
    );
    const orch = new Orchestrator({
      workDir,
      apiKey: "test-key",
      onStatus: (s) => statuses.push(s),
    });
    (orch as unknown as { client: unknown }).client = {
      messages: { stream: streamFn },
    };

    await orch.send("think about it");

    expect(statuses).toContain("Thinking...");
  });

  it("thinking_delta events are ignored (no crash, no output)", async () => {
    // Build a stream that includes a thinking_delta manually
    const events = [
      { type: "content_block_start", index: 0, content_block: { type: "thinking" } },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "internal" } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "text" } },
      { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "result" } },
      { type: "content_block_stop", index: 1 },
    ];
    const finalMsg = {
      role: "assistant",
      content: [{ type: "thinking", thinking: "internal" }, { type: "text", text: "result" }],
      usage: { input_tokens: 10, output_tokens: 5 },
      stop_reason: "end_turn",
    };
    streamFn.mockReturnValue({
      [Symbol.asyncIterator]: async function* () { for (const e of events) yield e; },
      finalMessage: async () => finalMsg,
    });

    const orch = makeOrchestrator(workDir, streamFn);
    const result = await orch.send("test");
    expect(result.text).toBe("result");
  });
});

describe("Extended thinking — conversation history preservation", () => {
  let workDir: string;
  let streamFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    workDir = mkdtempSync(path.join(os.tmpdir(), "orch-thinking-hist-"));
    streamFn = vi.fn();
  });

  it("thinking blocks from assistant response are preserved in apiMessages", async () => {
    streamFn.mockReturnValue(
      makeMockStream([
        { type: "thinking", thinking: "my reasoning", index: 0 },
        { type: "text", text: "my answer", index: 1 },
      ])
    );
    const orch = makeOrchestrator(workDir, streamFn);
    await orch.send("preserve this");

    // On a second call, the messages passed to stream should include the thinking block
    streamFn.mockReturnValue(
      makeMockStream([{ type: "text", text: "follow up", index: 0 }])
    );
    await orch.send("follow up");

    const [secondParams] = streamFn.mock.calls[1];
    const msgs: Array<{ role: string; content: unknown[] }> = secondParams.messages;
    const assistantMsg = msgs.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();

    const content = assistantMsg!.content as Array<{ type: string }>;
    const hasThinking = content.some((b) => b.type === "thinking");
    expect(hasThinking).toBe(true);
  });
});

describe("Orchestrator public API — compactHistory and reindexRepoMap", () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(path.join(os.tmpdir(), "orch-api-"));
  });

  it("compactHistory is a public method on Orchestrator", () => {
    const orch = new Orchestrator({ workDir, apiKey: "test-key" });
    expect(typeof orch.compactHistory).toBe("function");
  });

  it("reindexRepoMap is a public method on Orchestrator", () => {
    const orch = new Orchestrator({ workDir, apiKey: "test-key" });
    expect(typeof orch.reindexRepoMap).toBe("function");
  });
});
