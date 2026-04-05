import { describe, it, expect } from "vitest";
import {
  selectCompactionTier,
  MICRO_COMPACT_THRESHOLD,
  COMPACT_TIER1_THRESHOLD,
  COMPACT_THRESHOLD,
} from "../orchestrator.js";

// ─── selectCompactionTier boundary tests ────────────────────────────────────

describe("selectCompactionTier", () => {
  it("returns 'none' below micro threshold", () => {
    expect(selectCompactionTier(0)).toBe("none");
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD - 1)).toBe("none");
  });

  it("returns 'micro' at MICRO_COMPACT_THRESHOLD", () => {
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD)).toBe("micro");
  });

  it("returns 'micro' between micro and tier1 thresholds", () => {
    expect(selectCompactionTier(MICRO_COMPACT_THRESHOLD + 1)).toBe("micro");
    expect(selectCompactionTier(COMPACT_TIER1_THRESHOLD - 1)).toBe("micro");
  });

  it("returns 'tier1' at COMPACT_TIER1_THRESHOLD", () => {
    expect(selectCompactionTier(COMPACT_TIER1_THRESHOLD)).toBe("tier1");
  });

  it("returns 'tier1' between tier1 and compact thresholds", () => {
    expect(selectCompactionTier(COMPACT_TIER1_THRESHOLD + 1)).toBe("tier1");
    expect(selectCompactionTier(COMPACT_THRESHOLD - 1)).toBe("tier1");
  });

  it("returns 'tier2' at COMPACT_THRESHOLD", () => {
    expect(selectCompactionTier(COMPACT_THRESHOLD)).toBe("tier2");
  });

  it("returns 'tier2' above COMPACT_THRESHOLD", () => {
    expect(selectCompactionTier(COMPACT_THRESHOLD + 10_000)).toBe("tier2");
  });

  it("covers exact boundary values from spec", () => {
    expect(selectCompactionTier(79_999)).toBe("none");
    expect(selectCompactionTier(80_000)).toBe("micro");
    expect(selectCompactionTier(99_999)).toBe("micro");
    expect(selectCompactionTier(100_000)).toBe("tier1");
    expect(selectCompactionTier(149_999)).toBe("tier1");
    expect(selectCompactionTier(150_000)).toBe("tier2");
  });
});
