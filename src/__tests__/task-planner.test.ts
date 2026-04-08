import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getNextTasks,
  formatPlan,
  createPlan,
  executePlan,
  type Task,
  type TaskPlan,
} from "../task-planner.js";

// ─── Mock Anthropic ────────────────────────────────────────────

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

function getMockCreate() {
  return mockCreate;
}

// ─── Fixtures ─────────────────────────────────────────────────

function makePlan(tasks: Partial<Task>[]): TaskPlan {
  const fullTasks: Task[] = tasks.map((t, i) => ({
    id: t.id ?? `t${i + 1}`,
    title: t.title ?? `Task ${i + 1}`,
    description: t.description ?? "A task",
    status: t.status ?? "pending",
    dependsOn: t.dependsOn ?? [],
  }));
  return {
    goal: "Test goal",
    tasks: fullTasks,
    createdAt: 1000000000000,
  };
}

// ─── getNextTasks ─────────────────────────────────────────────

describe("getNextTasks", () => {
  it("returns leaf nodes (tasks with no deps) first", () => {
    const plan = makePlan([
      { id: "t1", dependsOn: [] },
      { id: "t2", dependsOn: ["t1"] },
      { id: "t3", dependsOn: [] },
    ]);
    const next = getNextTasks(plan);
    expect(next.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("respects dependency ordering — only returns tasks whose deps are done", () => {
    const plan = makePlan([
      { id: "t1", status: "done", dependsOn: [] },
      { id: "t2", status: "pending", dependsOn: ["t1"] },
      { id: "t3", status: "pending", dependsOn: ["t2"] },
    ]);
    const next = getNextTasks(plan);
    expect(next.map((t) => t.id)).toEqual(["t2"]);
    expect(next.find((t) => t.id === "t3")).toBeUndefined();
  });

  it("returns empty array when all pending tasks are blocked", () => {
    const plan = makePlan([
      { id: "t1", status: "in-progress", dependsOn: [] },
      { id: "t2", status: "pending", dependsOn: ["t1"] },
    ]);
    // t1 is in-progress (not done), t2 depends on t1 → nothing ready
    const next = getNextTasks(plan);
    expect(next).toHaveLength(0);
  });

  it("returns empty array for an empty plan", () => {
    const plan = makePlan([]);
    expect(getNextTasks(plan)).toHaveLength(0);
  });

  it("works with a single-task plan (no deps)", () => {
    const plan = makePlan([{ id: "t1", dependsOn: [], status: "pending" }]);
    const next = getNextTasks(plan);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("t1");
  });
});

// ─── formatPlan ───────────────────────────────────────────────

describe("formatPlan", () => {
  it("produces readable output with goal, tasks, and progress", () => {
    const plan = makePlan([
      { id: "t1", title: "Setup project", status: "done", dependsOn: [] },
      { id: "t2", title: "Write code", status: "in-progress", dependsOn: ["t1"] },
      { id: "t3", title: "Write tests", status: "pending", dependsOn: ["t2"] },
    ]);
    const output = formatPlan(plan);
    expect(output).toContain("Test goal");
    expect(output).toContain("Setup project");
    expect(output).toContain("Write code");
    expect(output).toContain("Write tests");
    expect(output).toContain("1/3 tasks done");
    // Status icons
    expect(output).toContain("✓");
    expect(output).toContain("◑");
    expect(output).toContain("○");
  });

  it("shows dependency info", () => {
    const plan = makePlan([
      { id: "t1", title: "First", dependsOn: [] },
      { id: "t2", title: "Second", dependsOn: ["t1"] },
    ]);
    const output = formatPlan(plan);
    expect(output).toContain("deps: t1");
  });
});

// ─── createPlan (mocked API) ──────────────────────────────────

describe("createPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid TaskPlan structure from API response", async () => {
    const mockResponse = {
      goal: "Build a REST API",
      tasks: [
        { id: "t1", title: "Define routes", description: "Set up Express routes", status: "pending", dependsOn: [] },
        { id: "t2", title: "Implement handlers", description: "Write handler functions", status: "pending", dependsOn: ["t1"] },
        { id: "t3", title: "Write tests", description: "Add unit tests", status: "pending", dependsOn: ["t2"] },
      ],
    };

    const mockCreate = getMockCreate();
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(mockResponse) }],
    });

    const plan = await createPlan("Build a REST API", "Node.js project");

    expect(plan.goal).toBe("Build a REST API");
    expect(plan.tasks).toHaveLength(3);
    expect(plan.tasks[0].id).toBe("t1");
    expect(plan.tasks[1].dependsOn).toContain("t1");
    expect(typeof plan.createdAt).toBe("number");
    expect(plan.createdAt).toBeGreaterThan(0);
  });

  it("works with a single-task plan", async () => {
    const mockResponse = {
      goal: "Add a README",
      tasks: [
        { id: "t1", title: "Write README", description: "Create README.md", status: "pending", dependsOn: [] },
      ],
    };

    const mockCreate = getMockCreate();
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(mockResponse) }],
    });

    const plan = await createPlan("Add a README", "");
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].status).toBe("pending");
  });

  it("extracts JSON from response with code fences", async () => {
    const mockResponse = {
      goal: "Refactor module",
      tasks: [
        { id: "t1", title: "Analyze code", description: "Review existing code", status: "pending", dependsOn: [] },
        { id: "t2", title: "Refactor", description: "Apply changes", status: "pending", dependsOn: ["t1"] },
        { id: "t3", title: "Test", description: "Verify changes", status: "pending", dependsOn: ["t2"] },
      ],
    };

    const wrapped = `Here is the plan:\n\`\`\`json\n${JSON.stringify(mockResponse)}\n\`\`\``;
    const mockCreate = getMockCreate();
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: wrapped }],
    });

    const plan = await createPlan("Refactor module", "TS project");
    expect(plan.tasks).toHaveLength(3);
    expect(plan.goal).toBe("Refactor module");
  });
});

