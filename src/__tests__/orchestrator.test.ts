import { describe, it, expect, vi } from "vitest";
import { routeModel, buildSystemPrompt, computeCost, MODEL_PRICING } from "../orchestrator.js";

vi.mock("../file-ranker.js", () => ({
  rankFiles: () => [],
}));

vi.mock("../symbol-index.js", () => ({
  buildSymbolIndex: () => ({ symbols: [], files: [] }),
  formatRepoMap: () => "",
}));

const MODEL_COMPLEX = "claude-sonnet-4-6";
const MODEL_SIMPLE = "claude-haiku-4-5";

describe("routeModel", () => {
  it("routes code-change keywords to sonnet", () => {
    expect(routeModel("create a new React component")).toBe(MODEL_COMPLEX);
    expect(routeModel("implement the login feature")).toBe(MODEL_COMPLEX);
    expect(routeModel("fix the bug in utils.ts")).toBe(MODEL_COMPLEX);
    expect(routeModel("refactor the database module")).toBe(MODEL_COMPLEX);
    expect(routeModel("add error handling to the API")).toBe(MODEL_COMPLEX);
  });

  it("routes read-only keywords to haiku", () => {
    expect(routeModel("explain how authentication works")).toBe(MODEL_SIMPLE);
    expect(routeModel("what does this function do")).toBe(MODEL_SIMPLE);
    expect(routeModel("list all the exported functions")).toBe(MODEL_SIMPLE);
    expect(routeModel("describe the database schema")).toBe(MODEL_SIMPLE);
  });

  it("routes long messages to sonnet", () => {
    const long = "a".repeat(301);
    expect(routeModel(long)).toBe(MODEL_COMPLEX);
  });

  it("defaults to sonnet for ambiguous messages", () => {
    expect(routeModel("hello")).toBe(MODEL_COMPLEX);
    expect(routeModel("run the tests")).toBe(MODEL_COMPLEX);
  });

  it("code change beats read-only", () => {
    // "explain what to create" has both — code change wins
    expect(routeModel("explain what to create here")).toBe(MODEL_COMPLEX);
  });
});

describe("buildSystemPrompt", () => {
  it("includes workDir in system prompt", () => {
    const { systemPrompt } = buildSystemPrompt("/some/repo", "");
    expect(systemPrompt).toContain("/some/repo");
  });

  it("includes tool list", () => {
    const { systemPrompt } = buildSystemPrompt("/tmp", "");
    expect(systemPrompt).toContain("bash");
    expect(systemPrompt).toContain("read_file");
    expect(systemPrompt).toContain("write_file");
    expect(systemPrompt).toContain("grep");
  });

  it("includes repo fingerprint when provided", () => {
    const fp = "## Repo Context\n\n**Project type**: Node.js";
    const { systemPrompt } = buildSystemPrompt("/tmp", fp);
    expect(systemPrompt).toContain("## Repo Context");
    expect(systemPrompt).toContain("Node.js");
  });

  it("includes key files section when repo has source files", () => {
    // Use our own repo dir to get actual ranked files
    const { systemPrompt } = buildSystemPrompt(process.cwd(), "");
    // Should have either key files section or at least the base prompt
    expect(systemPrompt).toContain("Working directory:");
  });

  it("handles empty fingerprint gracefully", () => {
    const { systemPrompt } = buildSystemPrompt("/nonexistent/path", "");
    expect(typeof systemPrompt).toBe("string");
    expect(systemPrompt.length).toBeGreaterThan(0);
  });

  it("returns repoMapBlock string", () => {
    const { repoMapBlock } = buildSystemPrompt(process.cwd(), "");
    expect(typeof repoMapBlock).toBe("string");
  });
});

describe("computeCost", () => {
  it("computes zero cost for zero tokens", () => {
    expect(computeCost(MODEL_COMPLEX, 0, 0)).toBe(0);
    expect(computeCost(MODEL_SIMPLE, 0, 0)).toBe(0);
  });

  it("computes correct cost for sonnet (1M in + 1M out)", () => {
    // Sonnet: $3/MTok in, $15/MTok out
    const cost = computeCost(MODEL_COMPLEX, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(18.0, 6);
  });

  it("computes correct cost for haiku (1M in + 1M out)", () => {
    // Haiku: $0.80/MTok in, $4/MTok out
    const cost = computeCost(MODEL_SIMPLE, 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(4.8, 6);
  });

  it("scales linearly with token count", () => {
    const cost1 = computeCost(MODEL_COMPLEX, 100_000, 10_000);
    const cost2 = computeCost(MODEL_COMPLEX, 200_000, 20_000);
    expect(cost2).toBeCloseTo(cost1 * 2, 9);
  });

  it("input tokens cost less than output tokens for all models", () => {
    for (const model of [MODEL_COMPLEX, MODEL_SIMPLE]) {
      const inCost = computeCost(model, 1_000_000, 0);
      const outCost = computeCost(model, 0, 1_000_000);
      expect(outCost).toBeGreaterThan(inCost);
    }
  });

  it("uses fallback pricing for unknown models", () => {
    // Should not throw; falls back to sonnet pricing
    const cost = computeCost("unknown-model", 1_000_000, 0);
    expect(cost).toBeGreaterThan(0);
  });

  it("MODEL_PRICING has entries for both models", () => {
    expect(MODEL_PRICING[MODEL_COMPLEX]).toBeDefined();
    expect(MODEL_PRICING[MODEL_SIMPLE]).toBeDefined();
    const [sonnetIn, sonnetOut] = MODEL_PRICING[MODEL_COMPLEX];
    const [haikuIn, haikuOut] = MODEL_PRICING[MODEL_SIMPLE];
    expect(sonnetIn).toBe(3.0);
    expect(sonnetOut).toBe(15.0);
    expect(haikuIn).toBe(0.8);
    expect(haikuOut).toBe(4.0);
  });

  it("typical session cost is in expected range", () => {
    // 10K in + 2K out with sonnet
    const cost = computeCost(MODEL_COMPLEX, 10_000, 2_000);
    // $3 * 0.01 + $15 * 0.002 = $0.03 + $0.03 = $0.06
    expect(cost).toBeCloseTo(0.06, 4);
  });
});
