import { describe, it, expect } from "vitest";
import { inferDependencies } from "../task-planner.js";
import type { Task } from "../task-planner.js";

function makeTask(id: string, title: string, description: string, dependsOn: string[] = []): Task {
  return { id, title, description, status: "pending", dependsOn };
}

describe("inferDependencies", () => {
  it("adds dependency when two tasks share a file reference", () => {
    const tasks = [
      makeTask("t1", "Update src/orchestrator.ts", "Modify src/orchestrator.ts to add retry"),
      makeTask("t2", "Test src/orchestrator.ts", "Write tests for src/orchestrator.ts changes"),
    ];
    const result = inferDependencies(tasks);
    expect(result[1].dependsOn).toContain("t1");
  });

  it("adds no dependencies when tasks share no files", () => {
    const tasks = [
      makeTask("t1", "Update src/foo.ts", "Modify src/foo.ts"),
      makeTask("t2", "Update src/bar.ts", "Modify src/bar.ts"),
    ];
    const result = inferDependencies(tasks);
    expect(result[0].dependsOn).toHaveLength(0);
    expect(result[1].dependsOn).toHaveLength(0);
  });

  it("does not duplicate an already-existing manual dependency", () => {
    const tasks = [
      makeTask("t1", "Write src/utils.ts", "Create src/utils.ts helper"),
      makeTask("t2", "Import src/utils.ts", "Use src/utils.ts in main", ["t1"]),
    ];
    const result = inferDependencies(tasks);
    const deps = result[1].dependsOn;
    expect(deps.filter((d) => d === "t1")).toHaveLength(1);
  });

  it("handles three tasks with a chain of shared files", () => {
    const tasks = [
      makeTask("t1", "Create src/config.ts", "Define config in src/config.ts"),
      makeTask("t2", "Read src/config.ts", "Load src/config.ts values"),
      makeTask("t3", "Validate src/config.ts", "Check src/config.ts schema"),
    ];
    const result = inferDependencies(tasks);
    expect(result[1].dependsOn).toContain("t1");
    expect(result[2].dependsOn).toContain("t1");
    expect(result[2].dependsOn).toContain("t2");
  });
});
