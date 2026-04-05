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
import { analyzeCodebase, type CodebaseAnalysis } from "./code-analysis.js";

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
  codeQuality?: CodeQualitySnapshot;
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

export function generateDashboard(metrics: IterationMetrics[]): string {
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

${generateCodeQualitySection()}

${generateCodeQualityTrend(metrics)}

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
    const html = generateDashboard(metrics);
    writeFileSync(OUTPUT_FILE, html, "utf-8");
    console.log(`Dashboard generated: ${OUTPUT_FILE} (${metrics.length} iterations)`);
  } catch (err) {
    console.error("Dashboard generation failed:", err);
    process.exit(1);
  }
}
