import { describe, it, expect } from "vitest";
import { selectModel, autoSelectModel } from "../model-selection.js";

// Also export for self-test runner
export function runModelSelectionTests(): void {
  console.log("  model-selection tests...");
  // Delegated to vitest — just a no-op for legacy runner
  console.log("  ✓ model-selection: delegated to vitest");
}

describe("model-selection", () => {
  it("respects force override", () => {
    expect(selectModel({ description: "anything", forceModel: "balanced" })).toBe("balanced");
    expect(selectModel({ description: "anything", forceModel: "fast" })).toBe("fast");
  });

  it("selects balanced for edge-case-sensitive tasks", () => {
    expect(selectModel({ description: "flatten object", edgeCaseSensitive: true })).toBe("balanced");
  });

  it("selects balanced for nuanced tasks", () => {
    expect(selectModel({ description: "review code", requiresNuance: true })).toBe("balanced");
  });

  it("defaults to fast for simple tasks", () => {
    expect(selectModel({ description: "summarize file" })).toBe("fast");
    expect(selectModel({ description: "format output", codeGeneration: true })).toBe("fast");
  });

  describe("autoSelectModel keyword detection", () => {
    it("selects balanced for complex keywords", () => {
      expect(autoSelectModel("Review this code for bugs")).toBe("balanced");
      expect(autoSelectModel("Audit the architecture")).toBe("balanced");
      expect(autoSelectModel("Check for edge cases in parsing")).toBe("balanced");
      expect(autoSelectModel("Refactor the module structure")).toBe("balanced");
    });

    it("selects fast for simple keywords", () => {
      expect(autoSelectModel("Summarize this file")).toBe("fast");
      expect(autoSelectModel("Extract the function names")).toBe("fast");
    });
  });
});
