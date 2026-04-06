/**
 * Tests for ReflectionStore and reflectOnCompletion scaffolding.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ReflectionStore, type ToolCallRecord, type ReflectionCheckpoint } from "../src/reflection.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  const dir = join(tmpdir(), `reflection-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeToolRecord(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    name: "bash",
    input: { command: "echo hello" },
    resultSnippet: "hello",
    durationMs: 42,
    isError: false,
    wasRetried: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ─── ReflectionStore ─────────────────────────────────────────────────────────

describe("ReflectionStore", () => {
  let tmpDir: string;
  let store: ReflectionStore;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    store  = new ReflectionStore(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── begin / finalize ────────────────────────────────────────────────────────

  it("begin() returns a string ID in the expected format", () => {
    const id = store.begin("fix the bug", "claude-sonnet");
    expect(id).toMatch(/^rc-[a-z0-9]+-[0-9a-f]{4}$/);
  });

  it("isActive is true after begin and false before/after finalize", () => {
    expect(store.isActive).toBe(false);
    store.begin("task", "model");
    expect(store.isActive).toBe(true);
    store.finalize({ assistantResponse: "done", filesModified: [], tokensIn: 10, tokensOut: 5, costUsd: 0.001, success: true });
    expect(store.isActive).toBe(false);
  });

  it("finalize() returns a ReflectionCheckpoint with correct shape", () => {
    store.begin("write a test", "claude-haiku");
    const cp = store.finalize({
      assistantResponse: "I wrote the test.",
      filesModified: ["src/foo.ts"],
      commitHash: "abc1234",
      tokensIn: 1000,
      tokensOut: 200,
      costUsd: 0.005,
      success: true,
      verificationPassed: true,
    });

    expect(cp).not.toBeNull();
    expect(cp!.model).toBe("claude-haiku");
    expect(cp!.userMessage).toBe("write a test");
    expect(cp!.assistantResponse).toBe("I wrote the test.");
    expect(cp!.filesModified).toEqual(["src/foo.ts"]);
    expect(cp!.commitHash).toBe("abc1234");
    expect(cp!.tokensIn).toBe(1000);
    expect(cp!.tokensOut).toBe(200);
    expect(cp!.costUsd).toBe(0.005);
    expect(cp!.success).toBe(true);
    expect(cp!.verificationPassed).toBe(true);
    expect(cp!.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof cp!.id).toBe("string");
    expect(typeof cp!.startedAt).toBe("string");
    expect(typeof cp!.finishedAt).toBe("string");
  });

  it("finalize() returns null when begin() was never called", () => {
    const result = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: false });
    expect(result).toBeNull();
  });

  // ── tool call recording ─────────────────────────────────────────────────────

  it("recordToolCall accumulates records reflected in toolCallCount", () => {
    store.begin("task", "model");
    store.recordToolCall(makeToolRecord({ name: "read_file" }));
    store.recordToolCall(makeToolRecord({ name: "bash", isError: true }));
    store.recordToolCall(makeToolRecord({ name: "write_file", wasRetried: true }));

    const cp = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    expect(cp!.toolCallCount).toBe(3);
    expect(cp!.toolErrorCount).toBe(1);
    expect(cp!.retryCount).toBe(1);
  });

  it("truncates large input strings to ≤200 chars", () => {
    store.begin("task", "model");
    const longInput = { command: "x".repeat(500) };
    store.recordToolCall(makeToolRecord({ input: longInput }));

    const cp = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    const recorded = cp!.toolCalls[0];
    expect((recorded.input.command as string).length).toBeLessThanOrEqual(201); // 200 + ellipsis
  });

  it("truncates resultSnippet to ≤300 chars", () => {
    store.begin("task", "model");
    store.recordToolCall(makeToolRecord({ resultSnippet: "y".repeat(600) }));

    const cp = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    expect(cp!.toolCalls[0].resultSnippet.length).toBeLessThanOrEqual(300);
  });

  // ── incrementTurn / markCompaction ──────────────────────────────────────────

  it("incrementTurn updates turnCount in finalized checkpoint", () => {
    store.begin("task", "model");
    store.incrementTurn();
    store.incrementTurn();
    store.incrementTurn();

    const cp = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    expect(cp!.turnCount).toBe(3);
  });

  it("markCompaction sets compactionTriggered = true", () => {
    store.begin("task", "model");
    expect(store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true })!.compactionTriggered).toBe(false);

    store.begin("task2", "model");
    store.markCompaction();
    const cp = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    expect(cp!.compactionTriggered).toBe(true);
  });

  // ── persistence ─────────────────────────────────────────────────────────────

  it("persists checkpoint to .autoagent/reflections.jsonl", () => {
    store.begin("task", "model");
    store.finalize({ assistantResponse: "done", filesModified: ["a.ts"], tokensIn: 1, tokensOut: 1, costUsd: 0, success: true });

    const filePath = join(tmpDir, ".autoagent", "reflections.jsonl");
    expect(existsSync(filePath)).toBe(true);
    const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(1);
    const cp = JSON.parse(lines[0]) as ReflectionCheckpoint;
    expect(cp.model).toBe("model");
  });

  it("appends multiple checkpoints, one per line", () => {
    for (let i = 0; i < 3; i++) {
      store.begin(`task ${i}`, "m");
      store.finalize({ assistantResponse: "", filesModified: [], tokensIn: i, tokensOut: 0, costUsd: 0, success: true });
    }
    const filePath = join(tmpDir, ".autoagent", "reflections.jsonl");
    const lines = readFileSync(filePath, "utf-8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(3);
    const parsed = lines.map(l => JSON.parse(l) as ReflectionCheckpoint);
    expect(parsed[0].tokensIn).toBe(0);
    expect(parsed[1].tokensIn).toBe(1);
    expect(parsed[2].tokensIn).toBe(2);
  });

  it("loads existing JSONL on construction (ring-buffer hydration)", () => {
    // Write 3 checkpoints with first store
    for (let i = 0; i < 3; i++) {
      store.begin(`t${i}`, "m");
      store.finalize({ assistantResponse: "", filesModified: [], tokensIn: i, tokensOut: 0, costUsd: 0, success: true });
    }
    // Fresh store from same dir should see them
    const store2 = new ReflectionStore(tmpDir);
    const recent = store2.getRecent(10);
    expect(recent.length).toBe(3);
  });

  // ── getRecent ───────────────────────────────────────────────────────────────

  it("getRecent returns up to N checkpoints, most-recent last", () => {
    for (let i = 0; i < 5; i++) {
      store.begin(`task${i}`, "m");
      store.finalize({ assistantResponse: "", filesModified: [], tokensIn: i, tokensOut: 0, costUsd: 0, success: true });
    }
    const last2 = store.getRecent(2);
    expect(last2.length).toBe(2);
    expect(last2[0].tokensIn).toBe(3);
    expect(last2[1].tokensIn).toBe(4);
  });

  it("getRecent returns empty array when no checkpoints exist", () => {
    expect(store.getRecent()).toEqual([]);
  });

  // ── getSummary ──────────────────────────────────────────────────────────────

  it("getSummary returns zeroed summary when empty", () => {
    const s = store.getSummary();
    expect(s.total).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.topErrorTools).toEqual([]);
  });

  it("getSummary computes successRate, avgCostUsd, topErrorTools correctly", () => {
    // 2 successful, 1 failed
    store.begin("t1", "m"); store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 1.0, success: true });
    store.begin("t2", "m"); store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0.5, success: false });
    store.begin("t3", "m"); store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0.5, success: true });

    // Add error tool calls to last checkpoint via begin/record/finalize
    store.begin("t4", "m");
    store.recordToolCall(makeToolRecord({ name: "bash",      isError: true }));
    store.recordToolCall(makeToolRecord({ name: "bash",      isError: true }));
    store.recordToolCall(makeToolRecord({ name: "read_file", isError: true }));
    store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });

    const s = store.getSummary();
    expect(s.total).toBe(4);
    expect(s.successRate).toBeCloseTo(0.75);
    expect(s.avgCostUsd).toBeCloseTo((1.0 + 0.5 + 0.5 + 0) / 4);
    expect(s.topErrorTools[0].name).toBe("bash");
    expect(s.topErrorTools[0].count).toBe(2);
    expect(s.topErrorTools[1].name).toBe("read_file");
  });

  // ── idempotency ─────────────────────────────────────────────────────────────

  it("second finalize() without a new begin() returns null (idempotent)", () => {
    store.begin("t", "m");
    store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    const second = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    expect(second).toBeNull();
  });

  it("begin() on an existing in-progress checkpoint replaces it cleanly", () => {
    store.begin("first", "m");
    store.recordToolCall(makeToolRecord());
    // Start a new task without finalising the first
    store.begin("second", "m");
    const cp = store.finalize({ assistantResponse: "", filesModified: [], tokensIn: 0, tokensOut: 0, costUsd: 0, success: true });
    expect(cp!.userMessage).toBe("second");
    expect(cp!.toolCallCount).toBe(0); // fresh state, no carries from first
  });
});
