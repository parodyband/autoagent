/**
 * Model selection heuristic for sub-agent delegation.
 *
 * Based on benchmark results (iteration 36):
 * - Haiku (fast): 5/6 challenges, 26/27 tests — fails edge cases
 * - Sonnet (balanced): 6/6 challenges, 27/27 tests — perfect
 *
 * Rule: use the cheapest model that can handle the task reliably.
 */

export type SubAgentModel = "fast" | "balanced";

export interface TaskProfile {
  /** What the sub-agent will do */
  description: string;
  /** Does correctness on edge cases matter? */
  edgeCaseSensitive?: boolean;
  /** Is this a code-generation task? */
  codeGeneration?: boolean;
  /** Is this a review/analysis task requiring nuance? */
  requiresNuance?: boolean;
  /** Override: always use this model */
  forceModel?: SubAgentModel;
}

/**
 * Select the appropriate sub-agent model for a task.
 *
 * Returns "fast" (Haiku, ~$0.001) for simple tasks:
 *   - Summarization, extraction, simple formatting
 *   - Straightforward code generation without tricky edge cases
 *
 * Returns "balanced" (Sonnet, ~$0.01) for harder tasks:
 *   - Code review, bug detection, architectural analysis
 *   - Code generation where edge-case correctness matters
 *   - Tasks requiring nuanced judgment
 */
export function selectModel(task: TaskProfile): SubAgentModel {
  if (task.forceModel) return task.forceModel;

  // Sonnet for anything needing precision or nuance
  if (task.edgeCaseSensitive) return "balanced";
  if (task.requiresNuance) return "balanced";

  // Code generation: Haiku for simple, Sonnet for complex
  if (task.codeGeneration && task.edgeCaseSensitive) return "balanced";

  // Default: Haiku is good enough
  return "fast";
}

/**
 * Quick helper — classify a task description and select model.
 * Uses keyword heuristics when you don't want to build a full TaskProfile.
 */
export function autoSelectModel(description: string): SubAgentModel {
  const lower = description.toLowerCase();

  const needsBalanced =
    /review|audit|bug|edge.?case|complex|architect|refactor|critique|security|vulnerab/i.test(lower);

  if (needsBalanced) return "balanced";
  return "fast";
}
