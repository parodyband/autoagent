/**
 * Task Planning Foundation
 *
 * Decomposes a user request into a structured task plan (DAG) using Claude haiku.
 * Provides helpers for dependency-ordered execution and display.
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "done" | "failed";
  dependsOn: string[]; // Task IDs this task depends on
  result?: string;     // Executor output on success
  error?: string;      // Error message on failure
}

export interface TaskPlan {
  goal: string;
  tasks: Task[];
  createdAt: number;
  /** Git commit SHA captured before plan execution began. Used for diff tracking. */
  baseCommit?: string;
}

/** Called with each task and updated plan after every status change */
export type TaskExecutor = (task: Task) => Promise<string>;

/** Optional callback invoked when a task fails. Return a new plan to switch to it, or null to stop. */
export type OnFailureCallback = (plan: TaskPlan, failedTask: Task) => Promise<TaskPlan | null>;

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

const RESULT_MAX_CHARS = 500;

/**
 * Builds rich context for a task by including the overall plan goal
 * and the results of all completed dependency tasks.
 *
 * @param plan    The full task plan
 * @param task    The task about to be executed
 * @returns       A formatted context string to send to the executor
 */
export function buildTaskContext(plan: TaskPlan, task: Task): string {
  const lines: string[] = [`Overall goal: ${plan.goal}`];

  // Collect results from dependency tasks that are done
  const completedDeps = task.dependsOn
    .map((depId) => plan.tasks.find((t) => t.id === depId))
    .filter((t): t is Task => t !== undefined && t.status === "done" && t.result !== undefined);

  if (completedDeps.length > 0) {
    lines.push("");
    lines.push("Completed prerequisite tasks:");
    for (const dep of completedDeps) {
      const rawResult = dep.result ?? "";
      const summary =
        rawResult.length > RESULT_MAX_CHARS
          ? rawResult.slice(0, RESULT_MAX_CHARS) + "..."
          : rawResult;
      lines.push(`- [${dep.id}] ${dep.title}: ${summary}`);
    }
  }

  lines.push("");
  lines.push(`Your task: ${task.description}`);

  return lines.join("\n");
}

/**
 * Executes a TaskPlan in dependency order using the provided executor.
 * Runs tasks sequentially. Stops on first failure (or calls onFailure if provided).
 * Mutates task statuses and stores result/error on each task.
 *
 * @param plan       The plan to execute
 * @param executor   Async function that runs a single task and returns a result string
 * @param onUpdate   Optional callback after each status change
 * @param onFailure  Optional callback when a task fails — return a new plan to switch to it
 */
export async function executePlan(
  plan: TaskPlan,
  executor: TaskExecutor,
  onUpdate?: (task: Task, plan: TaskPlan) => void,
  onFailure?: OnFailureCallback
): Promise<TaskPlan> {
  // Capture git HEAD before execution for later diff tracking
  if (!plan.baseCommit) {
    try {
      const { execSync } = await import("child_process");
      const sha = execSync("git rev-parse HEAD 2>/dev/null", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      if (sha) plan = { ...plan, baseCommit: sha };
    } catch {
      // No git or no commits — baseCommit stays undefined
    }
  }
  let currentPlan = plan;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ready = getNextTasks(currentPlan);

    if (ready.length === 0) {
      // Check if we're done or stuck
      const allDone = currentPlan.tasks.every(
        (t) => t.status === "done" || t.status === "failed"
      );
      if (!allDone) {
        // Stuck — some pending tasks can't proceed (likely due to a failed dep)
        break;
      }
      break;
    }

    for (const task of ready) {
      // Mark in-progress
      task.status = "in-progress";
      onUpdate?.(task, currentPlan);

      try {
        const result = await executor(task);
        task.status = "done";
        task.result = result;
        onUpdate?.(task, currentPlan);
      } catch (err) {
        task.status = "failed";
        task.error = err instanceof Error ? err.message : String(err);
        onUpdate?.(task, currentPlan);

        if (onFailure) {
          const newPlan = await onFailure(currentPlan, task);
          if (newPlan) {
            // Switch to new plan and continue execution
            currentPlan = newPlan;
            break; // Restart the while loop with the new plan
          }
        }
        // No callback or returned null — stop execution
        return currentPlan;
      }
    }
  }

  return currentPlan;
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

/**
 * Creates a recovery plan when a task fails by calling createPlan with
 * context about what succeeded and what failed.
 *
 * @param originalPlan    The original (partially-executed) plan
 * @param failedTask      The task that failed
 * @param projectContext  Project context string for the planner
 * @returns               A new TaskPlan with fresh tasks
 */
export async function replanOnFailure(
  originalPlan: TaskPlan,
  failedTask: Task,
  projectContext: string
): Promise<TaskPlan> {
  const completedTasks = originalPlan.tasks.filter((t) => t.status === "done");

  const completedSummary =
    completedTasks.length > 0
      ? completedTasks
          .map((t) => {
            const resultSnippet = t.result
              ? t.result.slice(0, RESULT_MAX_CHARS) + (t.result.length > RESULT_MAX_CHARS ? "..." : "")
              : "(no output)";
            return `- [${t.id}] ${t.title}: ${resultSnippet}`;
          })
          .join("\n")
      : "(none)";

  const recoveryRequest =
    `RECOVERY PLAN REQUEST\n\n` +
    `Original goal: ${originalPlan.goal}\n\n` +
    `Tasks completed successfully:\n${completedSummary}\n\n` +
    `Task that failed:\n- [${failedTask.id}] ${failedTask.title}: ${failedTask.description}\n` +
    `  Error: ${failedTask.error ?? "unknown error"}\n\n` +
    `Create a recovery plan to achieve the original goal given what has already been done. ` +
    `Do not repeat tasks that already succeeded. Focus on recovering from the failure and completing the remaining work.`;

  return createPlan(recoveryRequest, projectContext);
}

/**
 * Creates a TaskExecutor that runs each task through the orchestrator's
 * runSingleTask function. Wire this into executePlan to make /plan actually
 * execute tasks via the agent loop.
 *
 * @param workDir  Working directory for tool execution
 * @param client   Anthropic client instance
 * @returns        A TaskExecutor compatible with executePlan()
 */
export async function createOrchestratorExecutor(
  workDir: string,
  client: Anthropic,
): Promise<TaskExecutor> {
  // Lazy import to avoid circular deps — orchestrator imports nothing from task-planner
  const { runSingleTask } = await import("./orchestrator.js");

  return async (task: Task): Promise<string> => {
    const context = buildTaskContext(
      // Build a minimal plan context so buildTaskContext works correctly
      { goal: task.title, tasks: [task], createdAt: Date.now() },
      task
    );
    return runSingleTask(client, workDir, context);
  };
}

/** Default filename for persisted plans. */
export const PLAN_FILENAME = ".autoagent-plan.json";

/**
 * Saves a TaskPlan to disk as JSON.
 */
export function savePlan(plan: TaskPlan, workDir: string): string {
  const filePath = path.join(workDir, PLAN_FILENAME);
  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2), "utf8");
  return filePath;
}

/**
 * Loads a TaskPlan from disk. Returns null if the file doesn't exist.
 */
export function loadPlan(workDir: string): TaskPlan | null {
  const filePath = path.join(workDir, PLAN_FILENAME);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as TaskPlan;
  } catch {
    return null;
  }
}
