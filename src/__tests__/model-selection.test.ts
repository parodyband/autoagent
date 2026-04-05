import { strict as assert } from "assert";
import { selectModel, autoSelectModel } from "../model-selection.js";

export function runModelSelectionTests(): void {
  console.log("  model-selection tests...");

  // Force override
  assert.equal(selectModel({ description: "anything", forceModel: "balanced" }), "balanced");
  assert.equal(selectModel({ description: "anything", forceModel: "fast" }), "fast");

  // Edge-case sensitive → balanced
  assert.equal(selectModel({ description: "flatten object", edgeCaseSensitive: true }), "balanced");

  // Requires nuance → balanced
  assert.equal(selectModel({ description: "review code", requiresNuance: true }), "balanced");

  // Simple task → fast
  assert.equal(selectModel({ description: "summarize file" }), "fast");
  assert.equal(selectModel({ description: "format output", codeGeneration: true }), "fast");

  // autoSelectModel keyword detection
  assert.equal(autoSelectModel("Review this code for bugs"), "balanced");
  assert.equal(autoSelectModel("Audit the architecture"), "balanced");
  assert.equal(autoSelectModel("Check for edge cases in parsing"), "balanced");
  assert.equal(autoSelectModel("Summarize this file"), "fast");
  assert.equal(autoSelectModel("Extract the function names"), "fast");
  assert.equal(autoSelectModel("Refactor the module structure"), "balanced");

  console.log("  ✓ model-selection: all tests passed");
}
