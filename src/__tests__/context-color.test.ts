import { describe, it, expect } from "vitest";
import { getContextColor } from "../tui.js";

describe("getContextColor", () => {
  it("returns gray for ratio below 0.7", () => {
    expect(getContextColor(0)).toBe("gray");
    expect(getContextColor(0.3)).toBe("gray");
    expect(getContextColor(0.5)).toBe("gray");
    expect(getContextColor(0.69)).toBe("gray");
  });

  it("returns yellow for ratio 0.7 to below 0.9", () => {
    expect(getContextColor(0.7)).toBe("yellow");
    expect(getContextColor(0.8)).toBe("yellow");
    expect(getContextColor(0.89)).toBe("yellow");
  });

  it("returns red for ratio >= 0.9", () => {
    expect(getContextColor(0.9)).toBe("red");
    expect(getContextColor(1.0)).toBe("red");
    expect(getContextColor(1.5)).toBe("red");
  });

  it("handles edge cases", () => {
    expect(getContextColor(-1)).toBe("gray");   // negative → below threshold
    expect(getContextColor(0.9)).toBe("red");   // exact boundary
    expect(getContextColor(0.7)).toBe("yellow"); // exact boundary
  });
});
