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
import { parallelResearch } from "./tools/subagent.js";
import { computeTurnBudget, calibrationSuggestion } from "./turn-budget.js";
import { rankFiles } from "./file-ranker.js";

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
 * Re-order changed files in git diff stat output by importance score.
 * Truncates to top 10 files if more than 10 changed, with "(and N more)" note.
 */
function rankChangedFiles(statOutput: string, cwd: string = "."): string {
  const lines = statOutput.split("\n");
  const fileLines = lines.filter(line => line.includes("|"));
  const otherLines = lines.filter(line => !line.includes("|") && line.trim());

  if (fileLines.length <= 1) return statOutput;

  const ranked = rankFiles(cwd);
  const scoreMap = new Map<string, number>(ranked.map(f => [f.path, f.score]));

  const scoredLines = fileLines.map(line => ({
    line,
    score: scoreMap.get(line.trim().split("|")[0].trim()) ?? -1,
  }));
  scoredLines.sort((a, b) => b.score - a.score);

  const MAX_FILES = 10;
  const orderedLines = scoredLines.map(s => s.line);
  let truncationNote = "";
  if (orderedLines.length > MAX_FILES) {
    const remaining = orderedLines.length - MAX_FILES;
    orderedLines.splice(MAX_FILES);
    truncationNote = `... (and ${remaining} more)`;
  }

  const parts = [...orderedLines];
  if (truncationNote) parts.push(truncationNote);
  parts.push(...otherLines);
  return parts.join("\n");
}

/**
 * Extract src filenames from a git diff --stat output.
 * Returns only lines that look like file paths (contain a pipe character).
 */
function extractSrcFiles(statOutput: string): string[] {
  return statOutput
    .split("\n")
    .filter(line => line.includes("|") && line.trim().startsWith("src/"))
    .map(line => line.trim().split("|")[0].trim());
}

/**
 * Read expert-specific breadcrumbs from memory.md.
 * Engineer sees last [Architect] / [Next for Engineer] entries.
 * Architect sees last [Engineer] entries.
 * Meta sees both.
 * Returns null if memory.md doesn't exist or no matching entries found.
 */
export function readExpertBreadcrumbs(expertName: string, rootDir: string = "."): string | null {
  let tags: string[];
  if (expertName === "Engineer") {
    tags = ["[Architect]", "[Next for Engineer]"];
  } else if (expertName === "Architect") {
    tags = ["[Engineer]"];
  } else if (expertName === "Meta") {
    tags = ["[Architect]", "[Engineer]"];
  } else {
    return null;
  }

  try {
    const content = readFileSync(`${rootDir}/memory.md`, "utf-8");
    const lines = content.split("\n");

    const matchingLines: string[] = [];
    for (const line of lines) {
      if (tags.some(tag => line.includes(tag))) {
        matchingLines.push(line.trim());
      }
    }

    if (matchingLines.length === 0) return null;

    // Return up to 3 most recent matching lines
    return matchingLines.slice(-3).join("\n");
  } catch {
    return null;
  }
}

/**
 * Compute what changed in the codebase since the last iteration.
 * Uses `git diff HEAD~1` to compare against the previous commit.
 *
 * If 5+ src files changed and useSubagentSummaries is true, dispatches
 * per-file diffs to cheap sub-agents for concise summaries instead of
 * returning a truncated raw diff.
 *
 * Returns a concise report suitable for including in the agent's
 * initial context without bloating the token budget.
 */
