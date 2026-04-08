import { describe, it, expect } from "vitest";
import {
  compactionUrgency,
  selectCompactionTier,
  MICRO_COMPACT_THRESHOLD,
  COMPACT_TIER1_THRESHOLD,
  COMPACT_THRESHOLD,
} from "../src/orchestrator.js";

describe("compactionUrgency", () => {
  it("returns 1.0 when fewer than 3 turns", () => {
    expect(compactionUrgency([])).toBe(1.0);
    expect(compactionUrgency([10000])).toBe(1.0);
    expect(compactionUrgency([10000, 12000])).toBe(1.0);
  });

  it("returns 1.0 for steady token usage", () => {
    expect(compactionUrgency([10000, 10200, 10400, 10500, 10600])).toBe(1.0);
  });

  it("returns 0.85 for moderate growth (>25%)", () => {
    // growth: (14000 - 10000) / 10000 = 0.4 → > 0.25 but not > 0.5
    expect(compactionUrgency([10000, 11000, 12000, 13000, 14000])).toBe(0.85);
  });

  it("returns 0.7 for high growth (>50%)", () => {
    // growth: (20000 - 10000) / 10000 = 1.0 → > 0.5
    expect(compactionUrgency([10000, 12000, 14000, 16000, 20000])).toBe(0.7);
  });

  it("uses last 5 turns when history is longer", () => {
    // First entries are noisy; last 5 are steady
    const history = [1000, 50000, 10000, 10200, 10400, 10500, 10600];
    expect(compactionUrgency(history)).toBe(1.0);
  });

  it("returns 1.0 when first value is 0", () => {
    expect(compactionUrgency([0, 10000, 20000])).toBe(1.0);
  });
});

describe("selectCompactionTier", () => {
  it("returns none below micro threshold", () => {
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD - 1)).toBe("none");
  });

  it("returns micro at micro threshold", () => {
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD)).toBe("micro");
  });

  it("returns tier1 at tier1 threshold", () => {
    expect(selectCompactionTier(COMPACT_TIER1_THRESHOLD)).toBe("tier1");
  });

  it("returns tier2 at full threshold", () => {
    expect(selectCompactionTier(COMPACT_THRESHOLD)).toBe("tier2");
  });

  it("urgency multiplier causes earlier tier2 trigger", () => {
    // 110K normally would be tier1 (100K–150K), but with 0.7 multiplier tier2 = 105K
    expect(selectCompactionTier(110000, 0.7)).toBe("tier2");
    expect(selectCompactionTier(110000, 1.0)).toBe("tier1");
  });

  it("urgency multiplier causes earlier micro trigger", () => {
    // 60K normally 'none', but with 0.7 multiplier micro = 56K
    expect(selectCompactionTier(60000, 0.7)).toBe("micro");
    expect(selectCompactionTier(60000, 1.0)).toBe("none");
  });
});
