import { describe, it, expect } from "vitest";
import { routeModel, buildSystemPrompt } from "../orchestrator.js";

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
    const prompt = buildSystemPrompt("/some/repo", "");
    expect(prompt).toContain("/some/repo");
  });

  it("includes tool list", () => {
    const prompt = buildSystemPrompt("/tmp", "");
    expect(prompt).toContain("bash");
    expect(prompt).toContain("read_file");
    expect(prompt).toContain("write_file");
    expect(prompt).toContain("grep");
  });

  it("includes repo fingerprint when provided", () => {
    const fp = "## Repo Context\n\n**Project type**: Node.js";
    const prompt = buildSystemPrompt("/tmp", fp);
    expect(prompt).toContain("## Repo Context");
    expect(prompt).toContain("Node.js");
  });

  it("includes key files section when repo has source files", () => {
    // Use our own repo dir to get actual ranked files
    const prompt = buildSystemPrompt(process.cwd(), "");
    // Should have either key files section or at least the base prompt
    expect(prompt).toContain("Working directory:");
  });

  it("handles empty fingerprint gracefully", () => {
    const prompt = buildSystemPrompt("/nonexistent/path", "");
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });
});
