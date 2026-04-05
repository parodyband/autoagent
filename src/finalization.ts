/**
 * Iteration finalization — captures metrics, commits, and updates state.
 *
 * Extracted from agent.ts to reduce complexity. Handles:
 * - Cache/timing stats logging
 * - Code quality + benchmark capture
 * - Metrics recording
 * - Prediction accuracy injection (machine-verified, prevents self-deception)
 * - Git commit + state update
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import {
  captureCodeQuality,
  captureBenchmarks,
  type CodeQualitySnapshot,
  type BenchmarkSnapshot,
} from "./validation.js";
import { commitIteration, saveState, type IterationState } from "./iteration.js";

import { executeSubagent } from "./tools/subagent.js";
import { executeBash } from "./tools/bash.js";
import type { ToolCache } from "./tool-cache.js";
import type { ToolTimingTracker, TimingStats } from "./tool-timing.js";
import type { Logger } from "./logging.js";

// ─── Metrics ────────────────────────────────────────────────

export interface IterationMetrics {
  iteration: number;
  startTime: string;
  endTime: string;
  turns: number;
  toolCalls: Record<string, number>;
  success: boolean;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  codeQuality?: CodeQualitySnapshot;
  benchmarks?: BenchmarkSnapshot;
  toolTimings?: TimingStats;
}

export function recordMetrics(metricsFile: string, m: IterationMetrics): void {
  let existing: IterationMetrics[] = [];
  if (existsSync(metricsFile)) {
    try { existing = JSON.parse(readFileSync(metricsFile, "utf-8")); } catch { existing = []; }
  }
  existing.push(m);
  writeFileSync(metricsFile, JSON.stringify(existing, null, 2));
}

// ─── Finalization context ───────────────────────────────────

export interface FinalizationCtx {
  iter: number;
  state: IterationState;
  startTime: Date;
  turns: number;
  toolCounts: Record<string, number>;
  tokens: { in: number; out: number; cacheCreate: number; cacheRead: number };
  cache: ToolCache;
  timing: ToolTimingTracker;
  rootDir: string;
  metricsFile: string;
  log: (msg: string) => void;
  logger?: Logger;
  restart: () => never;
  /** Predicted turns captured at iteration start (before goals.md gets rewritten) */
  predictedTurns?: number | null;
}

// ─── Prediction accuracy scoring ────────────────────────────
// Reads predicted turns from goals.md, compares to actual ctx.turns,
// and injects a machine-verified accuracy line into memory.md.
// This runs BEFORE git commit so the truth is always in the record.

