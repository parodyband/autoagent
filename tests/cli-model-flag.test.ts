import { describe, it, expect } from "vitest";
import { resolveModelAlias } from "../src/cli.js";

describe("resolveModelAlias", () => {
  it("resolves 'sonnet' to full model ID", () => {
    expect(resolveModelAlias("sonnet")).toBe("claude-sonnet-4-6");
  });

  it("resolves 'haiku' to full model ID", () => {
    expect(resolveModelAlias("haiku")).toBe("claude-haiku-4-5");
  });

  it("resolves 'opus' to full model ID", () => {
    expect(resolveModelAlias("opus")).toBe("claude-opus-4-5");
  });

  it("is case-insensitive", () => {
    expect(resolveModelAlias("Sonnet")).toBe("claude-sonnet-4-6");
    expect(resolveModelAlias("HAIKU")).toBe("claude-haiku-4-5");
  });

  it("passes through unknown strings unchanged (full model IDs)", () => {
    expect(resolveModelAlias("claude-custom-model")).toBe("claude-custom-model");
  });

  it("passes through unrecognised aliases unchanged", () => {
    expect(resolveModelAlias("unknown-alias")).toBe("unknown-alias");
  });
});
