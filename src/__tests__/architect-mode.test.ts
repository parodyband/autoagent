import { describe, it, expect, vi } from "vitest";
import {
  needsArchitectMode,
  generateEditPlan,
  formatPlanForEditor,
  parsePlan,
  type EditPlan,
} from "../architect-mode.js";

// ─── needsArchitectMode ───────────────────────────────────────

describe("needsArchitectMode", () => {
  it("returns true for refactor requests", () => {
    expect(needsArchitectMode("Refactor the auth module to use JWT")).toBe(true);
  });

  it("returns true for implement requests", () => {
    expect(needsArchitectMode("Implement a new caching layer for the API")).toBe(true);
  });

  it("returns true for build requests", () => {
    expect(needsArchitectMode("Build a CLI tool that parses CSV files")).toBe(true);
  });

  it("returns true for long messages (>200 chars)", () => {
    const longMsg = "a".repeat(201);
    expect(needsArchitectMode(longMsg)).toBe(true);
  });

  it("returns false for simple read-only questions", () => {
    expect(needsArchitectMode("What does this function do?")).toBe(false);
  });

  it("returns false for short explain queries", () => {
    expect(needsArchitectMode("How does this work?")).toBe(false);
  });

  it("returns false for short messages without keywords", () => {
    expect(needsArchitectMode("Show me the error logs")).toBe(false);
  });
});

// ─── parsePlan ────────────────────────────────────────────────

describe("parsePlan", () => {
  it("parses valid JSON plan", () => {
    const raw = JSON.stringify({
      summary: "Add JWT auth",
      steps: [
        { file: "src/auth.ts", action: "create", description: "Create auth module" },
        { file: "src/index.ts", action: "modify", description: "Wire up auth middleware" },
      ],
    });
    const plan = parsePlan(raw);
    expect(plan.summary).toBe("Add JWT auth");
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].action).toBe("create");
    expect(plan.steps[1].file).toBe("src/index.ts");
  });

  it("extracts JSON from markdown-fenced response", () => {
    const raw = `Here is the plan:\n\`\`\`json\n${JSON.stringify({
      summary: "Refactor",
      steps: [{ file: "foo.ts", action: "modify", description: "Update foo" }],
    })}\n\`\`\``;
    const plan = parsePlan(raw);
    expect(plan.summary).toBe("Refactor");
    expect(plan.steps).toHaveLength(1);
  });

  it("returns empty plan for empty string", () => {
    const plan = parsePlan("");
    expect(plan.summary).toBe("");
    expect(plan.steps).toHaveLength(0);
  });

  it("returns empty plan for invalid JSON", () => {
    const plan = parsePlan("not json at all");
    expect(plan.summary).toBe("");
    expect(plan.steps).toHaveLength(0);
  });

  it("coerces unknown action to modify", () => {
    const raw = JSON.stringify({
      summary: "test",
      steps: [{ file: "a.ts", action: "unknown_action", description: "do it" }],
    });
    const plan = parsePlan(raw);
    expect(plan.steps[0].action).toBe("modify");
  });
});

// ─── generateEditPlan ─────────────────────────────────────────

describe("generateEditPlan", () => {
  it("returns valid EditPlan from model response", async () => {
    const mockResponse = JSON.stringify({
      summary: "Add logging to all service files",
      steps: [
        { file: "src/service.ts", action: "modify", description: "Add logger import and calls" },
        { file: "src/logger.ts", action: "create", description: "Create logger utility" },
      ],
    });
    const callModel = vi.fn().mockResolvedValue(mockResponse);
    const plan = await generateEditPlan("Add logging to all services", "repo context here", callModel);

    expect(plan.summary).toBe("Add logging to all service files");
    expect(plan.steps).toHaveLength(2);
    expect(callModel).toHaveBeenCalledOnce();
  });

  it("returns empty plan when model throws", async () => {
    const callModel = vi.fn().mockRejectedValue(new Error("API error"));
    const plan = await generateEditPlan("some task", "context", callModel);

    expect(plan.summary).toBe("");
    expect(plan.steps).toHaveLength(0);
  });

  it("returns empty plan when model returns gibberish", async () => {
    const callModel = vi.fn().mockResolvedValue("I cannot help with that.");
    const plan = await generateEditPlan("some task", "context", callModel);

    expect(plan.steps).toHaveLength(0);
  });
});

// ─── formatPlanForEditor ──────────────────────────────────────

describe("formatPlanForEditor", () => {
  it("formats a plan with steps", () => {
    const plan: EditPlan = {
      summary: "Add JWT authentication",
      steps: [
        { file: "src/auth.ts", action: "create", description: "Create auth module" },
        { file: "src/index.ts", action: "modify", description: "Wire up middleware" },
        { file: "src/old-auth.ts", action: "delete", description: "Remove old auth" },
      ],
    };
    const formatted = formatPlanForEditor(plan);

    expect(formatted).toContain("I've analyzed the request");
    expect(formatted).toContain("Add JWT authentication");
    expect(formatted).toContain("src/auth.ts");
    expect(formatted).toContain("✚"); // create icon
    expect(formatted).toContain("✎"); // modify icon
    expect(formatted).toContain("✖"); // delete icon
    expect(formatted).toContain("Now executing...");
  });

  it("returns empty string for empty plan", () => {
    const plan: EditPlan = { summary: "", steps: [] };
    expect(formatPlanForEditor(plan)).toBe("");
  });

  it("includes step numbers", () => {
    const plan: EditPlan = {
      summary: "Test",
      steps: [
        { file: "a.ts", action: "modify", description: "First" },
        { file: "b.ts", action: "modify", description: "Second" },
      ],
    };
    const formatted = formatPlanForEditor(plan);
    expect(formatted).toContain("1.");
    expect(formatted).toContain("2.");
  });
});
