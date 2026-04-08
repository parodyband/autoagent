import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  detectPatterns,
  generateGuidancePrompt,
  aggregate,
  savePatternCache,
  loadPatternCache,
  type FailurePattern,
  type AggregateReport,
} from "../reflection-aggregator.js";
import type { ReflectionCheckpoint, ToolCallRecord } from "../reflection.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeToolCall(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    name: "bash",
    input: { command: "echo hi" },
    resultSnippet: "hi",
    durationMs: 10,
    isError: false,
    wasRetried: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

let _seq = 0;
function makeCheckpoint(overrides: Partial<ReflectionCheckpoint> = {}): ReflectionCheckpoint {
  _seq++;
  const ts = new Date(Date.now() - (_seq * 60_000)).toISOString(); // stagger by 1 min
  return {
    id:                  `rc-test-${_seq.toString(16).padStart(4, "0")}`,
    startedAt:           ts,
    finishedAt:          ts,
    durationMs:          5_000,
    userMessage:         "fix the bug",
    model:               "claude-sonnet",
    assistantResponse:   "done",
    filesModified:       [],
    toolCalls:           [],
    toolCallCount:       0,
    toolErrorCount:      0,
    retryCount:          0,
    tokensIn:            1_000,
    tokensOut:           200,
    costUsd:             0.005,
    turnCount:           3,
    compactionTriggered: false,
    success:             true,
    ...overrides,
  };
}

// ─── detectPatterns ───────────────────────────────────────────────────────────

