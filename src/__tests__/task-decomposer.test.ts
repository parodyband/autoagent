/**
 * Tests for src/task-decomposer.ts
 */

import { describe, it, expect, vi } from "vitest";
import {
  shouldDecompose,
  decomposeTasks,
  formatSubtasks,
  type Subtask,
} from "../task-decomposer.js";

// ─── shouldDecompose ─────────────────────────────────────────

describe("shouldDecompose", () => {
  it("returns false for a short task", () => {
    expect(shouldDecompose("Fix the typo in README.md")).toBe(false);
  });

  it("returns true for tasks with >300 words", () => {
    const words = Array.from({ length: 301 }, (_, i) => `word${i}`).join(" ");
    expect(shouldDecompose(words)).toBe(true);
  });

  it("returns true for tasks with 3+ numbered list items", () => {
    const task = `Do the following:
1. Install dependencies
2. Run migrations
3. Deploy the service`;
    expect(shouldDecompose(task)).toBe(true);
  });

  it("returns false for tasks with fewer than 3 numbered items", () => {
    const task = `Do the following:
1. Install dependencies
2. Run migrations`;
    expect(shouldDecompose(task)).toBe(false);
  });

  it("returns true for tasks with multiple ## headings", () => {
    const task = `## Setup\nDo setup.\n\n## Implementation\nDo implementation.`;
    expect(shouldDecompose(task)).toBe(true);
  });

  it("returns false for tasks with only one ## heading", () => {
    const task = `## Setup\nDo setup.`;
    expect(shouldDecompose(task)).toBe(false);
  });
});

// ─── decomposeTasks ──────────────────────────────────────────

describe("decomposeTasks", () => {
  it("falls back gracefully if callClaude throws", async () => {
    const callClaude = vi.fn().mockRejectedValue(new Error("API error"));
    const result = await decomposeTasks("Build something complex", callClaude);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].title).toBe("Complete the task");
  });

  it("falls back if callClaude returns invalid JSON", async () => {
    const callClaude = vi.fn().mockResolvedValue("not json at all");
    const result = await decomposeTasks("Build something", callClaude);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns at most 7 subtasks when callClaude returns more", async () => {
    const manySubtasks = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `Subtask ${i + 1}`,
      description: `Description for subtask ${i + 1}`,
      dependsOn: i > 0 ? [i] : [],
    }));
    const callClaude = vi.fn().mockResolvedValue(JSON.stringify(manySubtasks));
    const result = await decomposeTasks("A very large task", callClaude);
    expect(result.length).toBeLessThanOrEqual(7);
  });

  it("parses a valid JSON response from callClaude", async () => {
    const subtasks: Subtask[] = [
      { id: 1, title: "Read files", description: "Read the relevant files.", dependsOn: [] },
      { id: 2, title: "Write code", description: "Implement the feature.", dependsOn: [1] },
      { id: 3, title: "Run tests", description: "Verify everything works.", dependsOn: [2] },
    ];
    const callClaude = vi.fn().mockResolvedValue(JSON.stringify(subtasks));
    const result = await decomposeTasks("Build a feature", callClaude);
    expect(result).toHaveLength(3);
    expect(result[1].dependsOn).toEqual([1]);
  });

  it("strips markdown fences if present in callClaude response", async () => {
    const subtasks: Subtask[] = [
      { id: 1, title: "Do it", description: "Just do it.", dependsOn: [] },
    ];
    const callClaude = vi
      .fn()
      .mockResolvedValue("```json\n" + JSON.stringify(subtasks) + "\n```");
    const result = await decomposeTasks("Simple task", callClaude);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Do it");
  });
});

// ─── formatSubtasks ──────────────────────────────────────────

describe("formatSubtasks", () => {
  it("produces correct markdown for subtasks with no dependencies", () => {
    const subtasks: Subtask[] = [
      { id: 1, title: "Setup project", description: "Initialize the repo.", dependsOn: [] },
      { id: 2, title: "Write code", description: "Implement the feature.", dependsOn: [] },
    ];
    const output = formatSubtasks(subtasks);
    expect(output).toContain("## Task Decomposition");
    expect(output).toContain("### 1. Setup project");
    expect(output).toContain("### 2. Write code");
    expect(output).toContain("Initialize the repo.");
    expect(output).not.toContain("depends on");
  });

  it("includes dependency references in headings", () => {
    const subtasks: Subtask[] = [
      { id: 1, title: "First step", description: "Do the first step.", dependsOn: [] },
      { id: 2, title: "Second step", description: "Do the second step.", dependsOn: [1] },
    ];
    const output = formatSubtasks(subtasks);
    expect(output).toContain("depends on: #1");
  });
});
