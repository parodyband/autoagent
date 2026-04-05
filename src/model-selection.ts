/**
 * Model selection heuristic for sub-agent delegation.
 */

export type SubAgentModel = "fast" | "balanced";

export interface TaskProfile {
  description: string;
  edgeCaseSensitive?: boolean;
  codeGeneration?: boolean;
  requiresNuance?: boolean;
  forceModel?: SubAgentModel;
}

export function selectModel(task: TaskProfile): SubAgentModel {
  if (task.forceModel) return task.forceModel;
  if (task.edgeCaseSensitive) return "balanced";
  if (task.requiresNuance) return "balanced";
  if (task.codeGeneration && task.edgeCaseSensitive) return "balanced";
  return "fast";
}

export function autoSelectModel(description: string): SubAgentModel {
  const lower = description.toLowerCase();
  const needsBalanced =
    /review|audit|bug|edge.?case|complex|architect|refactor|critique|security|vulnerab/i.test(lower);
  if (needsBalanced) return "balanced";
  return "fast";
}