describe("detectPatterns", () => {
  beforeEach(() => { _seq = 0; });

  it("returns [] for empty input", () => {
    expect(detectPatterns([])).toEqual([]);
  });

  it("returns [] when each pattern appears only once (below MIN_OCCURRENCES)", () => {
    const cps = [
      makeCheckpoint({ toolCalls: [makeToolCall({ isError: true, resultSnippet: "ENOENT" })] }),
      makeCheckpoint({ toolCalls: [makeToolCall({ name: "grep", isError: true, resultSnippet: "No matches" })] }),
    ];
    const patterns = detectPatterns(cps);
    // Each tool error appears only once → filtered out
    expect(patterns.length).toBe(0);
  });

  it("surfaces a tool_error pattern when the same tool+category errors in ≥2 checkpoints", () => {
    const cps = [
      makeCheckpoint({ toolCalls: [makeToolCall({ name: "bash", isError: true, resultSnippet: "command timed out" })] }),
      makeCheckpoint({ toolCalls: [makeToolCall({ name: "bash", isError: true, resultSnippet: "operation timed out" })] }),
    ];
    const patterns = detectPatterns(cps);
    expect(patterns.length).toBeGreaterThan(0);
    const p = patterns.find(p => p.id === "tool_error:bash:timeout");
    expect(p).toBeDefined();
    expect(p!.occurrences).toBe(2);
    expect(p!.category).toBe("tool_error");
    expect(p!.toolName).toBe("bash");
  });

  it("detects file_not_found errors from ENOENT messages", () => {
    const errSnippet = "Error: ENOENT: no such file or directory, open 'src/missing.ts'";
    const cps = [
      makeCheckpoint({ toolCalls: [makeToolCall({ name: "read_file", isError: true, resultSnippet: errSnippet })] }),
      makeCheckpoint({ toolCalls: [makeToolCall({ name: "read_file", isError: true, resultSnippet: errSnippet })] }),
    ];
    const patterns = detectPatterns(cps);
    const p = patterns.find(p => p.id.includes("file_not_found"));
    expect(p).toBeDefined();
    expect(p!.toolName).toBe("read_file");
    expect(p!.examples.length).toBeGreaterThan(0);
  });

  it("detects auto_retry patterns", () => {
    const cps = [
      makeCheckpoint({ toolCalls: [makeToolCall({ name: "bash", wasRetried: true })] }),
      makeCheckpoint({ toolCalls: [makeToolCall({ name: "bash", wasRetried: true })] }),
    ];
    const patterns = detectPatterns(cps);
    const p = patterns.find(p => p.id === "auto_retry:bash");
    expect(p).toBeDefined();
    expect(p!.category).toBe("auto_retry");
    expect(p!.occurrences).toBe(2);
  });

  it("detects verification_fail patterns", () => {
    const cps = [
      makeCheckpoint({ verificationPassed: false }),
      makeCheckpoint({ verificationPassed: false }),
      makeCheckpoint({ verificationPassed: true }),
    ];
    const patterns = detectPatterns(cps);
    const p = patterns.find(p => p.category === "verification_fail");
    expect(p).toBeDefined();
    expect(p!.occurrences).toBe(2);
  });

  it("detects context_overflow (compaction) patterns", () => {
    const cps = [
      makeCheckpoint({ compactionTriggered: true }),
      makeCheckpoint({ compactionTriggered: true }),
    ];
    const patterns = detectPatterns(cps);
    const p = patterns.find(p => p.category === "context_overflow");
    expect(p).toBeDefined();
    expect(p!.suggestedFix).toMatch(/sed|head|cat/i);
  });

  it("detects tsc_failure patterns", () => {
    const cps = [
      makeCheckpoint({ tscClean: false }),
      makeCheckpoint({ tscClean: false }),
    ];
    const patterns = detectPatterns(cps);
    const p = patterns.find(p => p.category === "tsc_failure");
    expect(p).toBeDefined();
  });

  it("assigns higher weight to patterns in more-recent checkpoints", () => {
    // Make a 6-checkpoint window: pattern A only in oldest 2, pattern B only in newest 2
    const cps = [
      // oldest (idx 0,1) — only pattern A (verification fail)
      makeCheckpoint({ verificationPassed: false }),
      makeCheckpoint({ verificationPassed: false }),
      // middle (idx 2,3) — clean
      makeCheckpoint(),
      makeCheckpoint(),
      // newest (idx 4,5) — only pattern B (compaction)
      makeCheckpoint({ compactionTriggered: true }),
      makeCheckpoint({ compactionTriggered: true }),
    ];
    const patterns = detectPatterns(cps);
    const patternA = patterns.find(p => p.category === "verification_fail");
    const patternB = patterns.find(p => p.category === "context_overflow");
    expect(patternA).toBeDefined();
    expect(patternB).toBeDefined();
    // B is in the newest third → higher weight
    expect(patternB!.weight).toBeGreaterThan(patternA!.weight);
  });

  it("deduplicates tool errors that repeat within a single checkpoint", () => {
    // Same tool+category errors 5× in one checkpoint — should count as ONE occurrence
    const cps = [
      makeCheckpoint({
        toolCalls: Array.from({ length: 5 }, () =>
          makeToolCall({ name: "bash", isError: true, resultSnippet: "timed out" })
        ),
      }),
      makeCheckpoint({
        toolCalls: [makeToolCall({ name: "bash", isError: true, resultSnippet: "operation timed out" })],
      }),
    ];
    const patterns = detectPatterns(cps);
    const p = patterns.find(p => p.id === "tool_error:bash:timeout");
    // 2 checkpoints saw the pattern → occurrences = 2, not 6
    expect(p!.occurrences).toBe(2);
  });

  it("caps examples at 3 per pattern", () => {
    const cps = Array.from({ length: 5 }, (_, i) =>
      makeCheckpoint({
        toolCalls: [makeToolCall({ name: "read_file", isError: true, resultSnippet: `ENOENT ${i}` })],
      })
    );
    const patterns = detectPatterns(cps);
    const p = patterns.find(p => p.id.includes("read_file") && p.id.includes("file_not_found"));
    expect(p).toBeDefined();
    expect(p!.examples.length).toBeLessThanOrEqual(3);
  });
});

// ─── generateGuidancePrompt ───────────────────────────────────────────────────

describe("generateGuidancePrompt", () => {
  it("returns empty string for empty pattern list", () => {
    expect(generateGuidancePrompt([])).toBe("");
  });

  it("returns empty string when all patterns filtered (empty after slice)", () => {
    expect(generateGuidancePrompt([], 10, 5)).toBe("");
  });

  it("contains the pattern description and fix in output", () => {
    const p: FailurePattern = {
      id: "tool_error:bash:timeout",
      category: "tool_error",
      toolName: "bash",
      description: "bash: command timeout",
      occurrences: 3,
      lastSeen: new Date().toISOString(),
      examples: ["timed out"],
      suggestedFix: "add | head -50",
      weight: 2.1,
    };
    const out = generateGuidancePrompt([p], 10);
    expect(out).toContain("bash: command timeout");
    expect(out).toContain("add | head -50");
    expect(out).toContain("3×");
    expect(out).toContain("last 10 tasks");
  });

  it("respects the max parameter and only includes top-N patterns", () => {
    const patterns: FailurePattern[] = Array.from({ length: 8 }, (_, i) => ({
      id: `test:pattern:${i}`,
      category: "tool_error" as const,
      description: `pattern ${i}`,
      occurrences: 2,
      lastSeen: new Date().toISOString(),
      examples: [],
      suggestedFix: `fix ${i}`,
      weight: 8 - i,
    }));
    const out = generateGuidancePrompt(patterns, 20, 3);
    expect(out).toContain("pattern 0");
    expect(out).toContain("pattern 1");
    expect(out).toContain("pattern 2");
    expect(out).not.toContain("pattern 3");
  });
});

