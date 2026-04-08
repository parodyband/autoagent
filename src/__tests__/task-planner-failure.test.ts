import { describe, it, expect, vi } from "vitest";
import {
  executePlan,
  getTransitiveDependents,
  type Task,
  type TaskPlan,
  type ProgressEvent,
} from "../task-planner.js";

function makePlan(tasks: Task[]): TaskPlan {
  return { goal: "test goal", tasks, createdAt: Date.now() };
}

function makeTask(id: string, dependsOn: string[] = []): Task {
  return { id, title: id, description: id, status: "pending", dependsOn };
}

describe("getTransitiveDependents", () => {
  it("returns direct dependents of a failed task", () => {
    const tasks = [makeTask("t1"), makeTask("t2", ["t1"]), makeTask("t3", ["t2"])];
    const result = getTransitiveDependents(tasks, new Set(["t1"]));
    expect(result).toEqual(new Set(["t2", "t3"]));
  });

  it("does not include tasks with no dependency on failed set", () => {
    const tasks = [makeTask("t1"), makeTask("t2"), makeTask("t3", ["t2"])];
    const result = getTransitiveDependents(tasks, new Set(["t1"]));
    expect(result.size).toBe(0);
  });
});

describe("executePlan failure cascading", () => {
  it("marks transitive dependents as skipped when a task fails", async () => {
    const t1 = makeTask("t1");
    const t2 = makeTask("t2", ["t1"]);
    const t3 = makeTask("t3", ["t2"]);
    const plan = makePlan([t1, t2, t3]);

    const executor = vi.fn().mockRejectedValue(new Error("t1 failed"));

    const result = await executePlan(plan, executor);

    expect(result.tasks.find((t) => t.id === "t1")?.status).toBe("failed");
    // t2 and t3 should be skipped (stored as failed with skip message)
    expect(result.tasks.find((t) => t.id === "t2")?.error).toMatch(/[Ss]kipped/);
    expect(result.tasks.find((t) => t.id === "t3")?.error).toMatch(/[Ss]kipped/);
  });

  it("independent tasks still run after sibling failure", async () => {
    // t1 fails, t2 is independent and should still run
    const t1 = makeTask("t1");
    const t2 = makeTask("t2"); // no deps — independent
    const t3 = makeTask("t3", ["t1"]); // depends on t1 — should be skipped
    const plan = makePlan([t1, t2, t3]);

    const executor = vi.fn().mockImplementation(async (task: Task) => {
      if (task.id === "t1") throw new Error("t1 failed");
      return `${task.id} result`;
    });

    const result = await executePlan(plan, executor);

    expect(result.tasks.find((t) => t.id === "t1")?.status).toBe("failed");
    expect(result.tasks.find((t) => t.id === "t2")?.status).toBe("done");
    expect(result.tasks.find((t) => t.id === "t3")?.error).toMatch(/[Ss]kipped/);
  });

  it("calls onProgress with correct events", async () => {
    const t1 = makeTask("t1");
    const t2 = makeTask("t2", ["t1"]);
    const plan = makePlan([t1, t2]);

    const executor = vi.fn().mockRejectedValue(new Error("fail"));
    const events: [string, ProgressEvent][] = [];
    const onProgress = (task: Task, event: ProgressEvent) => {
      events.push([task.id, event]);
    };

    await executePlan(plan, executor, undefined, undefined, onProgress);

    expect(events).toContainEqual(["t1", "start"]);
    expect(events).toContainEqual(["t1", "failed"]);
    expect(events).toContainEqual(["t2", "skipped"]);
    // t2 should NOT get a 'start' event — it was never attempted
    expect(events).not.toContainEqual(["t2", "start"]);
  });

  it("calls onProgress done for successful tasks", async () => {
    const t1 = makeTask("t1");
    const plan = makePlan([t1]);

    const executor = vi.fn().mockResolvedValue("ok");
    const events: [string, ProgressEvent][] = [];

    await executePlan(plan, executor, undefined, undefined, (task, event) => {
      events.push([task.id, event]);
    });

    expect(events).toContainEqual(["t1", "start"]);
    expect(events).toContainEqual(["t1", "done"]);
  });
});
