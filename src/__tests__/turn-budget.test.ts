import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import path from "path";
import os from "os";
import {
  computeTurnBudget,
  computeCalibration,
  readPredictionCalibration,
  dynamicBudgetWarning,
} from "../turn-budget.js";

// Temporary directory for test files
let tmpDir: string;

beforeEach(() => {
  tmpDir = path.join(os.tmpdir(), `turn-budget-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// Helper to write a metrics file
function writeMetrics(entries: object[]): string {
  const file = path.join(tmpDir, ".autoagent-metrics.json");
  writeFileSync(file, JSON.stringify(entries), "utf-8");
  return file;
}

// Helper to write memory.md with AUTO-SCORED lines
function writeMemory(ratios: number[]): void {
  const lines = ratios.map(
    (r, i) => `**[AUTO-SCORED] Iteration ${100 + i}: predicted 12 turns, actual ${Math.round(12 * r)} turns, ratio ${r.toFixed(2)}**`,
  );
  writeFileSync(path.join(tmpDir, "memory.md"), lines.join("\n"), "utf-8");
}

// ─── computeCalibration ──────────────────────────────────────────────────────

describe("computeCalibration", () => {
  it("returns 1.0 when fewer than minSamples ratios", () => {
    expect(computeCalibration([], 2)).toBe(1.0);
    expect(computeCalibration([1.5], 2)).toBe(1.0);
  });

  it("returns median of last 5 ratios", () => {
    // Sorted: [1.2, 1.3, 1.5, 1.5, 1.8] → median = 1.5
    const ratios = [1.5, 1.8, 1.2, 1.3, 1.5];
    expect(computeCalibration(ratios, 2)).toBe(1.5);
  });

  it("clamps to [0.6, 2.5]", () => {
    expect(computeCalibration([0.1, 0.1, 0.1], 2)).toBe(0.6);
    expect(computeCalibration([9.0, 9.0, 9.0], 2)).toBe(2.5);
  });
});

// ─── readPredictionCalibration ───────────────────────────────────────────────

describe("readPredictionCalibration", () => {
  it("returns [] when memory.md does not exist", () => {
    expect(readPredictionCalibration(tmpDir)).toEqual([]);
  });

  it("parses ratios from AUTO-SCORED lines", () => {
    writeMemory([1.50, 1.25, 1.08]);
    const ratios = readPredictionCalibration(tmpDir);
    expect(ratios).toHaveLength(3);
    expect(ratios[0]).toBeCloseTo(1.5);
    expect(ratios[1]).toBeCloseTo(1.25);
    expect(ratios[2]).toBeCloseTo(1.08);
  });

  it("returns [] for memory.md with no AUTO-SCORED lines", () => {
    writeFileSync(path.join(tmpDir, "memory.md"), "# Just notes\nNo ratios here.", "utf-8");
    expect(readPredictionCalibration(tmpDir)).toEqual([]);
  });
});

// ─── computeTurnBudget ───────────────────────────────────────────────────────

describe("computeTurnBudget", () => {
  it("returns safe defaults when metrics file does not exist", () => {
    const metricsFile = path.join(tmpDir, "missing.json");
    const budget = computeTurnBudget(metricsFile, null, 25, 10, tmpDir);

    expect(budget.recommended).toBeGreaterThanOrEqual(8);
    expect(budget.recommended).toBeLessThanOrEqual(25);
    expect(budget.hardMax).toBe(25);
    expect(budget.sampleSize).toBe(0);
    expect(budget.historicalAvg).toBe(0);
    expect(budget.predicted).toBeNull();
  });

  it("returns safe defaults when metrics file is empty array", () => {
    const metricsFile = writeMetrics([]);
    const budget = computeTurnBudget(metricsFile, null, 25, 10, tmpDir);

    expect(budget.sampleSize).toBe(0);
    expect(budget.recommended).toBeGreaterThanOrEqual(8);
    expect(budget.recommended).toBeLessThanOrEqual(25);
  });

  it("uses predicted turns + calibration when no history", () => {
    const metricsFile = path.join(tmpDir, "missing.json");
    // Write memory with consistent underestimation
    writeMemory([1.5, 1.5, 1.5]);
    const budget = computeTurnBudget(metricsFile, 12, 25, 10, tmpDir);

    // With calibration ~1.5, predicted budget should be higher than raw prediction
    expect(budget.recommended).toBeGreaterThan(12);
    expect(budget.predicted).toBe(12);
    expect(budget.calibration).toBeCloseTo(1.5);
  });

  it("computes budget from historical average with no prediction", () => {
    const entries = [
      { iteration: 1, turns: 15, success: true },
      { iteration: 2, turns: 18, success: true },
      { iteration: 3, turns: 20, success: true },
      { iteration: 4, turns: 17, success: true },
    ];
    const metricsFile = writeMetrics(entries);
    const budget = computeTurnBudget(metricsFile, null, 25, 10, tmpDir);

    expect(budget.sampleSize).toBe(4);
    expect(budget.historicalAvg).toBeCloseTo(17.5);
    // recommended = ceil(17.5 * 1.2) = 21
    expect(budget.recommended).toBe(21);
  });

  it("applies calibration to prediction when history exists", () => {
    // 4 successful entries averaging 18 turns
    const entries = Array.from({ length: 4 }, (_, i) => ({
      iteration: i + 1,
      turns: 18,
      success: true,
    }));
    const metricsFile = writeMetrics(entries);
    // calibration = 1.0 (no memory.md)
    const budget = computeTurnBudget(metricsFile, 14, 25, 10, tmpDir);

    // fromPrediction = ceil(14 * 1.0 * 1.3) = 19
    // fromHistory = ceil(18 * 1.2) = 22
    // recommended = min(19, 22) = 19
    expect(budget.recommended).toBe(19);
    expect(budget.calibration).toBe(1.0);
  });

  it("excludes failed iterations from average", () => {
    const entries = [
      { iteration: 1, turns: 20, success: false }, // excluded
      { iteration: 2, turns: 10, success: true },
      { iteration: 3, turns: 10, success: true },
    ];
    const metricsFile = writeMetrics(entries);
    const budget = computeTurnBudget(metricsFile, null, 25, 10, tmpDir);

    expect(budget.sampleSize).toBe(2);
    expect(budget.historicalAvg).toBe(10);
    // recommended = ceil(10 * 1.2) = 12
    expect(budget.recommended).toBe(12);
  });

  it("clamps recommended to [8, hardMax]", () => {
    const entries = [{ iteration: 1, turns: 3, success: true }];
    const metricsFile = writeMetrics(entries);
    const budget = computeTurnBudget(metricsFile, null, 25, 10, tmpDir);

    // ceil(3 * 1.2) = 4, but clamped to min 8
    expect(budget.recommended).toBeGreaterThanOrEqual(8);
  });

  it("warnAt is 80% of recommended", () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({
      iteration: i + 1,
      turns: 20,
      success: true,
    }));
    const metricsFile = writeMetrics(entries);
    const budget = computeTurnBudget(metricsFile, null, 25, 10, tmpDir);

    expect(budget.warnAt).toBe(Math.ceil(budget.recommended * 0.8));
  });
});

// ─── dynamicBudgetWarning ────────────────────────────────────────────────────

describe("dynamicBudgetWarning", () => {
  const budget = {
    recommended: 20,
    hardMax: 25,
    warnAt: 16,
    historicalAvg: 18,
    sampleSize: 5,
    predicted: 14,
    calibration: 1.25,
  };

  it("returns null before warnAt", () => {
    expect(dynamicBudgetWarning(10, budget)).toBeNull();
    expect(dynamicBudgetWarning(15, budget)).toBeNull();
  });

  it("returns warning string at warnAt", () => {
    const msg = dynamicBudgetWarning(16, budget);
    expect(msg).not.toBeNull();
    expect(msg).toContain("16");
    expect(msg).toContain("WARNING");
  });

  it("returns exceeded message at recommended", () => {
    const msg = dynamicBudgetWarning(20, budget);
    expect(msg).not.toBeNull();
    expect(msg).toContain("BUDGET EXCEEDED");
    expect(msg).toContain("20");
  });

  it("returns null between warnAt and recommended", () => {
    expect(dynamicBudgetWarning(17, budget)).toBeNull();
    expect(dynamicBudgetWarning(19, budget)).toBeNull();
  });
});
