/**
 * Tests for handlePlanCommand — the extracted /plan handler.
 * Uses vi.hoisted() for ESM-compatible mocking of task-planner and project-detector.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoist mocks so they're available before imports ---
const {
  mockCreatePlan,
  mockExecutePlan,
  mockFormatPlan,
  mockLoadPlan,
  mockSavePlan,
  mockDetectProject,
} = vi.hoisted(() => {
  return {
    mockCreatePlan: vi.fn(),
    mockExecutePlan: vi.fn(),
    mockFormatPlan: vi.fn(),
    mockLoadPlan: vi.fn(),
    mockSavePlan: vi.fn(),
    mockDetectProject: vi.fn(),
  };
});

vi.mock("../task-planner.js", () => ({
  createPlan: mockCreatePlan,
  executePlan: mockExecutePlan,
  formatPlan: mockFormatPlan,
  loadPlan: mockLoadPlan,
  savePlan: mockSavePlan,
}));

vi.mock("../project-detector.js", () => ({
  detectProject: mockDetectProject,
}));

// Mock fs to avoid hitting disk
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readFileSync: vi.fn((filePath: string) => {
      if (String(filePath).endsWith(".autoagent.md")) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return actual.readFileSync(filePath);
    }),
  };
});

import { handlePlanCommand } from "../plan-commands.js";

// Shared test plan
const fakePlan = {
  goal: "Build a REST API",
  tasks: [
    { id: "1", title: "Task 1", description: "Do thing 1", status: "done" as const, dependsOn: [] },
    { id: "2", title: "Task 2", description: "Do thing 2", status: "pending" as const, dependsOn: ["1"] },
  ],
  createdAt: Date.now(),
};

function makeContext(overrides?: { execute?: (d: string) => Promise<string> }) {
  const messages: string[] = [];
  return {
    workDir: "/tmp/test",
    addMessage: (text: string) => messages.push(text),
    messages,
    execute: overrides?.execute ?? vi.fn().mockResolvedValue("done"),
    setLoading: vi.fn(),
    setStatus: vi.fn(),
  };
}

describe("handlePlanCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetectProject.mockReturnValue({ name: "autoagent", type: "node", language: "typescript" });
    mockFormatPlan.mockReturnValue("[ ] Task 1\n[ ] Task 2");
    mockExecutePlan.mockResolvedValue(fakePlan);
    mockSavePlan.mockReturnValue("/tmp/test/.autoagent-plan.json");
  });

  // --- Test 1: /plan (no args) shows usage ---
  it("shows usage help when called with no args", async () => {
    const ctx = makeContext();
    await handlePlanCommand("", ctx);
    expect(ctx.messages[0]).toContain("Usage:");
    expect(ctx.messages[0]).toContain("/plan <description>");
    expect(ctx.messages[0]).toContain("/plan list");
    expect(ctx.messages[0]).toContain("/plan resume");
  });

  // --- Test 2: /plan help shows usage ---
  it("shows usage help when called with 'help'", async () => {
    const ctx = makeContext();
    await handlePlanCommand("help", ctx);
    expect(ctx.messages[0]).toContain("Usage:");
  });

  // --- Test 3: /plan build a REST API → calls createPlan with description ---
  it("creates and executes a plan for a description", async () => {
    mockCreatePlan.mockResolvedValue(fakePlan);
    const ctx = makeContext();
    await handlePlanCommand("build a REST API", ctx);

    expect(mockCreatePlan).toHaveBeenCalledOnce();
    expect(mockCreatePlan.mock.calls[0][0]).toBe("build a REST API");
    // Context string should include workDir
    expect(mockCreatePlan.mock.calls[0][1]).toContain("/tmp/test");
    expect(mockExecutePlan).toHaveBeenCalledOnce();
    expect(mockSavePlan).toHaveBeenCalled();
    // A "Created plan" message should have been emitted
    expect(ctx.messages.some((m) => m.includes("Created plan"))).toBe(true);
  });

  // --- Test 4: /plan list with no saved plan ---
  it("shows 'no saved plans' when loadPlan returns null", async () => {
    mockLoadPlan.mockReturnValue(null);
    const ctx = makeContext();
    await handlePlanCommand("list", ctx);
    expect(ctx.messages[0]).toContain("No saved plans");
  });

  // --- Test 5: /plan list with a saved plan ---
  it("shows saved plan info when loadPlan returns a plan", async () => {
    mockLoadPlan.mockReturnValue(fakePlan);
    const ctx = makeContext();
    await handlePlanCommand("list", ctx);
    expect(ctx.messages[0]).toContain("Build a REST API");
    expect(mockFormatPlan).toHaveBeenCalledWith(fakePlan);
  });

  // --- Test 6: /plan resume with no saved plan ---
  it("shows 'no saved plans' on resume when loadPlan returns null", async () => {
    mockLoadPlan.mockReturnValue(null);
    const ctx = makeContext();
    await handlePlanCommand("resume", ctx);
    expect(ctx.messages[0]).toContain("No saved plans to resume");
    expect(mockExecutePlan).not.toHaveBeenCalled();
  });

  // --- Test 7: /plan resume with complete plan ---
  it("shows 'already complete' when all tasks are done", async () => {
    const completePlan = {
      ...fakePlan,
      tasks: fakePlan.tasks.map((t) => ({ ...t, status: "done" as const })),
    };
    mockLoadPlan.mockReturnValue(completePlan);
    const ctx = makeContext();
    await handlePlanCommand("resume", ctx);
    expect(ctx.messages[0]).toContain("already complete");
    expect(mockExecutePlan).not.toHaveBeenCalled();
  });

  // --- Test 8: /plan resume executes pending tasks ---
  it("executes pending tasks on resume", async () => {
    mockLoadPlan.mockReturnValue(fakePlan);
    const ctx = makeContext();
    await handlePlanCommand("resume", ctx);
    expect(mockExecutePlan).toHaveBeenCalledOnce();
    expect(ctx.messages.some((m) => m.includes("Resuming plan"))).toBe(true);
  });

  // --- Test 9: createPlan failure shows error to user ---
  it("shows error message when createPlan throws", async () => {
    mockCreatePlan.mockRejectedValue(new Error("API timeout"));
    const ctx = makeContext();
    await handlePlanCommand("build something", ctx);
    expect(ctx.messages.some((m) => m.includes("Plan error") && m.includes("API timeout"))).toBe(true);
    // setLoading(false) should still be called (cleanup)
    expect(ctx.setLoading).toHaveBeenLastCalledWith(false);
  });

  // --- Test 10: context includes project summary ---
  it("passes project context including buildSummary to createPlan", async () => {
    mockCreatePlan.mockResolvedValue(fakePlan);
    mockDetectProject.mockReturnValue({ name: "myapp", type: "node", language: "typescript" });
    const ctx = makeContext();
    await handlePlanCommand("add auth", ctx);
    const contextArg = mockCreatePlan.mock.calls[0][1] as string;
    expect(contextArg).toContain("myapp");
  });
});
