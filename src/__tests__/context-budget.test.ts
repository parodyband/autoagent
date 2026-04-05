import { describe, it, expect } from "vitest";
import { getContextColor } from "../tui.js";

describe("getContextColor", () => {
  it("returns gray for 0", () => {
    expect(getContextColor(0)).toBe("gray");
  });

  it("returns gray for 0.5", () => {
    expect(getContextColor(0.5)).toBe("gray");
  });

  it("returns yellow for 0.7", () => {
    expect(getContextColor(0.7)).toBe("yellow");
  });

  it("returns yellow for 0.89", () => {
    expect(getContextColor(0.89)).toBe("yellow");
  });

  it("returns red for 0.9", () => {
    expect(getContextColor(0.9)).toBe("red");
  });

  it("returns red for 1.0", () => {
    expect(getContextColor(1.0)).toBe("red");
  });
});
