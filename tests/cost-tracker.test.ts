/**
 * Unit tests for CostTracker.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CostTracker } from "../src/cost-tracker.js";

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it("record() returns correct cost for known model (sonnet-4: 3/15 per 1M)", () => {
    const entry = tracker.record("claude-sonnet-4-20250514", 1_000_000, 1_000_000);
    // 1M input * $3/1M + 1M output * $15/1M = $18
    expect(entry.cost).toBeCloseTo(18, 5);
    expect(entry.model).toBe("claude-sonnet-4-20250514");
    expect(entry.inputTokens).toBe(1_000_000);
    expect(entry.outputTokens).toBe(1_000_000);
  });

  it("record() uses fallback pricing for unknown model", () => {
    const entry = tracker.record("unknown-model-xyz", 1_000_000, 0);
    // Fallback is sonnet pricing: $3/1M input
    expect(entry.cost).toBeCloseTo(3, 5);
  });

  it("totalCost sums multiple entries", () => {
    tracker.record("claude-sonnet-4-20250514", 1_000_000, 0); // $3
    tracker.record("claude-haiku-3-20250307", 1_000_000, 0);  // $0.25
    expect(tracker.totalCost).toBeCloseTo(3.25, 5);
  });

  it("totalInputTokens and totalOutputTokens are correct", () => {
    tracker.record("claude-sonnet-4-20250514", 500_000, 200_000);
    tracker.record("claude-sonnet-4-20250514", 300_000, 100_000);
    expect(tracker.totalInputTokens).toBe(800_000);
    expect(tracker.totalOutputTokens).toBe(300_000);
  });

  it("sessionSummary formats correctly", () => {
    tracker.record("claude-sonnet-4-20250514", 10_000, 500);
    // 10K in, 0.5K out
    const summary = tracker.sessionSummary;
    expect(summary).toMatch(/^\$\d+\.\d{2} \(\d+\.\dK in \/ \d+\.\dK out\)$/);
    expect(summary).toContain("10.0K in");
    expect(summary).toContain("0.5K out");
  });

  it("reset() clears all entries", () => {
    tracker.record("claude-sonnet-4-20250514", 1_000_000, 1_000_000);
    tracker.record("claude-sonnet-4-20250514", 500_000, 200_000);
    expect(tracker.entryCount).toBe(2);
    tracker.reset();
    expect(tracker.entryCount).toBe(0);
    expect(tracker.totalCost).toBe(0);
    expect(tracker.totalInputTokens).toBe(0);
    expect(tracker.totalOutputTokens).toBe(0);
  });

  it("entryCount returns correct count", () => {
    expect(tracker.entryCount).toBe(0);
    tracker.record("claude-sonnet-4-20250514", 100, 100);
    expect(tracker.entryCount).toBe(1);
    tracker.record("claude-haiku-3-20250307", 200, 50);
    expect(tracker.entryCount).toBe(2);
  });

  it("record() uses opus pricing for opus model", () => {
    const entry = tracker.record("claude-opus-4-20250514", 1_000_000, 1_000_000);
    // $15 input + $75 output = $90
    expect(entry.cost).toBeCloseTo(90, 5);
  });
});
