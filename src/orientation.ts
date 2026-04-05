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

import { readFileSync } from "fs";
import { executeBash } from "./tools/bash.js";

export interface OrientationReport {
  /** Summary of files changed since last iteration commit */
  diffSummary: string | null;
  /** Whether there were any changes at all */
  hasChanges: boolean;
  /** Error message if diff couldn't be computed */
  error: string | null;
  /** Metrics summary from recent iterations */
  metricsSummary: string | null;
}

interface IterationMetrics {
  iteration: number;
  turns: number;
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  codeQuality?: { totalLOC: number };
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
    return { diffSummary: null, hasChanges: false, error: null, metricsSummary: computeMetricsSummary() };
  }

  const statOutput = statResult.output.trim();
  if (!statOutput) {
    return { diffSummary: null, hasChanges: false, error: null, metricsSummary: computeMetricsSummary() };
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
    metricsSummary: computeMetricsSummary(),
  };
}

/**
 * Read recent iteration metrics and identify actionable patterns.
 * Returns a concise summary string, or null if metrics unavailable.
 */
function computeMetricsSummary(): string | null {
  try {
    const raw = readFileSync(".autoagent-metrics.json", "utf-8");
    const all: IterationMetrics[] = JSON.parse(raw);
    if (all.length < 2) return null;

    const recent = all.slice(-5);
    const turns = recent.map(m => m.turns);
    const avgTurns = turns.reduce((a, b) => a + b, 0) / turns.length;

    // Token trend: compare first half vs second half of recent
    const cacheTokens = recent.map(m => m.cacheReadTokens ?? 0);
    const halfIdx = Math.floor(recent.length / 2);
    const firstHalfAvg = cacheTokens.slice(0, halfIdx).reduce((a, b) => a + b, 0) / halfIdx;
    const secondHalfAvg = cacheTokens.slice(halfIdx).reduce((a, b) => a + b, 0) / (recent.length - halfIdx);

    // LOC changes: detect stalled iterations
    const locs = recent.map(m => m.codeQuality?.totalLOC ?? 0);
    const stalledCount = locs.filter((loc, i) => i > 0 && loc === locs[i - 1]).length;

    // High-turn outliers (>20)
    const highTurnIters = recent.filter(m => m.turns > 20);

    // Build insights — pick the most notable pattern
    const insights: string[] = [];

    if (highTurnIters.length >= 2) {
      insights.push(`⚠ ${highTurnIters.length}/${recent.length} recent iterations used >20 turns — scope reduction needed.`);
    }

    if (stalledCount >= 2) {
      insights.push(`⚠ ${stalledCount}/${recent.length - 1} recent iterations had zero LOC change — possible churn without code output.`);
    }

    const tokenTrend = secondHalfAvg > firstHalfAvg * 1.5 ? "growing" :
                       secondHalfAvg < firstHalfAvg * 0.5 ? "shrinking" : "stable";
    if (tokenTrend === "growing") {
      insights.push(`Token usage trending up (${Math.round(firstHalfAvg/1000)}K → ${Math.round(secondHalfAvg/1000)}K cache reads). Watch for context bloat.`);
    }

    if (insights.length === 0) {
      insights.push(`Recent iterations averaging ${avgTurns.toFixed(0)} turns. No red flags detected.`);
    }

    const iterRange = `${recent[0].iteration}–${recent[recent.length - 1].iteration}`;
    return `Last 5 iterations (${iterRange}): avg ${avgTurns.toFixed(0)} turns | LOC stalls: ${stalledCount} | ${insights[0]}`;
  } catch {
    return null;
  }
}

/**
 * Format the orientation report for inclusion in the agent's initial message.
 * Returns empty string if nothing notable happened.
 */
export function formatOrientation(report: OrientationReport): string {
  const parts: string[] = [];

  if (report.hasChanges && report.diffSummary) {
    parts.push(
      `## Orientation — Changes since last iteration\n\n` +
      `${report.diffSummary}\n`
    );
  }

  if (report.metricsSummary) {
    parts.push(`## Metrics Summary\n\n${report.metricsSummary}\n`);
  }

  return parts.join("\n");
}
