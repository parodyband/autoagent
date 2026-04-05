import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "fs";
import path from "path";
import os from "os";
import { recordMetrics, parsePredictedTurns, type IterationMetrics } from "../finalization.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `finalization-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeMetrics(overrides: Partial<IterationMetrics> = {}): IterationMetrics {
  return {
    iteration: 1,
    startTime: "2024-01-01T00:00:00.000Z",
    endTime: "2024-01-01T01:00:00.000Z",
    turns: 10,
    toolCalls: { bash: 3, read_file: 2 },
    success: true,
    durationMs: 3600000,
    inputTokens: 5000,
    outputTokens: 1000,
    ...overrides,
  };
}

// ─── recordMetrics ───────────────────────────────────────────────────────────

describe("recordMetrics", () => {
  it("creates a new file when none exists", () => {
    const metricsFile = path.join(tmpDir, "metrics.json");
    const m = makeMetrics({ iteration: 1 });
    recordMetrics(metricsFile, m);

    expect(existsSync(metricsFile)).toBe(true);
    const data = JSON.parse(readFileSync(metricsFile, "utf-8"));
    expect(data).toHaveLength(1);
    expect(data[0].iteration).toBe(1);
    expect(data[0].turns).toBe(10);
  });

  it("appends to an existing file", () => {
    const metricsFile = path.join(tmpDir, "metrics.json");
    const m1 = makeMetrics({ iteration: 1, turns: 10 });
    const m2 = makeMetrics({ iteration: 2, turns: 14 });

    recordMetrics(metricsFile, m1);
    recordMetrics(metricsFile, m2);

    const data = JSON.parse(readFileSync(metricsFile, "utf-8"));
    expect(data).toHaveLength(2);
    expect(data[0].iteration).toBe(1);
    expect(data[1].iteration).toBe(2);
    expect(data[1].turns).toBe(14);
  });

  it("handles malformed JSON by treating existing file as empty array", () => {
    const metricsFile = path.join(tmpDir, "metrics.json");
    writeFileSync(metricsFile, "not-valid-json", "utf-8");

    const m = makeMetrics({ iteration: 5 });
    // Should not throw
    expect(() => recordMetrics(metricsFile, m)).not.toThrow();

    const data = JSON.parse(readFileSync(metricsFile, "utf-8"));
    expect(data).toHaveLength(1);
    expect(data[0].iteration).toBe(5);
  });

  it("preserves optional fields like cacheCreationTokens", () => {
    const metricsFile = path.join(tmpDir, "metrics.json");
    const m = makeMetrics({ cacheCreationTokens: 500, cacheReadTokens: 200 });
    recordMetrics(metricsFile, m);

    const data = JSON.parse(readFileSync(metricsFile, "utf-8"));
    expect(data[0].cacheCreationTokens).toBe(500);
    expect(data[0].cacheReadTokens).toBe(200);
  });

  it("accumulates many entries across multiple calls", () => {
    const metricsFile = path.join(tmpDir, "metrics.json");
    for (let i = 1; i <= 5; i++) {
      recordMetrics(metricsFile, makeMetrics({ iteration: i }));
    }
    const data = JSON.parse(readFileSync(metricsFile, "utf-8"));
    expect(data).toHaveLength(5);
    expect(data.map((d: IterationMetrics) => d.iteration)).toEqual([1, 2, 3, 4, 5]);
  });
});

// ─── parsePredictedTurns ─────────────────────────────────────────────────────

describe("parsePredictedTurns", () => {
  it("returns null when goals.md does not exist", () => {
    expect(parsePredictedTurns(tmpDir)).toBeNull();
  });

  it("parses PREDICTION_TURNS: N format", () => {
    writeFileSync(path.join(tmpDir, "goals.md"), "PREDICTION_TURNS: 14\n\n## Goals", "utf-8");
    expect(parsePredictedTurns(tmpDir)).toBe(14);
  });

  it("parses 'Predicted turns: N' format (case-insensitive start)", () => {
    writeFileSync(path.join(tmpDir, "goals.md"), "## Header\nPredicted turns: 12\n", "utf-8");
    expect(parsePredictedTurns(tmpDir)).toBe(12);
  });

  it("parses 'predicted turns: N' lowercase", () => {
    writeFileSync(path.join(tmpDir, "goals.md"), "predicted turns: 9\n", "utf-8");
    expect(parsePredictedTurns(tmpDir)).toBe(9);
  });

  it("returns null when no recognized pattern is present", () => {
    writeFileSync(path.join(tmpDir, "goals.md"), "# Goals\n\nNo prediction here.\n", "utf-8");
    expect(parsePredictedTurns(tmpDir)).toBeNull();
  });

  it("returns null for an empty goals.md", () => {
    writeFileSync(path.join(tmpDir, "goals.md"), "", "utf-8");
    expect(parsePredictedTurns(tmpDir)).toBeNull();
  });

  it("parses PREDICTION: ...N turns format", () => {
    writeFileSync(path.join(tmpDir, "goals.md"), "PREDICTION: approximately 16 turns needed\n", "utf-8");
    expect(parsePredictedTurns(tmpDir)).toBe(16);
  });
});
