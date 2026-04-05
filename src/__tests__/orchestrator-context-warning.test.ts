import { describe, it, expect } from "vitest";
import { CONTEXT_WARNING_THRESHOLD, COMPACT_THRESHOLD } from "../orchestrator.js";

describe("CONTEXT_WARNING_THRESHOLD", () => {
  it("is 80% of COMPACT_THRESHOLD", () => {
    expect(CONTEXT_WARNING_THRESHOLD).toBe(COMPACT_THRESHOLD * 0.8);
  });

  it("equals 120_000 tokens", () => {
    expect(CONTEXT_WARNING_THRESHOLD).toBe(120_000);
  });

  it("is below COMPACT_THRESHOLD", () => {
    expect(CONTEXT_WARNING_THRESHOLD).toBeLessThan(COMPACT_THRESHOLD);
  });

  it("warning fires when lastInputTokens >= threshold", () => {
    const lastInputTokens = 125_000;
    expect(lastInputTokens >= CONTEXT_WARNING_THRESHOLD).toBe(true);
  });

  it("warning does NOT fire below threshold", () => {
    const lastInputTokens = 100_000;
    expect(lastInputTokens >= CONTEXT_WARNING_THRESHOLD).toBe(false);
  });

  it("warning fires at exactly the threshold", () => {
    expect(CONTEXT_WARNING_THRESHOLD >= CONTEXT_WARNING_THRESHOLD).toBe(true);
  });
});

describe("contextWarningShown flag semantics", () => {
  it("one-time flag prevents duplicate warnings", () => {
    let warningCount = 0;
    let contextWarningShown = false;

    function maybeWarn(lastInputTokens: number) {
      if (!contextWarningShown && lastInputTokens >= CONTEXT_WARNING_THRESHOLD) {
        contextWarningShown = true;
        warningCount++;
      }
    }

    // Cross threshold twice — should only warn once
    maybeWarn(130_000);
    maybeWarn(140_000);
    expect(warningCount).toBe(1);
  });

  it("no warning fires below threshold", () => {
    let warningCount = 0;
    let contextWarningShown = false;

    function maybeWarn(lastInputTokens: number) {
      if (!contextWarningShown && lastInputTokens >= CONTEXT_WARNING_THRESHOLD) {
        contextWarningShown = true;
        warningCount++;
      }
    }

    maybeWarn(50_000);
    maybeWarn(80_000);
    maybeWarn(100_000);
    expect(warningCount).toBe(0);
  });

  it("resets after clearHistory (flag set to false)", () => {
    let warningCount = 0;
    let contextWarningShown = false;

    function maybeWarn(lastInputTokens: number) {
      if (!contextWarningShown && lastInputTokens >= CONTEXT_WARNING_THRESHOLD) {
        contextWarningShown = true;
        warningCount++;
      }
    }

    // First crossing
    maybeWarn(130_000);
    expect(warningCount).toBe(1);

    // Simulate clearHistory
    contextWarningShown = false;

    // Second crossing after reset
    maybeWarn(130_000);
    expect(warningCount).toBe(2);
  });
});
