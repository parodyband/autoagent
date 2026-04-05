/**
 * Dashboard generator for AutoAgent.
 * 
 * Reads .autoagent-metrics.json and generates dashboard.html
 * with a table of all iterations and summary stats.
 * 
 * Run: npx tsx scripts/dashboard.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { analyzeCodebase, type CodebaseAnalysis } from "../src/validation.js";
import { parseJsonlLog, type LogEntry } from "../src/logging.js";
import type { TimingStats, ToolTimingEntry } from "../src/tool-timing.js";
// iteration-diff.ts was removed; define stub types inline
interface IterationDiffStats {
  iteration: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  netDelta: number;
}

const ROOT = process.cwd();
const METRICS_FILE = path.join(ROOT, ".autoagent-metrics.json");
const OUTPUT_FILE = path.join(ROOT, "dashboard.html");

interface CodeQualitySnapshot {
  totalLOC: number;
  codeLOC: number;
  fileCount: number;
  functionCount: number;
  complexity: number;
  testCount: number;
}

interface BenchmarkSnapshot {
  testDurationMs: number;
  testCount: number;
}

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
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  predictedTurns?: number;
  codeQuality?: CodeQualitySnapshot;
  benchmarks?: BenchmarkSnapshot;
  toolTimings?: TimingStats;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function totalToolCalls(tc: Record<string, number>): number {
  return Object.values(tc).reduce((a, b) => a + b, 0);
}

function topTools(tc: Record<string, number>): string {
  return Object.entries(tc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name}(${count})`)
    .join(", ");
}

function generateCodeQualitySection(): string {
  try {
    const analysis = analyzeCodebase();
    const fileRows = analysis.files.map(f => `
      <tr>
        <td>${f.file}</td>
        <td>${f.totalLines}</td>
        <td>${f.codeLines}</td>
        <td>${f.commentLines}</td>
        <td>${f.functionCount}</td>
        <td style="color: ${f.complexity > 30 ? '#f85149' : f.complexity > 15 ? '#d29922' : '#3fb950'}">${f.complexity}</td>
      </tr>`).join("\n");

    return `
<h2 style="color: #58a6ff; margin-top: 2rem;">📊 Code Quality</h2>
<div class="stats" style="margin-top: 1rem;">
  <div class="stat-card"><div class="stat-value">${analysis.totals.fileCount}</div><div class="stat-label">Source Files</div></div>
  <div class="stat-card"><div class="stat-value">${analysis.totals.codeLines}</div><div class="stat-label">Code Lines</div></div>
  <div class="stat-card"><div class="stat-value">${analysis.totals.functionCount}</div><div class="stat-label">Functions</div></div>
  <div class="stat-card"><div class="stat-value">${analysis.totals.complexity}</div><div class="stat-label">Total Complexity</div></div>
  <div class="stat-card"><div class="stat-value">${analysis.averageComplexityPerFunction}</div><div class="stat-label">Avg Cmplx/Func</div></div>
</div>
<table style="margin-top: 1rem;">
<thead><tr><th>File</th><th>Lines</th><th>Code</th><th>Comments</th><th>Functions</th><th>Complexity</th></tr></thead>
<tbody>
${fileRows}
<tr class="summary">
  <td><strong>Total</strong></td>
  <td>${analysis.totals.totalLines}</td>
  <td>${analysis.totals.codeLines}</td>
  <td>${analysis.totals.commentLines}</td>
  <td>${analysis.totals.functionCount}</td>
  <td>${analysis.totals.complexity}</td>
</tr>
</tbody>
</table>`;
  } catch {
    return '<p style="color: #8b949e; margin-top: 2rem;">Code quality analysis unavailable.</p>';
  }
}

function generateCodeQualityTrend(metrics: IterationMetrics[]): string {
  const withQuality = metrics.filter(m => m.codeQuality);
  if (withQuality.length === 0) return "";

  const rows = withQuality.map(m => {
    const q = m.codeQuality!;
    return `
      <tr>
        <td>${m.iteration}</td>
        <td>${q.fileCount}</td>
        <td>${q.totalLOC}</td>
        <td>${q.codeLOC}</td>
        <td>${q.functionCount}</td>
        <td style="color: ${q.complexity > 200 ? '#f85149' : q.complexity > 100 ? '#d29922' : '#3fb950'}">${q.complexity}</td>
        <td>${q.testCount}</td>
      </tr>`;
  }).join("\n");

  return `
<h2 style="color: #58a6ff; margin-top: 2rem;">📈 Code Quality Trend</h2>
<table style="margin-top: 1rem;">
<thead><tr><th>Iter</th><th>Files</th><th>Total LOC</th><th>Code LOC</th><th>Functions</th><th>Complexity</th><th>Tests</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

function generateBenchmarkTrend(metrics: IterationMetrics[]): string {
  const withBenchmarks = metrics.filter(m => m.benchmarks);
  if (withBenchmarks.length === 0) return "";

  const rows = withBenchmarks.map(m => {
    const b = m.benchmarks!;
    const durationColor = b.testDurationMs > 10000 ? '#f85149' : b.testDurationMs > 5000 ? '#d29922' : '#3fb950';
    return `
      <tr>
        <td>${m.iteration}</td>
        <td>${b.testCount}</td>
        <td style="color: ${durationColor}">${(b.testDurationMs / 1000).toFixed(1)}s</td>
        <td>${b.testCount > 0 ? (b.testDurationMs / b.testCount).toFixed(0) + "ms" : "—"}</td>
      </tr>`;
  }).join("\n");

  return `
<h2 style="color: #58a6ff; margin-top: 2rem;">⚡ Benchmark Trend</h2>
<table style="margin-top: 1rem;">
<thead><tr><th>Iter</th><th>Tests</th><th>Duration</th><th>Per Test</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

function generateToolPerformanceSection(metrics: IterationMetrics[]): string {
  const withTimings = metrics.filter(m => m.toolTimings);
  if (withTimings.length === 0) return "";

  // Per-iteration rows
  const iterRows = withTimings.map(m => {
    const t = m.toolTimings!;
    const sorted = Object.entries(t.tools).sort((a, b) => b[1].totalMs - a[1].totalMs);
    const breakdown = sorted.map(([name, s]) =>
      `${name}: ${s.calls}× avg=${s.avgMs}ms`
    ).join(", ");
    return `<tr><td>${m.iteration}</td><td>${t.totalCalls}</td><td>${Math.round(t.totalMs)}ms</td><td>${breakdown}</td></tr>`;
  }).join("\n");

  // Aggregate across all iterations
  const aggr: Record<string, { calls: number; totalMs: number; minMs: number; maxMs: number }> = {};
  for (const m of withTimings) {
    for (const [name, s] of Object.entries(m.toolTimings!.tools)) {
      if (!aggr[name]) {
        aggr[name] = { calls: 0, totalMs: 0, minMs: Infinity, maxMs: 0 };
      }
      aggr[name].calls += s.calls;
      aggr[name].totalMs += s.totalMs;
      aggr[name].minMs = Math.min(aggr[name].minMs, s.minMs);
      aggr[name].maxMs = Math.max(aggr[name].maxMs, s.maxMs);
    }
  }

  const aggrRows = Object.entries(aggr)
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(([name, s]) => {
      const avg = s.calls > 0 ? Math.round(s.totalMs / s.calls) : 0;
      const barWidth = Math.min(100, Math.round(s.totalMs / Math.max(1, ...Object.values(aggr).map(a => a.totalMs)) * 100));
      return `<tr>
        <td>${name}</td><td>${s.calls}</td>
        <td>${Math.round(s.totalMs)}ms</td><td>${avg}ms</td>
        <td>${s.minMs === Infinity ? "—" : Math.round(s.minMs) + "ms"}</td>
        <td>${Math.round(s.maxMs)}ms</td>
        <td><div style="background:#58a6ff;height:12px;width:${barWidth}%;border-radius:3px;"></div></td>
      </tr>`;
    }).join("\n");

  return `
<h2 style="color: #58a6ff; margin-top: 2rem;">⏱️ Tool Performance</h2>
<h3 style="color: #c9d1d9; margin-top: 1rem; font-size: 1rem;">Aggregate (All Iterations)</h3>
<table style="margin-top: 0.5rem;">
<thead><tr><th>Tool</th><th>Calls</th><th>Total</th><th>Avg</th><th>Min</th><th>Max</th><th>Relative</th></tr></thead>
<tbody>${aggrRows}</tbody>
</table>

<h3 style="color: #c9d1d9; margin-top: 1.5rem; font-size: 1rem;">Per Iteration</h3>
<table style="margin-top: 0.5rem;">
<thead><tr><th>Iter</th><th>Calls</th><th>Total Time</th><th>Breakdown</th></tr></thead>
<tbody>${iterRows}</tbody>
</table>`;
}

function generateCodeChangesSection(diffs: IterationDiffStats[]): string {
  if (diffs.length === 0) return "";

  const maxChurn = Math.max(...diffs.map(d => d.linesAdded + d.linesRemoved));

  const rows = diffs.map(d => {
    const churn = d.linesAdded + d.linesRemoved;
    const barWidth = Math.min(100, Math.round(churn / Math.max(1, maxChurn) * 100));
    const deltaColor = d.netDelta > 0 ? "#3fb950" : d.netDelta < 0 ? "#f85149" : "#8b949e";
    return `<tr>
      <td>${d.iteration}</td>
      <td>${d.filesChanged}</td>
      <td style="color:#3fb950">+${d.linesAdded}</td>
      <td style="color:#f85149">-${d.linesRemoved}</td>
      <td style="color:${deltaColor}">${d.netDelta > 0 ? "+" : ""}${d.netDelta}</td>
      <td><div style="background:linear-gradient(90deg,#3fb950 ${Math.round(d.linesAdded/Math.max(1,churn)*100)}%,#f85149 ${Math.round(d.linesAdded/Math.max(1,churn)*100)}%);height:12px;width:${barWidth}%;border-radius:3px;"></div></td>
    </tr>`;
  }).join("\n");

  const totalAdded = diffs.reduce((s, d) => s + d.linesAdded, 0);
  const totalRemoved = diffs.reduce((s, d) => s + d.linesRemoved, 0);
  const totalFiles = diffs.reduce((s, d) => s + d.filesChanged, 0);

  return `
<h2 style="color: #58a6ff; margin-top: 2rem;">📝 Code Changes</h2>
<div class="stats" style="margin-top: 1rem;">
  <div class="stat-card"><div class="stat-value" style="color:#3fb950">+${totalAdded}</div><div class="stat-label">Lines Added</div></div>
  <div class="stat-card"><div class="stat-value" style="color:#f85149">-${totalRemoved}</div><div class="stat-label">Lines Removed</div></div>
  <div class="stat-card"><div class="stat-value">${totalAdded - totalRemoved}</div><div class="stat-label">Net Delta</div></div>
  <div class="stat-card"><div class="stat-value">${totalFiles}</div><div class="stat-label">Files Changed</div></div>
</div>
<table style="margin-top: 1rem;">
<thead><tr><th>Iter</th><th>Files</th><th>Added</th><th>Removed</th><th>Net</th><th>Churn</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

function generateTurnPredictionChart(metrics: IterationMetrics[]): string {
  const withPredictions = metrics.filter(m => m.predictedTurns != null && m.predictedTurns > 0);
  if (withPredictions.length === 0) {
    return `
<h2 style="color: #58a6ff; margin-top: 2rem;">🎯 Turn Prediction Accuracy</h2>
<p style="color: #8b949e; margin-top: 0.5rem;">No prediction data available yet. Predictions will appear once iterations include <code>predictedTurns</code> in metrics.</p>`;
  }

  const padding = 50;
  const width = 500;
  const height = 400;
  const plotW = width - 2 * padding;
  const plotH = height - 2 * padding;

  const allValues = withPredictions.flatMap(m => [m.predictedTurns!, m.turns]);
  const maxVal = Math.max(...allValues, 10);
  const scale = (v: number) => (v / maxVal);

  // Build scatter points
  const points = withPredictions.map(m => {
    const x = padding + scale(m.predictedTurns!) * plotW;
    const y = height - padding - scale(m.turns) * plotH;
    const ratio = m.turns / m.predictedTurns!;
    const color = ratio <= 1.5 ? "#3fb950" : ratio <= 2.0 ? "#d29922" : "#f85149";
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${color}" opacity="0.85"><title>Iter ${m.iteration}: predicted ${m.predictedTurns}, actual ${m.turns} (${ratio.toFixed(2)}x)</title></circle>`;
  }).join("\n    ");

  // Perfect prediction line (diagonal)
  const lineX1 = padding;
  const lineY1 = height - padding;
  const lineX2 = padding + plotW;
  const lineY2 = padding;

  // Axis ticks
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round(maxVal * i / tickCount));
  const xTicks = ticks.map(v => {
    const x = padding + scale(v) * plotW;
    return `<line x1="${x}" y1="${height - padding}" x2="${x}" y2="${height - padding + 5}" stroke="#484f58"/>
    <text x="${x}" y="${height - padding + 18}" text-anchor="middle" fill="#8b949e" font-size="11">${v}</text>`;
  }).join("\n    ");
  const yTicks = ticks.map(v => {
    const y = height - padding - scale(v) * plotH;
    return `<line x1="${padding - 5}" y1="${y}" x2="${padding}" y2="${y}" stroke="#484f58"/>
    <text x="${padding - 10}" y="${y + 4}" text-anchor="end" fill="#8b949e" font-size="11">${v}</text>`;
  }).join("\n    ");

  // Stats
  const avgRatio = withPredictions.reduce((s, m) => s + m.turns / m.predictedTurns!, 0) / withPredictions.length;
  const accurate = withPredictions.filter(m => m.turns / m.predictedTurns! <= 1.5).length;

  return `
<h2 style="color: #58a6ff; margin-top: 2rem;">🎯 Turn Prediction Accuracy</h2>
<div class="stats" style="margin-top: 1rem;">
  <div class="stat-card"><div class="stat-value">${withPredictions.length}</div><div class="stat-label">Predictions</div></div>
  <div class="stat-card"><div class="stat-value">${avgRatio.toFixed(2)}x</div><div class="stat-label">Avg Actual/Predicted</div></div>
  <div class="stat-card"><div class="stat-value">${accurate}/${withPredictions.length}</div><div class="stat-label">Within 1.5x</div></div>
</div>
<svg width="${width}" height="${height}" style="background: #161b22; border-radius: 8px; margin-top: 1rem;">
  <!-- Grid -->
  <rect x="${padding}" y="${padding}" width="${plotW}" height="${plotH}" fill="none" stroke="#21262d"/>
  <!-- Perfect line -->
  <line x1="${lineX1}" y1="${lineY1}" x2="${lineX2}" y2="${lineY2}" stroke="#58a6ff" stroke-width="1" stroke-dasharray="6,4" opacity="0.5"/>
  <!-- Axes -->
  ${xTicks}
  ${yTicks}
  <!-- Labels -->
  <text x="${width / 2}" y="${height - 5}" text-anchor="middle" fill="#8b949e" font-size="12">Predicted Turns</text>
  <text x="14" y="${height / 2}" text-anchor="middle" fill="#8b949e" font-size="12" transform="rotate(-90, 14, ${height / 2})">Actual Turns</text>
  <!-- Points -->
  ${points}
</svg>
<p style="color: #484f58; font-size: 0.8rem; margin-top: 0.5rem;">
  <span style="color: #3fb950;">●</span> ≤1.5x &nbsp;
  <span style="color: #d29922;">●</span> 1.5–2x &nbsp;
  <span style="color: #f85149;">●</span> &gt;2x &nbsp;
  <span style="color: #58a6ff;">- -</span> Perfect prediction
</p>`;
}

function generateTokenCostChart(metrics: IterationMetrics[]): string {
  if (metrics.length === 0) return "";

  const padding = { top: 30, right: 20, bottom: 50, left: 70 };
  const width = 700;
  const height = 350;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  // Compute total tokens per iteration
  const data = metrics.map(m => ({
    iter: m.iteration,
    input: m.inputTokens + (m.cacheCreationTokens || 0) + (m.cacheReadTokens || 0),
    output: m.outputTokens,
    total: m.inputTokens + m.outputTokens + (m.cacheCreationTokens || 0) + (m.cacheReadTokens || 0),
  }));

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const yScale = (v: number) => height - padding.bottom - (v / maxTotal) * plotH;

  // Build polylines
  const inputLine = data.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.input).toFixed(1)}`).join(" ");
  const outputLine = data.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.output).toFixed(1)}`).join(" ");
  const totalLine = data.map((d, i) => `${xScale(i).toFixed(1)},${yScale(d.total).toFixed(1)}`).join(" ");

  // Fill area under total line
  const totalArea = `${xScale(0).toFixed(1)},${yScale(0).toFixed(1)} ${totalLine} ${xScale(data.length - 1).toFixed(1)},${yScale(0).toFixed(1)}`;

  // Y-axis ticks
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const v = (maxTotal * i) / yTickCount;
    const y = yScale(v);
    const label = formatNumber(Math.round(v));
    return `<line x1="${padding.left - 5}" y1="${y}" x2="${padding.left}" y2="${y}" stroke="#484f58"/>
    <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#21262d" stroke-dasharray="2,4"/>
    <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="#8b949e" font-size="11">${label}</text>`;
  }).join("\n    ");

  // X-axis ticks (show every Nth iteration to avoid crowding)
  const step = Math.max(1, Math.floor(data.length / 10));
  const xTicks = data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d, _, arr) => {
    const idx = data.indexOf(d);
    const x = xScale(idx);
    return `<line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${height - padding.bottom + 5}" stroke="#484f58"/>
    <text x="${x}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="#8b949e" font-size="11">${d.iter}</text>`;
  }).join("\n    ");

  // Cost estimates (Opus pricing: $15/M input, $75/M output, $3.75/M cache read, $18.75/M cache create)
  const totalInputCost = metrics.reduce((s, m) => s + m.inputTokens * 15 / 1_000_000, 0);
  const totalOutputCost = metrics.reduce((s, m) => s + m.outputTokens * 75 / 1_000_000, 0);
  const totalCacheReadCost = metrics.reduce((s, m) => s + (m.cacheReadTokens || 0) * 3.75 / 1_000_000, 0);
  const totalCacheCreateCost = metrics.reduce((s, m) => s + (m.cacheCreationTokens || 0) * 18.75 / 1_000_000, 0);
  const totalCost = totalInputCost + totalOutputCost + totalCacheReadCost + totalCacheCreateCost;

  return `
<h2 style="color: #58a6ff; margin-top: 2rem;">💰 Token Cost Trend</h2>
<div class="stats" style="margin-top: 1rem;">
  <div class="stat-card"><div class="stat-value">${totalCost.toFixed(2)}</div><div class="stat-label">Est. Total Cost</div></div>
  <div class="stat-card"><div class="stat-value">${(totalCost / metrics.length).toFixed(2)}</div><div class="stat-label">Avg Cost/Iter</div></div>
  <div class="stat-card"><div class="stat-value">${totalInputCost.toFixed(2)}</div><div class="stat-label">Input Cost</div></div>
  <div class="stat-card"><div class="stat-value">${totalOutputCost.toFixed(2)}</div><div class="stat-label">Output Cost</div></div>
  <div class="stat-card"><div class="stat-value">${totalCacheReadCost.toFixed(2)}</div><div class="stat-label">Cache Read Cost</div></div>
</div>
<svg width="${width}" height="${height}" style="background: #161b22; border-radius: 8px; margin-top: 1rem;">
  <!-- Grid -->
  <rect x="${padding.left}" y="${padding.top}" width="${plotW}" height="${plotH}" fill="none" stroke="#21262d"/>
  ${yTicks}
  ${xTicks}
  <!-- Area fill -->
  <polygon points="${totalArea}" fill="#58a6ff" opacity="0.08"/>
  <!-- Lines -->
  <polyline points="${totalLine}" fill="none" stroke="#58a6ff" stroke-width="2" opacity="0.4"/>
  <polyline points="${inputLine}" fill="none" stroke="#d29922" stroke-width="1.5"/>
  <polyline points="${outputLine}" fill="none" stroke="#3fb950" stroke-width="1.5"/>
  <!-- Axis labels -->
  <text x="${width / 2}" y="${height - 5}" text-anchor="middle" fill="#8b949e" font-size="12">Iteration</text>
  <text x="14" y="${height / 2}" text-anchor="middle" fill="#8b949e" font-size="12" transform="rotate(-90, 14, ${height / 2})">Tokens</text>
</svg>
<p style="color: #484f58; font-size: 0.8rem; margin-top: 0.5rem;">
  <span style="color: #d29922;">━</span> Input tokens &nbsp;
  <span style="color: #3fb950;">━</span> Output tokens &nbsp;
  <span style="color: #58a6ff; opacity: 0.4;">━</span> Total (incl. cache)
</p>
<p style="color: #484f58; font-size: 0.75rem;">Cost estimates based on Claude Opus pricing: $15/M input, $75/M output, $3.75/M cache read, $18.75/M cache create</p>`;
}

function generateLogAnalysisSection(jsonlPath: string): string {
  const entries = parseJsonlLog(jsonlPath);
  if (entries.length === 0) return "";

  // ── Errors & Warnings ──
  const issues = entries.filter(e => e.level === "error" || e.level === "warn");
  const recentIssues = issues.slice(-20); // last 20

  let issueRows = "";
  if (recentIssues.length > 0) {
    issueRows = recentIssues.map(e => {
      const color = e.level === "error" ? "#f85149" : "#d29922";
      const icon = e.level === "error" ? "❌" : "⚠️";
      const time = new Date(e.timestamp).toLocaleTimeString();
      return `<tr><td>${icon} <span style="color:${color}">${e.level.toUpperCase()}</span></td><td>${e.iteration}</td><td>${e.turn || "—"}</td><td>${time}</td><td>${escapeHtml(e.message.slice(0, 120))}</td></tr>`;
    }).join("\n");
  } else {
    issueRows = '<tr><td colspan="5" style="color: #3fb950; text-align: center;">✅ No errors or warnings</td></tr>';
  }

  // ── Per-iteration tool frequency from log messages ──
  const iterToolMap = new Map<number, Record<string, number>>();
  const toolNamePattern = /^(read_file|write_file|grep|list_files|web_fetch|think|bash|\$)/;
  for (const e of entries) {
    const match = e.message.match(toolNamePattern);
    if (!match) continue;
    const toolName = match[1] === "$" ? "bash" : match[1];
    if (!iterToolMap.has(e.iteration)) iterToolMap.set(e.iteration, {});
    const tools = iterToolMap.get(e.iteration)!;
    tools[toolName] = (tools[toolName] || 0) + 1;
  }

  let toolFreqRows = "";
  const sortedIters = [...iterToolMap.keys()].sort((a, b) => a - b).slice(-10); // last 10 iterations
  for (const iter of sortedIters) {
    const tools = iterToolMap.get(iter)!;
    const sorted = Object.entries(tools).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, c]) => s + c, 0);
    const breakdown = sorted.map(([t, c]) => `${t}(${c})`).join(", ");
    toolFreqRows += `<tr><td>${iter}</td><td>${total}</td><td>${breakdown}</td></tr>\n`;
  }

  // ── Timing insights ──
  const iterTimestamps = new Map<number, { first: number; last: number; turns: number }>();
  for (const e of entries) {
    const ts = new Date(e.timestamp).getTime();
    if (!iterTimestamps.has(e.iteration)) {
      iterTimestamps.set(e.iteration, { first: ts, last: ts, turns: 0 });
    }
    const t = iterTimestamps.get(e.iteration)!;
    if (ts < t.first) t.first = ts;
    if (ts > t.last) t.last = ts;
    if (e.message.startsWith("Turn ")) t.turns++;
  }

  let timingRows = "";
  const recentIters = [...iterTimestamps.keys()].sort((a, b) => a - b).slice(-10);
  for (const iter of recentIters) {
    const t = iterTimestamps.get(iter)!;
    const durationMs = t.last - t.first;
    const durationStr = durationMs > 60000 ? `${(durationMs / 60000).toFixed(1)}m` : `${(durationMs / 1000).toFixed(0)}s`;
    const avgPerTurn = t.turns > 0 ? `${(durationMs / t.turns / 1000).toFixed(1)}s` : "—";
    timingRows += `<tr><td>${iter}</td><td>${t.turns}</td><td>${durationStr}</td><td>${avgPerTurn}</td></tr>\n`;
  }

  return `
<h2 style="color: #58a6ff; margin-top: 2rem;">📋 Log Analysis</h2>
<h3 style="color: #c9d1d9; margin-top: 1rem; font-size: 1rem;">Recent Errors &amp; Warnings</h3>
<table style="margin-top: 0.5rem;">
<thead><tr><th>Level</th><th>Iter</th><th>Turn</th><th>Time</th><th>Message</th></tr></thead>
<tbody>${issueRows}</tbody>
</table>

<h3 style="color: #c9d1d9; margin-top: 1.5rem; font-size: 1rem;">Tool Usage by Iteration (from logs)</h3>
<table style="margin-top: 0.5rem;">
<thead><tr><th>Iter</th><th>Total</th><th>Breakdown</th></tr></thead>
<tbody>${toolFreqRows}</tbody>
</table>

<h3 style="color: #c9d1d9; margin-top: 1.5rem; font-size: 1rem;">Timing Insights</h3>
<table style="margin-top: 0.5rem;">
<thead><tr><th>Iter</th><th>Turns</th><th>Duration</th><th>Avg/Turn</th></tr></thead>
<tbody>${timingRows}</tbody>
</table>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function generateDashboard(metrics: IterationMetrics[]): Promise<string> {
  // Fetch iteration diffs (async - uses git)
  const iterDiffs: IterationDiffStats[] = [];
  const totalIn = metrics.reduce((s, m) => s + m.inputTokens, 0);
  const totalOut = metrics.reduce((s, m) => s + m.outputTokens, 0);
  const totalDuration = metrics.reduce((s, m) => s + m.durationMs, 0);
  const totalTurns = metrics.reduce((s, m) => s + m.turns, 0);
  const totalCacheCreate = metrics.reduce((s, m) => s + (m.cacheCreationTokens || 0), 0);
  const totalCacheRead = metrics.reduce((s, m) => s + (m.cacheReadTokens || 0), 0);
  const allToolCalls: Record<string, number> = {};
  for (const m of metrics) {
    for (const [tool, count] of Object.entries(m.toolCalls)) {
      allToolCalls[tool] = (allToolCalls[tool] || 0) + count;
    }
  }

  const rows = metrics.map(m => {
    const cacheInfo = (m.cacheCreationTokens || m.cacheReadTokens)
      ? `${formatNumber(m.cacheReadTokens || 0)} read / ${formatNumber(m.cacheCreationTokens || 0)} created`
      : "—";
    return `
      <tr>
        <td>${m.iteration}</td>
        <td>${m.success ? "✅" : "❌"}</td>
        <td>${m.turns}</td>
        <td>${formatDuration(m.durationMs)}</td>
        <td>${formatNumber(m.inputTokens)}</td>
        <td>${formatNumber(m.outputTokens)}</td>
        <td>${formatNumber(m.inputTokens + m.outputTokens)}</td>
        <td>${cacheInfo}</td>
        <td>${totalToolCalls(m.toolCalls)}</td>
        <td>${topTools(m.toolCalls)}</td>
        <td>${new Date(m.startTime).toLocaleTimeString()}</td>
      </tr>`;
  }).join("\n");

  const summaryRow = `
    <tr class="summary">
      <td><strong>Total</strong></td>
      <td>${metrics.filter(m => m.success).length}/${metrics.length}</td>
      <td>${totalTurns}</td>
      <td>${formatDuration(totalDuration)}</td>
      <td>${formatNumber(totalIn)}</td>
      <td>${formatNumber(totalOut)}</td>
      <td>${formatNumber(totalIn + totalOut)}</td>
      <td>${formatNumber(totalCacheRead)} read / ${formatNumber(totalCacheCreate)} created</td>
      <td>${totalToolCalls(allToolCalls)}</td>
      <td>${topTools(allToolCalls)}</td>
      <td>—</td>
    </tr>`;

  const avgRow = metrics.length > 0 ? `
    <tr class="avg">
      <td><strong>Avg</strong></td>
      <td>—</td>
      <td>${(totalTurns / metrics.length).toFixed(1)}</td>
      <td>${formatDuration(totalDuration / metrics.length)}</td>
      <td>${formatNumber(Math.round(totalIn / metrics.length))}</td>
      <td>${formatNumber(Math.round(totalOut / metrics.length))}</td>
      <td>${formatNumber(Math.round((totalIn + totalOut) / metrics.length))}</td>
      <td>—</td>
      <td>${(totalToolCalls(allToolCalls) / metrics.length).toFixed(1)}</td>
      <td>—</td>
      <td>—</td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AutoAgent Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; background: #0d1117; color: #c9d1d9; padding: 2rem; }
  h1 { color: #58a6ff; margin-bottom: 0.5rem; }
  .subtitle { color: #8b949e; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th { background: #161b22; color: #58a6ff; text-align: left; padding: 0.75rem; border-bottom: 2px solid #30363d; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #21262d; font-size: 0.9rem; }
  tr:hover { background: #161b22; }
  .summary td { background: #161b22; font-weight: 600; border-top: 2px solid #30363d; color: #58a6ff; }
  .avg td { background: #1a1f29; color: #8b949e; font-style: italic; }
  .stats { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.5rem; min-width: 140px; }
  .stat-value { font-size: 1.8rem; font-weight: 700; color: #58a6ff; }
  .stat-label { font-size: 0.8rem; color: #8b949e; margin-top: 0.25rem; }
  footer { margin-top: 2rem; color: #484f58; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>🤖 AutoAgent Dashboard</h1>
<p class="subtitle">Generated: ${new Date().toISOString()}</p>

<div class="stats">
  <div class="stat-card"><div class="stat-value">${metrics.length}</div><div class="stat-label">Iterations</div></div>
  <div class="stat-card"><div class="stat-value">${formatNumber(totalIn + totalOut)}</div><div class="stat-label">Total Tokens</div></div>
  <div class="stat-card"><div class="stat-value">${formatDuration(totalDuration)}</div><div class="stat-label">Total Time</div></div>
  <div class="stat-card"><div class="stat-value">${totalTurns}</div><div class="stat-label">Total Turns</div></div>
  <div class="stat-card"><div class="stat-value">${formatNumber(totalCacheRead)}</div><div class="stat-label">Cache Read Tokens</div></div>
</div>

<table>
<thead>
  <tr>
    <th>Iter</th><th>Status</th><th>Turns</th><th>Duration</th>
    <th>Input Tok</th><th>Output Tok</th><th>Total Tok</th>
    <th>Cache</th><th>Tool Calls</th><th>Top Tools</th><th>Started</th>
  </tr>
</thead>
<tbody>
${rows}
${summaryRow}
${avgRow}
</tbody>
</table>

${generateTurnPredictionChart(metrics)}

${generateTokenCostChart(metrics)}

${generateCodeQualitySection()}

${generateCodeQualityTrend(metrics)}

${generateBenchmarkTrend(metrics)}

${generateCodeChangesSection(iterDiffs)}

${generateToolPerformanceSection(metrics)}

${generateLogAnalysisSection(path.join(ROOT, "agentlog.jsonl"))}

<footer>AutoAgent — Self-improving autonomous agent</footer>
</body>
</html>`;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("dashboard.ts")) {
  if (!existsSync(METRICS_FILE)) {
    console.log("No metrics file found. Skipping dashboard generation.");
    process.exit(0);
  }

  try {
    const metrics: IterationMetrics[] = JSON.parse(readFileSync(METRICS_FILE, "utf-8"));
    const html = await generateDashboard(metrics);
    writeFileSync(OUTPUT_FILE, html, "utf-8");
    console.log(`Dashboard generated: ${OUTPUT_FILE} (${metrics.length} iterations)`);
  } catch (err) {
    console.error("Dashboard generation failed:", err);
    process.exit(1);
  }
}