export async function orient(
  maxDiffChars: number = 1000,
  useSubagentSummaries: boolean = true,
  cwd?: string,
): Promise<OrientationReport> {
  // Get the stat summary (which files changed)
  const statResult = await executeBash(
    "git diff HEAD~1 --stat 2>/dev/null",
    10,
    cwd,
    true
  );

  if (statResult.exitCode !== 0 || !statResult.output.trim()) {
    return { diffSummary: null, hasChanges: false, error: null, metricsSummary: computeMetricsSummary(cwd) };
  }

  const statOutput = statResult.output.trim();
  if (!statOutput) {
    return { diffSummary: null, hasChanges: false, error: null, metricsSummary: computeMetricsSummary(cwd) };
  }

  // Rank changed files by importance so the most relevant appear first
  const rankedStatOutput = rankChangedFiles(statOutput, cwd ?? ".");

  // Try parallel subagent summaries when 5+ src files changed
  if (useSubagentSummaries) {
    const srcFiles = extractSrcFiles(statOutput);
    if (srcFiles.length >= 5) {
      try {
        const fileDiffs = await Promise.all(
          srcFiles.map(file =>
            executeBash(`git diff HEAD~1 -- ${file} 2>/dev/null`, 10, cwd, true)
          )
        );

        const prompts = srcFiles.map((file, i) => {
          const diff = fileDiffs[i].output.trim() || "(no diff content)";
          return `Summarize this git diff in 1-2 sentences. Focus on what changed and why it matters:\n\n${diff}`;
        });

        const summaries = await parallelResearch(prompts, "fast", 256);

        const perFileSummaries = srcFiles
          .map((file, i) => `- **${file}**: ${summaries[i].response.trim()}`)
          .join("\n");

        const diffSummary =
          `Files changed:\n${rankedStatOutput}\n\nPer-file summaries (src):\n${perFileSummaries}`;

        return {
          diffSummary,
          hasChanges: true,
          error: null,
          metricsSummary: computeMetricsSummary(cwd),
        };
      } catch {
        // Fall through to raw diff on any error
      }
    }
  }

  // Default: raw diff (fewer than 5 src files, or subagents disabled/failed)
  const diffResult = await executeBash(
    "git diff HEAD~1 -- 'src/**' ':!agentlog.*' 2>/dev/null",
    10,
    cwd,
    true
  );

  let diffContent = diffResult.output.trim();

  if (diffContent.length > maxDiffChars) {
    diffContent = diffContent.slice(0, maxDiffChars) + "\n... (truncated)";
  }

  const summary = diffContent
    ? `Files changed:\n${rankedStatOutput}\n\nDiff (src only):\n${diffContent}`
    : `Files changed:\n${rankedStatOutput}`;

  return {
    diffSummary: summary,
    hasChanges: true,
    error: null,
    metricsSummary: computeMetricsSummary(cwd),
  };
}

/**
 * Read recent iteration metrics and identify actionable patterns.
 * Returns a concise summary string, or null if metrics unavailable.
 */
function computeMetricsSummary(rootDir: string = "."): string | null {
  try {
    const raw = readFileSync(`${rootDir}/.autoagent-metrics.json`, "utf-8");
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
    const baseSummary = `Last 5 iterations (${iterRange}): avg ${avgTurns.toFixed(0)} turns | LOC stalls: ${stalledCount} | ${insights[0]}`;

    // Append calibration advisory using the proper feedback mechanism
    try {
      const metricsFile = `${rootDir}/.autoagent-metrics.json`;
      const budget = computeTurnBudget(metricsFile, null);
      const advisory = calibrationSuggestion(budget);
      if (advisory) {
        // Extract just the body (strip the ## header for inline use)
        const body = advisory.replace(/^## Calibration Advisory\n\n/, "");
        return `${baseSummary}\n${body}`;
      }
    } catch {
      // Calibration is optional — don't fail the whole summary
    }

    return baseSummary;
  } catch {
    return null;
  }
}

/**
 * Format the orientation report for inclusion in the agent's initial message.
 * Accepts an optional expertName to append expert-specific breadcrumbs from memory.md.
 * Falls back gracefully if memory.md is missing or has no matching entries.
 */
export function formatOrientation(report: OrientationReport, expertName?: string, rootDir: string = "."): string {
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

  if (expertName) {
    const breadcrumbs = readExpertBreadcrumbs(expertName, rootDir);
    if (breadcrumbs) {
      parts.push(`## Expert Context (${expertName})\n\n${breadcrumbs}\n`);
    }
  }

  return parts.join("\n");
}
