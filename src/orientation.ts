/**
 * Orientation module — situational awareness at iteration start.
 *
 * Before the agent starts working, it needs to know what changed since
 * its last iteration. This prevents stale mental models — e.g., if the
 * operator modified code between iterations, the agent sees the diff
 * immediately rather than discovering breakage mid-iteration.
 *
 * This module implements the OODA "Orient" phase.
 */

import { executeBash } from "./tools/bash.js";

export interface OrientationReport {
  /** Summary of files changed since last iteration commit */
  diffSummary: string | null;
  /** Whether there were any changes at all */
  hasChanges: boolean;
  /** Error message if diff couldn't be computed */
  error: string | null;
}

/**
 * Compute what changed in the codebase since the last iteration.
 * Uses `git diff HEAD~1` to compare against the previous commit.
 * 
 * Returns a concise report suitable for including in the agent's
 * initial context without bloating the token budget.
 */
export async function orient(maxDiffChars: number = 1000): Promise<OrientationReport> {
  // Get the stat summary (which files changed)
  const statResult = await executeBash(
    "git diff HEAD~1 --stat 2>/dev/null",
    10,
    undefined,
    true
  );

  if (statResult.exitCode !== 0 || !statResult.output.trim()) {
    return { diffSummary: null, hasChanges: false, error: null };
  }

  const statOutput = statResult.output.trim();
  if (!statOutput) {
    return { diffSummary: null, hasChanges: false, error: null };
  }

  // Only diff src/ files — .md and .json are the agent's own output and already known
  const diffResult = await executeBash(
    "git diff HEAD~1 -- 'src/**' ':!agentlog.*' 2>/dev/null",
    10,
    undefined,
    true
  );

  let diffContent = diffResult.output.trim();
  
  if (diffContent.length > maxDiffChars) {
    diffContent = diffContent.slice(0, maxDiffChars) + "\n... (truncated)";
  }

  const summary = diffContent
    ? `Files changed:\n${statOutput}\n\nDiff (src only):\n${diffContent}`
    : `Files changed:\n${statOutput}`;

  return {
    diffSummary: summary,
    hasChanges: true,
    error: null,
  };
}

/**
 * Format the orientation report for inclusion in the agent's initial message.
 * Returns empty string if nothing notable happened.
 */
export function formatOrientation(report: OrientationReport): string {
  if (!report.hasChanges || !report.diffSummary) {
    return "";
  }

  return (
    `## Orientation — Changes since last iteration\n\n` +
    `${report.diffSummary}\n`
  );
}