export function parsePredictedTurns(rootDir: string): number | null {
  const goalsFile = path.join(rootDir, "goals.md");
  if (!existsSync(goalsFile)) return null;
  const content = readFileSync(goalsFile, "utf-8");
  // Match multiple formats: "Predicted turns: N", "PREDICTION_TURNS: N", "PREDICTION: ...N turns"
  const patterns = [
    /[Pp]redicted\s+turns:\s*(\d+)/,
    /PREDICTION_TURNS:\s*(\d+)/,
    /PREDICTION:.*?(\d+)\s*turns/,
    /[Pp]rediction.*?(\d+)\s*turns/,
  ];
  for (const pat of patterns) {
    const match = content.match(pat);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function getRecentAccuracyRatios(metricsFile: string, goalsDir: string): number[] {
  // We can only check the current iteration's ratio since goals.md changes each iteration.
  // For consecutive-miss detection, we store ratios in the accuracy lines already in memory.
  // This function reads the last N auto-scored lines from memory.md.
  const memFile = path.join(goalsDir, "memory.md");
  if (!existsSync(memFile)) return [];
  const content = readFileSync(memFile, "utf-8");
  const ratios: number[] = [];
  const re = /\[AUTO-SCORED\].*ratio[:\s=]+(\d+\.?\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    ratios.push(parseFloat(m[1]));
  }
  return ratios;
}

function injectAccuracyScore(ctx: FinalizationCtx): void {
  // Prefer pre-captured prediction (set at iteration start, before goals.md gets rewritten)
  // Fall back to parsing current goals.md (which may already contain next iteration's goals)
  const predicted = ctx.predictedTurns ?? parsePredictedTurns(ctx.rootDir);
  const actual = ctx.turns;
  const memFile = path.join(ctx.rootDir, "memory.md");
  if (!existsSync(memFile)) return;

  let content = readFileSync(memFile, "utf-8");

  // Build the accuracy line
  let line: string;
  if (predicted !== null && predicted > 0) {
    const ratio = (actual / predicted).toFixed(2);
    line = `**[AUTO-SCORED] Iteration ${ctx.iter}: predicted ${predicted} turns, actual ${actual} turns, ratio ${ratio}**`;

    // Check for consecutive misses (including this one)
    const pastRatios = getRecentAccuracyRatios(ctx.metricsFile, ctx.rootDir);
    const allRatios = [...pastRatios, actual / predicted];
    const recentMisses = allRatios.slice(-3).filter(r => r > 1.5);
    if (recentMisses.length >= 2) {
      line += `\n⚠ **SCOPE REDUCTION REQUIRED**: ${recentMisses.length} of last ${Math.min(allRatios.length, 3)} iterations exceeded 1.5x prediction. Next iteration MUST reduce scope.`;
    }
  } else {
    line = `**[AUTO-SCORED] Iteration ${ctx.iter}: no prediction found, actual ${actual} turns**`;
  }

  // Inject before the last "---" boundary in Session Log, or append at end
  // Strategy: append to the very end of the file
  content = content.trimEnd() + "\n\n" + line + "\n";
  writeFileSync(memFile, content);
  ctx.log(`Accuracy score injected: ${line.split("\n")[0]}`);
}

// ─── Pre-commit code review via sub-agent ───────────────────
// Sonnet reviews the diff of src/*.ts files before we commit.
// This catches regressions, style issues, and unnecessary complexity.
// Non-blocking: if the review fails or times out, we commit anyway.

async function reviewBeforeCommit(ctx: FinalizationCtx): Promise<string | null> {
  try {
    // Stage everything first so we can see the full diff
    await executeBash("git add -A", 30, undefined, true);
    
    // Get the diff of source files only (most valuable to review)
    const diffResult = await executeBash(
      "git diff --cached -- 'src/*.ts' 'src/**/*.ts' 'scripts/*.ts'",
      30, undefined, true
    );
    
    const diff = diffResult.output.trim();
    if (!diff || diff.length < 50) {
      ctx.log("Pre-commit review: no significant code changes to review");
      return null;
    }

    // Truncate very large diffs to keep sub-agent costs reasonable
    const maxDiffChars = 8000;
    const truncatedDiff = diff.length > maxDiffChars
      ? diff.slice(0, maxDiffChars) + "\n\n... (diff truncated)"
      : diff;

    const result = await executeSubagent(
      `You are a code reviewer for a TypeScript ESM project (an autonomous AI agent that modifies itself).

Review this git diff and report ONLY actual issues. Be concise — 3-5 bullet points max.

Check for:
1. **Regressions**: Does this break existing functionality?
2. **Import errors**: Missing .js extensions, using require() instead of import?
3. **Logic bugs**: Off-by-one, null checks, async/await mistakes?
4. **Unnecessary complexity**: Could this be simpler?

If the code looks good, say "LGTM" and one sentence why.

\`\`\`diff
${truncatedDiff}
\`\`\``,
      "balanced",  // Sonnet — good at code review
      1024,
    );

    ctx.log(`Pre-commit review (${result.inputTokens}in/${result.outputTokens}out): ${result.response.slice(0, 200)}`);
    return result.response;
  } catch (err) {
    ctx.log(`Pre-commit review error (non-fatal): ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/**
 * Log cache and timing stats, capture quality/benchmarks, record metrics,
 * commit the iteration, and update state.
 */
export async function finalizeIteration(
  ctx: FinalizationCtx,
  doRestart: boolean
): Promise<void> {
  // Log cache stats
  const cacheStats = ctx.cache.stats();
  if (cacheStats.hits > 0 || cacheStats.misses > 0) {
    ctx.log(`Cache stats: ${cacheStats.hits} hits, ${cacheStats.misses} misses, ${cacheStats.entries} entries, ${cacheStats.invalidations} invalidations (${cacheStats.invalidatedEntries} entries removed)`);
    if (ctx.logger) ctx.logger.info("Tool cache stats", {
      cacheHits: cacheStats.hits, cacheMisses: cacheStats.misses,
      cacheEntries: cacheStats.entries, invalidations: cacheStats.invalidations,
      invalidatedEntries: cacheStats.invalidatedEntries, toolStats: cacheStats.toolStats,
    });
  }

  // Log timing stats
  const timingStats = ctx.timing.stats();
  if (timingStats.totalCalls > 0) {
    const toolSummary = Object.entries(timingStats.tools)
      .sort((a, b) => b[1].totalMs - a[1].totalMs)
      .map(([name, t]) => `${name}: ${t.calls}x, avg=${t.avgMs}ms, total=${Math.round(t.totalMs)}ms`)
      .join("; ");
    ctx.log(`Tool timing: ${toolSummary}`);
    if (ctx.logger) ctx.logger.info("Tool timing stats", { timing: timingStats });
  }

  // Parallelize independent async work: code quality + benchmarks
  const [codeQuality, benchmarks] = await Promise.all([
    captureCodeQuality(ctx.rootDir),
    captureBenchmarks(ctx.rootDir),
  ]);
  recordMetrics(ctx.metricsFile, {
    iteration: ctx.iter,
    startTime: ctx.startTime.toISOString(),
    endTime: new Date().toISOString(),
    turns: ctx.turns,
    toolCalls: ctx.toolCounts,
    success: true,
    durationMs: Date.now() - ctx.startTime.getTime(),
    inputTokens: ctx.tokens.in,
    outputTokens: ctx.tokens.out,
    cacheCreationTokens: ctx.tokens.cacheCreate || undefined,
    cacheReadTokens: ctx.tokens.cacheRead || undefined,
    codeQuality,
    benchmarks,
    toolTimings: timingStats.totalCalls > 0 ? timingStats : undefined,
  });

  // ─── Prediction accuracy injection ────────────────────────
  // Machine-verified turn count injected into memory.md BEFORE commit.
  // This prevents self-deception: the agent can't round or misreport.
  injectAccuracyScore(ctx);

  // ─── Pre-commit code review ───────────────────────────────
  // Sonnet reviews source changes before we commit. Non-blocking.
  await reviewBeforeCommit(ctx);

  const sha = await commitIteration(ctx.iter);
  const label = doRestart ? "Committed" : "Committed (no restart)";
  ctx.log(`${label}: ${sha.slice(0, 8)} (${ctx.tokens.in} in / ${ctx.tokens.out} out, cache: ${ctx.tokens.cacheCreate} created, ${ctx.tokens.cacheRead} read)`);

  ctx.state.lastSuccessfulIteration = ctx.iter;
  ctx.state.lastFailedCommit = null;
  ctx.state.lastFailureReason = null;
  ctx.state.iteration++;
  saveState(ctx.state);

  if (doRestart) {
    ctx.log(`Restarting as iteration ${ctx.state.iteration}...`);
    ctx.restart();
  }
}
