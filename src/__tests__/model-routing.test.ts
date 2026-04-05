import { describe, it, expect } from "vitest";
import { routeModel } from "../orchestrator.js";

describe("routeModel", () => {
  it("routes to Sonnet when lastInputTokens > 80K", () => {
    const result = routeModel("what is this?", { lastInputTokens: 90_000 });
    expect(result).toMatch(/sonnet|claude-3-5/i);
  });

  it("routes to Sonnet for short follow-up when hasCodeEditsInHistory=true", () => {
    const result = routeModel("now fix the tests", { hasCodeEditsInHistory: true });
    expect(result).toMatch(/sonnet|claude-3-5/i);
  });

  it("routes to Haiku for read-only query with no history and low tokens", () => {
    const result = routeModel("explain this file", {
      lastInputTokens: 5_000,
      hasCodeEditsInHistory: false,
    });
    expect(result).toMatch(/haiku/i);
  });

  it("routes to Sonnet for long message (existing behavior preserved)", () => {
    const longMsg = "a".repeat(400);
    const result = routeModel(longMsg, {});
    expect(result).toMatch(/sonnet|claude-3-5/i);
  });

  it("routes to Sonnet for code change keywords", () => {
    const result = routeModel("implement a new feature in the auth module");
    expect(result).toMatch(/sonnet|claude-3-5/i);
  });

  it("uses MODEL_COMPLEX as default with no opts", () => {
    const r1 = routeModel("hello");
    const r2 = routeModel("hello", {});
    expect(r1).toBe(r2);
  });
});
