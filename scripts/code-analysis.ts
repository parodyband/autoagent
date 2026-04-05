/**
 * Code analysis for AutoAgent.
 *
 * Analyzes src/ codebase for:
 * - Lines of code per file
 * - Function count per file
 * - Cyclomatic complexity estimate per file
 * - Overall summary
 *
 * Run: npx tsx scripts/code-analysis.ts
 * Also exports analyzeCodebase() for use in dashboard.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const ROOT = process.cwd();

export interface FileAnalysis {
  file: string;           // relative path
  totalLines: number;
  codeLines: number;      // non-blank, non-comment lines
  blankLines: number;
  commentLines: number;
  functionCount: number;
  complexity: number;     // cyclomatic complexity estimate
}

export interface CodebaseAnalysis {
  files: FileAnalysis[];
  totals: {
    totalLines: number;
    codeLines: number;
    blankLines: number;
    commentLines: number;
    functionCount: number;
    complexity: number;
    fileCount: number;
  };
  averageComplexityPerFunction: number;
}

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      results.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

function analyzeFile(filePath: string, rootDir: string): FileAnalysis {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const relativePath = path.relative(rootDir, filePath);

  let blankLines = 0;
  let commentLines = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (inBlockComment) {
      commentLines++;
      if (trimmed.includes("*/")) inBlockComment = false;
      continue;
    }

    if (trimmed === "") {
      blankLines++;
    } else if (trimmed.startsWith("//")) {
      commentLines++;
    } else if (trimmed.startsWith("/*")) {
      commentLines++;
      if (!trimmed.includes("*/")) inBlockComment = true;
    }
  }

  const codeLines = lines.length - blankLines - commentLines;

  // Count functions: function declarations, arrow functions assigned to const/let/var, methods
  const functionPatterns = [
    /\bfunction\s+\w+/g,                          // function declarations
    /\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/g,  // arrow function assignments
    /\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function/g, // function expression assignments
    /^\s+(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{/gm, // class methods
  ];

  let functionCount = 0;
  for (const pattern of functionPatterns) {
    const matches = content.match(pattern);
    if (matches) functionCount += matches.length;
  }

  // Cyclomatic complexity: count decision points
  // Each adds 1 to base complexity of 1
  const complexityPatterns: [RegExp, string][] = [
    [/\bif\s*\(/g, "if"],
    [/\belse\s+if\s*\(/g, "else if"],
    [/\bfor\s*\(/g, "for"],
    [/\bwhile\s*\(/g, "while"],
    [/\bswitch\s*\(/g, "switch"],
    [/\bcase\s+/g, "case"],
    [/\bcatch\s*\(/g, "catch"],
    [/\?\?/g, "??"],
    [/\?\./g, "?."],
    [/&&/g, "&&"],
    [/\|\|/g, "||"],
    [/\?[^?.:]/g, "ternary"],  // ternary operator (avoid matching ?. and ??)
  ];

  let complexity = 1; // base complexity
  for (const [pattern] of complexityPatterns) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }

  return {
    file: relativePath,
    totalLines: lines.length,
    codeLines,
    blankLines,
    commentLines,
    functionCount,
    complexity,
  };
}

export function analyzeCodebase(srcDir?: string): CodebaseAnalysis {
  const dir = srcDir || path.join(ROOT, "src");
  const files = findTsFiles(dir);
  const analyses = files.map(f => analyzeFile(f, ROOT));

  // Sort by complexity descending
  analyses.sort((a, b) => b.complexity - a.complexity);

  const totals = {
    totalLines: analyses.reduce((s, a) => s + a.totalLines, 0),
    codeLines: analyses.reduce((s, a) => s + a.codeLines, 0),
    blankLines: analyses.reduce((s, a) => s + a.blankLines, 0),
    commentLines: analyses.reduce((s, a) => s + a.commentLines, 0),
    functionCount: analyses.reduce((s, a) => s + a.functionCount, 0),
    complexity: analyses.reduce((s, a) => s + a.complexity, 0),
    fileCount: analyses.length,
  };

  const averageComplexityPerFunction = totals.functionCount > 0
    ? Math.round((totals.complexity / totals.functionCount) * 10) / 10
    : 0;

  return { files: analyses, totals, averageComplexityPerFunction };
}

export function formatReport(analysis: CodebaseAnalysis): string {
  const lines: string[] = [];
  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║                  AutoAgent Code Analysis                     ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push("");

  // Per-file table
  const header = "File".padEnd(30) + "Lines".padStart(7) + "Code".padStart(7) + 
    "Blank".padStart(7) + "Cmnt".padStart(7) + "Funcs".padStart(7) + "Cmplx".padStart(7);
  lines.push(header);
  lines.push("─".repeat(72));

  for (const f of analysis.files) {
    const name = f.file.length > 28 ? "…" + f.file.slice(-27) : f.file;
    lines.push(
      name.padEnd(30) +
      String(f.totalLines).padStart(7) +
      String(f.codeLines).padStart(7) +
      String(f.blankLines).padStart(7) +
      String(f.commentLines).padStart(7) +
      String(f.functionCount).padStart(7) +
      String(f.complexity).padStart(7)
    );
  }

  lines.push("─".repeat(72));
  lines.push(
    "TOTAL".padEnd(30) +
    String(analysis.totals.totalLines).padStart(7) +
    String(analysis.totals.codeLines).padStart(7) +
    String(analysis.totals.blankLines).padStart(7) +
    String(analysis.totals.commentLines).padStart(7) +
    String(analysis.totals.functionCount).padStart(7) +
    String(analysis.totals.complexity).padStart(7)
  );

  lines.push("");
  lines.push("Summary:");
  lines.push(`  Files:      ${analysis.totals.fileCount}`);
  lines.push(`  Total LOC:  ${analysis.totals.totalLines}`);
  lines.push(`  Code LOC:   ${analysis.totals.codeLines} (${Math.round(analysis.totals.codeLines / analysis.totals.totalLines * 100)}%)`);
  lines.push(`  Comments:   ${analysis.totals.commentLines} (${Math.round(analysis.totals.commentLines / analysis.totals.totalLines * 100)}%)`);
  lines.push(`  Functions:  ${analysis.totals.functionCount}`);
  lines.push(`  Complexity: ${analysis.totals.complexity} total, ${analysis.averageComplexityPerFunction} avg/function`);

  // Hotspots
  const hotspots = analysis.files.filter(f => f.complexity > 20).slice(0, 5);
  if (hotspots.length > 0) {
    lines.push("");
    lines.push("⚠️  Complexity Hotspots (>20):");
    for (const h of hotspots) {
      lines.push(`  ${h.file}: complexity=${h.complexity}, ${h.functionCount} functions`);
    }
  }

  return lines.join("\n");
}

// CLI entrypoint
if (process.argv[1]?.endsWith("code-analysis.ts")) {
  const analysis = analyzeCodebase();
  console.log(formatReport(analysis));
}
