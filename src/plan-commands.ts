/**
 * /plan command handler — extracted from tui.tsx for testability.
 *
 * Pure-ish async function: all side-effects (messages, loading, status)
 * are injected via the context object so tests can mock them.
 */

import fs from "fs";
import path from "path";
import {
  createPlan,
  executePlan,
  formatPlan,
  loadPlan,
  savePlan,
} from "./task-planner.js";
import { createPlanExecutor } from "./plan-executor.js";
import { detectProject } from "./project-detector.js";
import { generatePlanSummary, formatPlanSummary } from "./plan-summary.js";

export interface PlanCommandContext {
  workDir: string;
  addMessage: (text: string) => void;
  /** Executes a single task description via the orchestrator. Optional — required for create/resume. */
  execute?: (description: string) => Promise<string>;
  /** Called with true before async work, false after. Optional. */
  setLoading?: (loading: boolean) => void;
  /** Called with status text during async work. Optional. */
  setStatus?: (status: string) => void;
}

/**
 * Handles /plan subcommands: create, list, resume, help.
 * @param args  Everything after "/plan" (trimmed), e.g. "build a REST API" or "list"
 * @param context  Injected dependencies for I/O and orchestration
 */
export async function handlePlanCommand(
  args: string,
  context: PlanCommandContext
): Promise<void> {
  const { workDir, addMessage, execute, setLoading, setStatus } = context;

  const trimmed = args.trim();

  // /plan or /plan help
  if (trimmed === "" || trimmed === "help") {
    addMessage(
      "Usage:\n" +
        "  /plan <description> — Create and execute a task plan\n" +
        "  /plan list — Show saved plans\n" +
        "  /plan resume — Resume most recent incomplete plan"
    );
    return;
  }

  // /plan list
  if (trimmed === "list") {
    const saved = loadPlan(workDir);
    if (!saved) {
      addMessage("No saved plans. Use /plan <description> to create one.");
    } else {
      const done = saved.tasks.filter((t) => t.status === "done").length;
      const failed = saved.tasks.filter((t) => t.status === "failed").length;
      const status =
        done === saved.tasks.length
          ? "complete"
          : `${done}/${saved.tasks.length} done${failed ? `, ${failed} failed` : ""}`;
      addMessage(
        `Saved plan: "${saved.goal}" — ${status}\n` +
          `Created: ${new Date(saved.createdAt).toLocaleString()}\n\n` +
          formatPlan(saved)
      );
    }
    return;
  }

  // /plan resume
  if (trimmed === "resume") {
    const saved = loadPlan(workDir);
    if (!saved) {
      addMessage("No saved plans to resume. Use /plan <description> to create one.");
      return;
    }
    const pending = saved.tasks.filter(
      (t) => t.status === "pending" || t.status === "failed"
    );
    if (pending.length === 0) {
      addMessage("Plan is already complete. Use /plan <description> to create a new one.");
      return;
    }
    // Reset failed tasks to pending for retry
    saved.tasks.forEach((t) => {
      if (t.status === "failed") t.status = "pending";
    });
    addMessage(`Resuming plan: "${saved.goal}" (${pending.length} tasks remaining)`);
    setLoading?.(true);
    setStatus?.("Executing plan...");
    try {
      const executor = execute
        ? async (task: import("./task-planner.js").Task) => execute(task.description)
        : createPlanExecutor(saved, { workDir, onStatus: setStatus });
      const resumeStartedAt = Date.now();
      const result = await executePlan(
        saved,
        executor,
        (_task, updatedPlan) => {
          addMessage(formatPlan(updatedPlan));
        }
      );
      savePlan(result, workDir);
      addMessage(`Plan complete.\n\n${formatPlan(result)}`);
      setStatus?.("Generating summary...");
      const summary = await generatePlanSummary(result, workDir, resumeStartedAt);
      addMessage(formatPlanSummary(summary));
    } catch (err) {
      addMessage(
        `Plan execution error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    setLoading?.(false);
    setStatus?.("");
    return;
  }

  // /plan <description> — unknown single-word subcommands fall through to create
  const description = trimmed;
  if (!description) {
    addMessage("Usage: /plan <description>");
    return;
  }

  // Build project context
  let projectContext = `Working directory: ${workDir}`;
  try {
    const memoryPath = path.join(workDir, ".autoagent.md");
    const memoryContent = fs.readFileSync(memoryPath, "utf8");
    projectContext += `\n\n## Project Memory (.autoagent.md)\n${memoryContent}`;
  } catch {
    // ENOENT — no memory file, that's fine
  }
  try {
    const info = detectProject(workDir);
    if (info.name) {
      projectContext += `\n\n## Project Summary\nName: ${info.name}, Type: ${info.type}, Language: ${info.language}`;
    }
  } catch {
    // detectProject failure is non-fatal
  }

  setLoading?.(true);
  setStatus?.("Creating plan...");
  try {
    const plan = await createPlan(description, projectContext);
    addMessage(`Created plan:\n\n${formatPlan(plan)}`);
    savePlan(plan, workDir);
    setStatus?.("Executing plan...");
    const executor = execute
      ? async (task: import("./task-planner.js").Task) => execute(task.description)
      : createPlanExecutor(plan, { workDir, onStatus: setStatus });
    const execStartedAt = Date.now();
    const result = await executePlan(
      plan,
      executor,
      (_task, updatedPlan) => {
        addMessage(formatPlan(updatedPlan));
      }
    );
    savePlan(result, workDir);
    addMessage(`Plan complete.\n\n${formatPlan(result)}`);
    setStatus?.("Generating summary...");
    const summary = await generatePlanSummary(result, workDir, execStartedAt);
    addMessage(formatPlanSummary(summary));
  } catch (err) {
    addMessage(
      `Plan error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  setLoading?.(false);
  setStatus?.("");
}
