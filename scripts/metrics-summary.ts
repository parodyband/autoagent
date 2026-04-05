/**
 * Metrics Summary — Analyzes .autoagent-metrics.json
 * Run with: npx tsx scripts/metrics-summary.ts
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

const METRICS_FILE = path.join(process.cwd(), ".autoagent-metrics.json");

interface IterationMetrics {
  iteration: number;
  startTime: string;
  endTime: string;
  turns: number;
  toolCalls: Record<string, number>;
  success: boolean;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

function main(): void {
  if (!existsSync(METRICS_FILE)) {
    console.log("No metrics file found.");
    process.exit(0);
  }

  const metrics: IterationMetrics[] = JSON.parse(readFileSync(METRICS_FILE, "utf-8"));

  if (metrics.length === 0) {
    console.log("No iterations recorded yet.");
    process.exit(0);
  }

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║            AutoAgent Metrics Summary                     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Per-iteration table
  console.log("Iter │ Duration │  Turns │  In Tokens │ Out Tokens │ Tool Calls │ Status");
  console.log("─────┼──────────┼────────┼────────────┼────────────┼────────────┼───────");

  for (const m of metrics) {
    const dur = `${(m.durationMs / 1000).toFixed(0)}s`.padStart(7);
    const turns = String(m.turns).padStart(5);
    const inTok = String(m.inputTokens).padStart(10);
    const outTok = String(m.outputTokens).padStart(10);
    const totalTools = Object.values(m.toolCalls).reduce((a, b) => a + b, 0);
    const tools = String(totalTools).padStart(10);
    const status = m.success ? "  ✅" : "  ❌";
    console.log(`  ${m.iteration}  │${dur} │${turns} │${inTok} │${outTok} │${tools} │${status}`);
  }

  // Aggregates
  const totalTokensIn = metrics.reduce((s, m) => s + m.inputTokens, 0);
  const totalTokensOut = metrics.reduce((s, m) => s + m.outputTokens, 0);
  const totalDuration = metrics.reduce((s, m) => s + m.durationMs, 0);
  const totalTurns = metrics.reduce((s, m) => s + m.turns, 0);
  const successes = metrics.filter((m) => m.success).length;

  console.log("\n── Totals ──────────────────────────────────────────────");
  console.log(`Iterations: ${metrics.length} (${successes} successful)`);
  console.log(`Total duration: ${(totalDuration / 1000).toFixed(0)}s (${(totalDuration / 60000).toFixed(1)}min)`);
  console.log(`Total turns: ${totalTurns}`);
  console.log(`Total tokens: ${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out`);
  console.log(`Avg per iteration: ${(totalTokensIn / metrics.length).toFixed(0)} in / ${(totalTokensOut / metrics.length).toFixed(0)} out`);

  // Tool usage across all iterations
  const toolTotals: Record<string, number> = {};
  for (const m of metrics) {
    for (const [tool, count] of Object.entries(m.toolCalls)) {
      toolTotals[tool] = (toolTotals[tool] || 0) + count;
    }
  }
  console.log("\n── Tool Usage (all iterations) ─────────────────────────");
  const sorted = Object.entries(toolTotals).sort((a, b) => b[1] - a[1]);
  for (const [tool, count] of sorted) {
    console.log(`  ${tool.padEnd(15)} ${count}`);
  }

  // Trends (if we have at least 2 iterations)
  if (metrics.length >= 2) {
    console.log("\n── Trends ──────────────────────────────────────────────");
    const first = metrics[0];
    const last = metrics[metrics.length - 1];

    const durTrend = last.durationMs - first.durationMs;
    const tokTrend = (last.inputTokens + last.outputTokens) - (first.inputTokens + first.outputTokens);

    console.log(`Duration: ${durTrend > 0 ? "↑" : "↓"} ${Math.abs(durTrend / 1000).toFixed(0)}s (iter ${first.iteration}→${last.iteration})`);
    console.log(`Tokens: ${tokTrend > 0 ? "↑" : "↓"} ${Math.abs(tokTrend).toLocaleString()} (iter ${first.iteration}→${last.iteration})`);

    if (metrics.length >= 3) {
      // Moving average trend
      const halfpoint = Math.floor(metrics.length / 2);
      const firstHalf = metrics.slice(0, halfpoint);
      const secondHalf = metrics.slice(halfpoint);
      const avgFirst = firstHalf.reduce((s, m) => s + m.inputTokens, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, m) => s + m.inputTokens, 0) / secondHalf.length;
      console.log(`Token trend (avg): ${avgSecond > avgFirst ? "↑ increasing" : "↓ decreasing"} (${avgFirst.toFixed(0)} → ${avgSecond.toFixed(0)})`);
    }
  }

  // Compact summary for memory.md
  console.log("\n── For memory.md ───────────────────────────────────────");
  console.log(`Metrics (${metrics.length} iters): ${(totalDuration / 1000).toFixed(0)}s total, ${totalTokensIn.toLocaleString()}/${totalTokensOut.toLocaleString()} tokens in/out, ${totalTurns} turns`);
}

main();