// ─── executePlan ──────────────────────────────────────────────

describe("executePlan", () => {
  it("executes all tasks in dependency order", async () => {
    const plan = makePlan([
      { id: "t1", title: "First", dependsOn: [] },
      { id: "t2", title: "Second", dependsOn: ["t1"] },
      { id: "t3", title: "Third", dependsOn: ["t2"] },
    ]);

    const order: string[] = [];
    const executor = vi.fn(async (task: Task) => {
      order.push(task.id);
      return `done ${task.id}`;
    });

    const result = await executePlan(plan, executor);

    expect(order).toEqual(["t1", "t2", "t3"]);
    expect(result.tasks.every((t) => t.status === "done")).toBe(true);
    expect(result.tasks[0].result).toBe("done t1");
    expect(result.tasks[1].result).toBe("done t2");
    expect(result.tasks[2].result).toBe("done t3");
  });

  it("stops on failure and leaves dependent tasks pending", async () => {
    const plan = makePlan([
      { id: "t1", title: "First", dependsOn: [] },
      { id: "t2", title: "Second", dependsOn: ["t1"] },
      { id: "t3", title: "Third", dependsOn: ["t2"] },
    ]);

    const executor = vi.fn(async (task: Task) => {
      if (task.id === "t2") throw new Error("t2 exploded");
      return "ok";
    });

    const result = await executePlan(plan, executor);

    expect(result.tasks[0].status).toBe("done");
    expect(result.tasks[1].status).toBe("failed");
    expect(result.tasks[1].error).toBe("t2 exploded");
    expect(result.tasks[2].status).toBe("failed"); // skipped due to failed dependency
    // executor was called for t1 and t2 only
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it("handles tasks with no dependencies (all execute)", async () => {
    const plan = makePlan([
      { id: "t1", title: "Independent A", dependsOn: [] },
      { id: "t2", title: "Independent B", dependsOn: [] },
    ]);

    const executed: string[] = [];
    const executor = vi.fn(async (task: Task) => {
      executed.push(task.id);
      return "ok";
    });

    const result = await executePlan(plan, executor);

    expect(executed).toContain("t1");
    expect(executed).toContain("t2");
    expect(result.tasks.every((t) => t.status === "done")).toBe(true);
  });

  it("calls onUpdate for each status change", async () => {
    const plan = makePlan([
      { id: "t1", title: "Alpha", dependsOn: [] },
      { id: "t2", title: "Beta", dependsOn: ["t1"] },
    ]);

    const updates: Array<{ id: string; status: string }> = [];
    const onUpdate = vi.fn((task: Task) => {
      updates.push({ id: task.id, status: task.status });
    });

    const executor = vi.fn(async () => "ok");

    await executePlan(plan, executor, onUpdate);

    // Should have: t1 in-progress, t1 done, t2 in-progress, t2 done
    expect(updates).toEqual([
      { id: "t1", status: "in-progress" },
      { id: "t1", status: "done" },
      { id: "t2", status: "in-progress" },
      { id: "t2", status: "done" },
    ]);
    expect(onUpdate).toHaveBeenCalledTimes(4);
  });
});
