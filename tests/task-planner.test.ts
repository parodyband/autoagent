/**
 * Tests for task-planner.ts: DAG execution, formatting, persistence, context building.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// Hoist mocks before module import
const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
      },
    })),
  };
});

const {
  getNextTasks,
  formatPlan,
  executePlan,
  buildTaskContext,
  savePlan,
  loadPlan,
  replanOnFailure,
} = await import("../src/task-planner.js");

import type { Task, TaskPlan } from "../src/task-planner.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTask(
  id: string,
  status: Task["status"] = "pending",
  dependsOn: string[] = [],
  result?: string
): Task {
  return {
    id,
    title: `Task ${id}`,
    description: `Do thing ${id}`,
    status,
    dependsOn,
    result,
  };
}

function makePlan(tasks: Task[]): TaskPlan {
  return {
    goal: "Test goal",
    tasks,
    createdAt: 1_000_000,
  };
}

// ── getNextTasks ──────────────────────────────────────────────────────────────

describe("getNextTasks", () => {
  it("returns all pending tasks when there are no dependencies", () => {
    const plan = makePlan([makeTask("t1"), makeTask("t2")]);
    const next = getNextTasks(plan);
    expect(next.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("excludes tasks whose deps are not done", () => {
    const plan = makePlan([makeTask("t1"), makeTask("t2", "pending", ["t1"])]);
    const next = getNextTasks(plan);
    expect(next.map((t) => t.id)).toEqual(["t1"]);
  });

  it("includes t2 once t1 is done", () => {
    const plan = makePlan([
      makeTask("t1", "done"),
      makeTask("t2", "pending", ["t1"]),
    ]);
    const next = getNextTasks(plan);
    expect(next.map((t) => t.id)).toEqual(["t2"]);
  });

  it("skips in-progress tasks", () => {
    const plan = makePlan([makeTask("t1", "in-progress")]);
    expect(getNextTasks(plan)).toHaveLength(0);
  });

  it("skips failed tasks", () => {
    const plan = makePlan([makeTask("t1", "failed")]);
    expect(getNextTasks(plan)).toHaveLength(0);
  });

  it("returns nothing when all tasks are done", () => {
    const plan = makePlan([makeTask("t1", "done"), makeTask("t2", "done")]);
    expect(getNextTasks(plan)).toHaveLength(0);
  });
});

// ── formatPlan ────────────────────────────────────────────────────────────────

describe("formatPlan", () => {
  it("includes the goal heading", () => {
    const plan = makePlan([makeTask("t1")]);
    expect(formatPlan(plan)).toContain("Test goal");
  });

  it("renders ○ for pending tasks", () => {
    const plan = makePlan([makeTask("t1", "pending")]);
    expect(formatPlan(plan)).toContain("○");
  });

  it("renders ◑ for in-progress tasks", () => {
    const plan = makePlan([makeTask("t1", "in-progress")]);
    expect(formatPlan(plan)).toContain("◑");
  });

  it("renders ✓ for done tasks", () => {
    const plan = makePlan([makeTask("t1", "done")]);
    expect(formatPlan(plan)).toContain("✓");
  });

  it("renders ✗ for failed tasks", () => {
    const plan = makePlan([makeTask("t1", "failed")]);
    expect(formatPlan(plan)).toContain("✗");
  });

  it("shows progress counter", () => {
    const plan = makePlan([makeTask("t1", "done"), makeTask("t2", "pending")]);
    expect(formatPlan(plan)).toContain("1/2 tasks done");
  });
});

// ── buildTaskContext ──────────────────────────────────────────────────────────

describe("buildTaskContext", () => {
  it("includes the overall goal", () => {
    const plan = makePlan([makeTask("t1")]);
    const ctx = buildTaskContext(plan, plan.tasks[0]);
    expect(ctx).toContain("Test goal");
  });

  it("includes task description", () => {
    const plan = makePlan([makeTask("t1")]);
    const ctx = buildTaskContext(plan, plan.tasks[0]);
    expect(ctx).toContain("Do thing t1");
  });

  it("includes results from completed dependencies", () => {
    const dep = makeTask("t1", "done", [], "dep result here");
    const task = makeTask("t2", "pending", ["t1"]);
    const plan = makePlan([dep, task]);
    const ctx = buildTaskContext(plan, task);
    expect(ctx).toContain("dep result here");
    expect(ctx).toContain("Task t1");
  });

  it("does not include results from pending dependencies", () => {
    const dep = makeTask("t1", "pending");
    const task = makeTask("t2", "pending", ["t1"]);
    const plan = makePlan([dep, task]);
    const ctx = buildTaskContext(plan, task);
    expect(ctx).not.toContain("Completed prerequisite");
  });
});

// ── executePlan ───────────────────────────────────────────────────────────────

describe("executePlan", () => {
  it("executes all tasks in dependency order and marks them done", async () => {
    const order: string[] = [];
    const executor = vi.fn(async (task: Task) => {
      order.push(task.id);
      return `result-${task.id}`;
    });

    const plan = makePlan([
      makeTask("t1"),
      makeTask("t2", "pending", ["t1"]),
    ]);

    const result = await executePlan(plan, executor);
    expect(order).toEqual(["t1", "t2"]);
    expect(result.tasks.find((t) => t.id === "t1")?.status).toBe("done");
    expect(result.tasks.find((t) => t.id === "t2")?.status).toBe("done");
    expect(result.tasks.find((t) => t.id === "t1")?.result).toBe("result-t1");
  });

  it("marks task failed when executor throws", async () => {
    const executor = vi.fn(async (_task: Task) => {
      throw new Error("boom");
    });
    const plan = makePlan([makeTask("t1")]);
    const result = await executePlan(plan, executor);
    expect(result.tasks[0].status).toBe("failed");
    expect(result.tasks[0].error).toBe("boom");
  });

  it("calls onUpdate after each status change", async () => {
    const updates: string[] = [];
    const executor = vi.fn(async (_task: Task) => "ok");
    const plan = makePlan([makeTask("t1")]);

    await executePlan(plan, executor, (task) => {
      updates.push(`${task.id}:${task.status}`);
    });

    expect(updates).toContain("t1:in-progress");
    expect(updates).toContain("t1:done");
  });

  it("stops after failure when no onFailure provided", async () => {
    const executor = vi.fn(async (task: Task) => {
      if (task.id === "t1") throw new Error("fail");
      return "ok";
    });
    const plan = makePlan([makeTask("t1"), makeTask("t2")]);
    const result = await executePlan(plan, executor);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.tasks.find((t) => t.id === "t2")?.status).toBe("pending");
  });
});

// ── savePlan / loadPlan ───────────────────────────────────────────────────────

describe("savePlan / loadPlan", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "task-planner-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips a plan through JSON file", () => {
    const plan = makePlan([makeTask("t1", "done", [], "output")]);
    savePlan(plan, tmpDir);
    const loaded = loadPlan(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.goal).toBe("Test goal");
    expect(loaded?.tasks[0].id).toBe("t1");
    expect(loaded?.tasks[0].result).toBe("output");
  });

  it("returns null when no plan file exists", () => {
    expect(loadPlan(tmpDir)).toBeNull();
  });
});

// ── replanOnFailure ───────────────────────────────────────────────────────────

describe("replanOnFailure", () => {
  it("calls Claude and returns a new plan", async () => {
    const newPlanJson = JSON.stringify({
      goal: "Recovery goal",
      tasks: [
        {
          id: "r1",
          title: "Recovery task",
          description: "Fix the issue",
          status: "pending",
          dependsOn: [],
        },
      ],
    });

    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: newPlanJson }],
    });

    const failedTask = makeTask("t1", "failed");
    failedTask.error = "something went wrong";
    const plan = makePlan([failedTask]);

    const newPlan = await replanOnFailure(plan, failedTask, "project context");
    expect(newPlan.goal).toBe("Recovery goal");
    expect(newPlan.tasks).toHaveLength(1);
    expect(newPlan.tasks[0].id).toBe("r1");
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
  });
});