// ─── aggregate ────────────────────────────────────────────────────────────────

describe("aggregate", () => {
  beforeEach(() => { _seq = 0; });

  it("returns zeroed report for empty input", () => {
    const r = aggregate([]);
    expect(r.windowSize).toBe(0);
    expect(r.successRate).toBe(0);
    expect(r.topPatterns).toEqual([]);
    expect(r.guidancePrompt).toBe("");
  });

  it("computes successRate correctly", () => {
    const cps = [
      makeCheckpoint({ success: true }),
      makeCheckpoint({ success: true }),
      makeCheckpoint({ success: false }),
    ];
    const r = aggregate(cps);
    expect(r.successRate).toBeCloseTo(2 / 3);
  });

  it("computes avgRetryRate across all tool calls", () => {
    const cps = [
      makeCheckpoint({ toolCalls: [makeToolCall({ wasRetried: true }), makeToolCall()] }),
      makeCheckpoint({ toolCalls: [makeToolCall(), makeToolCall()] }),
    ];
    const r = aggregate(cps);
    // 1 retry out of 4 total calls = 0.25
    expect(r.avgRetryRate).toBeCloseTo(0.25);
  });

  it("computes compactionRate correctly", () => {
    const cps = [
      makeCheckpoint({ compactionTriggered: true }),
      makeCheckpoint({ compactionTriggered: false }),
      makeCheckpoint({ compactionTriggered: true }),
    ];
    const r = aggregate(cps);
    expect(r.compactionRate).toBeCloseTo(2 / 3);
  });

  it("populates toolErrorRates per tool", () => {
    const cps = [
      makeCheckpoint({
        toolCalls: [
          makeToolCall({ name: "bash", isError: true }),
          makeToolCall({ name: "bash", isError: false }),
          makeToolCall({ name: "read_file", isError: false }),
        ],
      }),
    ];
    const r = aggregate(cps);
    expect(r.toolErrorRates["bash"]).toBeCloseTo(0.5);
    expect(r.toolErrorRates["read_file"]).toBeCloseTo(0.0);
  });

  it("sets guidancePrompt when recurring patterns exist", () => {
    const cps = [
      makeCheckpoint({ compactionTriggered: true }),
      makeCheckpoint({ compactionTriggered: true }),
    ];
    const r = aggregate(cps);
    expect(r.guidancePrompt).not.toBe("");
    expect(r.guidancePrompt).toContain("Recurring Tool Patterns");
  });
});

// ─── savePatternCache / loadPatternCache ──────────────────────────────────────

describe("pattern cache persistence", () => {
  let tmpDir: string;

  beforeEach(() => {
    _seq = 0;
    tmpDir = join(tmpdir(), `agg-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    // create a .git marker so findProjectRoot returns tmpDir
    mkdirSync(join(tmpDir, ".git"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips an AggregateReport through save/load", () => {
    const cps = [
      makeCheckpoint({ compactionTriggered: true }),
      makeCheckpoint({ compactionTriggered: true }),
    ];
    const report = aggregate(cps);
    savePatternCache(tmpDir, report);

    const loaded = loadPatternCache(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.windowSize).toBe(2);
    expect(loaded!.compactionRate).toBeCloseTo(1.0);
    expect(loaded!.generatedAt).toBe(report.generatedAt);
  });

  it("returns null when no cache file exists", () => {
    expect(loadPatternCache(tmpDir)).toBeNull();
  });

  it("persists to .autoagent/patterns.json", () => {
    savePatternCache(tmpDir, aggregate([]));
    expect(existsSync(join(tmpDir, ".autoagent", "patterns.json"))).toBe(true);
  });
});
