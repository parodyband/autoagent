/**
 * Iteration finalization — captures metrics, commits, and updates state.
 *
 * Extracted from agent.ts to reduce complexity. Handles:
 * - Cache/timing stats logging
 * - Code quality + benchmark capture
 * - Metrics recording
 * - Git commit + state update
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import {
  captureCodeQuality,
  captureBenchmarks,
  type CodeQualitySnapshot,
  type BenchmarkSnapshot,
} from "./validation.js";
import { commitIteration, saveState, type IterationState } from "./iteration.js";
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

  const codeQuality = await captureCodeQuality(ctx.rootDir);
  const benchmarks = await captureBenchmarks(ctx.rootDir);
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
