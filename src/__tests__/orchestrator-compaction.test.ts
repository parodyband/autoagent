import { describe, it, expect } from "vitest";
import { COMPACT_TIER1_THRESHOLD, COMPACT_THRESHOLD } from "../orchestrator.js";

vi.mock("../file-ranker.js", () => ({
  rankFiles: vi.fn().mockResolvedValue([]),
}));
vi.mock("../symbol-index.js", () => ({
  buildSymbolIndex: vi.fn().mockResolvedValue({}),
  formatRepoMap: vi.fn().mockReturnValue(""),
}));

import { vi } from "vitest";

describe("tiered compaction thresholds", () => {
  it("Tier 1 threshold is 100K", () => {
    expect(COMPACT_TIER1_THRESHOLD).toBe(100_000);
  });

  it("Tier 2 threshold is 150K", () => {
    expect(COMPACT_THRESHOLD).toBe(150_000);
  });

  it("Tier 1 threshold is lower than Tier 2 threshold", () => {
    expect(COMPACT_TIER1_THRESHOLD).toBeLessThan(COMPACT_THRESHOLD);
  });

  it("Tier 1 triggers at exactly 100K tokens", () => {
    const tokens = 100_000;
    const tier1Triggered = tokens >= COMPACT_TIER1_THRESHOLD && tokens < COMPACT_THRESHOLD;
    expect(tier1Triggered).toBe(true);
  });

  it("Tier 1 does NOT trigger below 100K", () => {
    const tokens = 99_999;
    const tier1Triggered = tokens >= COMPACT_TIER1_THRESHOLD && tokens < COMPACT_THRESHOLD;
    expect(tier1Triggered).toBe(false);
  });

  it("Tier 2 triggers at exactly 150K tokens", () => {
    const tokens = 150_000;
    const tier2Triggered = tokens >= COMPACT_THRESHOLD;
    expect(tier2Triggered).toBe(true);
  });

  it("Tier 1 does NOT trigger at 150K (Tier 2 takes over)", () => {
    const tokens = 150_000;
    const tier1Triggered = tokens >= COMPACT_TIER1_THRESHOLD && tokens < COMPACT_THRESHOLD;
    expect(tier1Triggered).toBe(false);
  });
});
