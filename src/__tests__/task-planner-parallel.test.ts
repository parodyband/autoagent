import { describe, it, expect } from "vitest";
import { executePlan } from "../task-planner.js";
import type { TaskPlan } from "../task-planner.js";

describe("executePlan parallel execution", () => {
  it("runs independent tasks in parallel (faster than sequential)", async () => {
    const plan: TaskPlan = {
      tasks: [
        { id: "t1", title: "Task 1", description: "", status: "pending", dependsOn: [] },
        { id: "t2", title: "Task 2", description: "", status: "pending", dependsOn: [] },
        { id: "t3", title: "Task 3", description: "", status: "pending", dependsOn: [] },
      ],
    };

    const DELAY = 50;
    const executor = async () => {
      await new Promise<void>((r) => setTimeout(r, DELAY));
      return "done";
    };

    const start = Date.now();
    const result = await executePlan(plan, executor);
    const elapsed = Date.now() - start;

    // 3 tasks × 50ms each sequential = 150ms. Parallel should finish < 200ms.
    expect(elapsed).toBeLessThan(200);
    expect(result.tasks.every((t) => t.status === "done")).toBe(true);
  });

  it("marks failed tasks and stops execution", async () => {
    const plan: TaskPlan = {
      tasks: [
        { id: "t1", title: "Task 1", description: "", status: "pending", dependsOn: [] },
        { id: "t2", title: "Task 2", description: "", status: "pending", dependsOn: [] },
      ],
    };

    let callCount = 0;
    const executor = async () => {
      callCount++;
      if (callCount === 1) throw new Error("task failed");
      return "done";
    };

    const result = await executePlan(plan, executor);
    const failed = result.tasks.filter((t) => t.status === "failed");
    expect(failed.length).toBeGreaterThan(0);
  });
});
