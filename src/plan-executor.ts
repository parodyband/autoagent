/**
 * Wires the real Orchestrator as the executor for /plan tasks.
 *
 * createPlanExecutor() returns a TaskExecutor compatible callback that:
 * 1. Spins up an Orchestrator for the given workDir
 * 2. Sends the task description + rich context string
 * 3. Returns the result text (or throws on failure)
 */

import { Orchestrator } from "./orchestrator.js";
import type { Task, TaskPlan } from "./task-planner.js";
import { buildTaskContext } from "./task-planner.js";

export interface PlanExecutorOptions {
  workDir: string;
  /** Optional status callback forwarded to the orchestrator */
  onStatus?: (status: string) => void;
  /** Optional text-delta callback forwarded to the orchestrator */
  onText?: (delta: string) => void;
  /** Optional tool-call callback forwarded to the orchestrator */
  onToolCall?: (name: string, input: string, result: string) => void;
}

/**
 * Returns a TaskExecutor that uses a fresh Orchestrator instance per task.
 *
 * A new Orchestrator is created for each task to avoid shared state /
 * conversation history bleeding across tasks.
 */
export function createPlanExecutor(
  plan: TaskPlan,
  opts: PlanExecutorOptions
): (task: Task) => Promise<string> {
  return async (task: Task): Promise<string> => {
    const context = buildTaskContext(plan, task);

    const orch = new Orchestrator({
      workDir: opts.workDir,
      onStatus: opts.onStatus,
      onText: opts.onText,
      onToolCall: opts.onToolCall,
    });

    await orch.init();

    // Build a prompt that includes the full task context
    const prompt =
      context.trim() +
      "\n\n## Your Task\n" +
      task.description;

    const result = await orch.send(prompt);

    if (!result.text) {
      throw new Error(`Task "${task.title}" returned empty result`);
    }

    return result.text;
  };
}
