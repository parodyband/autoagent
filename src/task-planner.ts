/**
 * Task Planning Foundation
 *
 * Decomposes a user request into a structured task plan (DAG) using Claude haiku.
 * Provides helpers for dependency-ordered execution and display.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "done" | "failed";
  dependsOn: string[]; // Task IDs this task depends on
}

export interface TaskPlan {
  goal: string;
  tasks: Task[];
  createdAt: number;
}

const STATUS_ICON: Record<Task["status"], string> = {
  pending: "○",
  "in-progress": "◑",
  done: "✓",
  failed: "✗",
};

/**
 * Returns tasks whose all dependencies are 'done'.
 * Filters to only 'pending' tasks (not in-progress/failed).
 */
export function getNextTasks(plan: TaskPlan): Task[] {
  const doneIds = new Set(
    plan.tasks.filter((t) => t.status === "done").map((t) => t.id)
  );
  return plan.tasks.filter(
    (t) =>
      t.status === "pending" && t.dependsOn.every((dep) => doneIds.has(dep))
  );
}

/**
 * Renders a text-based task board showing the status of each task.
 */
export function formatPlan(plan: TaskPlan): string {
  const lines: string[] = [
    `📋 Plan: ${plan.goal}`,
    `   Created: ${new Date(plan.createdAt).toLocaleString()}`,
    "",
  ];

  for (const task of plan.tasks) {
    const icon = STATUS_ICON[task.status];
    const deps =
      task.dependsOn.length > 0
        ? ` (deps: ${task.dependsOn.join(", ")})`
        : "";
    lines.push(`  ${icon} [${task.id}] ${task.title}${deps}`);
    lines.push(`      ${task.description}`);
  }

  const done = plan.tasks.filter((t) => t.status === "done").length;
  lines.push("");
  lines.push(`  Progress: ${done}/${plan.tasks.length} tasks done`);

  return lines.join("\n");
}

/**
 * Calls Claude haiku to decompose a user request into 3-8 tasks with dependencies.
 */
export async function createPlan(
  userRequest: string,
  projectContext: string
): Promise<TaskPlan> {
  const client = new Anthropic();

  const systemPrompt = `You are a task decomposition assistant. Break down the user's request into 3-8 concrete, actionable tasks. Return ONLY valid JSON matching this exact schema:

{
  "goal": "<one-sentence summary of the overall goal>",
  "tasks": [
    {
      "id": "t1",
      "title": "<short title>",
      "description": "<one sentence description>",
      "status": "pending",
      "dependsOn": []
    }
  ]
}

Rules:
- Use simple sequential IDs: t1, t2, t3, ...
- dependsOn contains IDs of tasks that must be done first
- Keep tasks concrete and achievable
- No circular dependencies
- Between 3 and 8 tasks total`;

  const userPrompt = `Project context:\n${projectContext}\n\nUser request:\n${userRequest}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  // Extract JSON from response (may be wrapped in code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse task plan JSON from response: ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    goal: string;
    tasks: Omit<Task, "status">[] & { status?: Task["status"] }[];
  };

  // Normalize: ensure all tasks have status: "pending"
  const tasks: Task[] = (parsed.tasks as Task[]).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status ?? "pending",
    dependsOn: t.dependsOn ?? [],
  }));

  return {
    goal: parsed.goal,
    tasks,
    createdAt: Date.now(),
  };
}
