/**
 * Tests for plan-executor orchestrator wiring.
 * Mocks Orchestrator so no real LLM calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Task, TaskPlan } from "../src/task-planner.js";

// Mock the orchestrator module
vi.mock("../src/orchestrator.js", () => {
  const mockSend = vi.fn().mockResolvedValue({ text: "task completed", tokensIn: 10, tokensOut: 5, model: "claude-haiku-4-5" });
  const mockInit = vi.fn().mockResolvedValue(undefined);
  const MockOrchestrator = vi.fn().mockImplementation(() => ({
    init: mockInit,
    send: mockSend,
  }));
  return { Orchestrator: MockOrchestrator };
});

const makePlan = (): TaskPlan => ({
  goal: "Build a REST API",
  tasks: [
    { id: "t1", title: "Setup", description: "Initialize the project", status: "pending", dependsOn: [] },
    { id: "t2", title: "Routes", description: "Add routes", status: "pending", dependsOn: ["t1"] },
  ],
  createdAt: Date.now(),
});

describe("createPlanExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls orchestrator.send with task description and context", async () => {
    const { createPlanExecutor } = await import("../src/plan-executor.js");
    const { Orchestrator } = await import("../src/orchestrator.js");

    const plan = makePlan();
    const executor = createPlanExecutor(plan, { workDir: "/tmp" });
    const result = await executor(plan.tasks[0]);

    expect(result).toBe("task completed");

    const instance = (Orchestrator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(instance.init).toHaveBeenCalled();
    expect(instance.send).toHaveBeenCalledOnce();

    const sentPrompt: string = instance.send.mock.calls[0][0];
    expect(sentPrompt).toContain("Initialize the project");
    expect(sentPrompt).toContain("Build a REST API");
  });

  it("includes completed dependency results in context", async () => {
    const { createPlanExecutor } = await import("../src/plan-executor.js");
    const { Orchestrator } = await import("../src/orchestrator.js");

    const plan = makePlan();
    plan.tasks[0].status = "done";
    plan.tasks[0].result = "project initialized successfully";

    const executor = createPlanExecutor(plan, { workDir: "/tmp" });
    await executor(plan.tasks[1]);

    const instance = (Orchestrator as ReturnType<typeof vi.fn>).mock.results[0].value;
    const sentPrompt: string = instance.send.mock.calls[0][0];
    expect(sentPrompt).toContain("project initialized successfully");
  });

  it("throws when orchestrator returns empty text", async () => {
    const { createPlanExecutor } = await import("../src/plan-executor.js");
    const { Orchestrator } = await import("../src/orchestrator.js");

    const instance = { init: vi.fn(), send: vi.fn().mockResolvedValue({ text: "", tokensIn: 0, tokensOut: 0, model: "x" }) };
    (Orchestrator as ReturnType<typeof vi.fn>).mockImplementationOnce(() => instance);

    const plan = makePlan();
    const executor = createPlanExecutor(plan, { workDir: "/tmp" });
    await expect(executor(plan.tasks[0])).rejects.toThrow(/empty result/);
  });

  it("propagates orchestrator errors so executePlan can handle failure", async () => {
    const { createPlanExecutor } = await import("../src/plan-executor.js");
    const { Orchestrator } = await import("../src/orchestrator.js");

    const instance = { init: vi.fn(), send: vi.fn().mockRejectedValue(new Error("API timeout")) };
    (Orchestrator as ReturnType<typeof vi.fn>).mockImplementationOnce(() => instance);

    const plan = makePlan();
    const executor = createPlanExecutor(plan, { workDir: "/tmp" });
    await expect(executor(plan.tasks[0])).rejects.toThrow("API timeout");
  });
});
