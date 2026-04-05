/**
 * Code analysis for AutoAgent.
 *
 * Analyzes TypeScript codebase for:
 * - Lines of code per file
 * - Function count per file
 * - Cyclomatic complexity estimate per file
 * - Overall summary
 */

import { readFileSync, readdirSync } from "fs";
import path from "path";

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
    [/\?[^?.:]/g, "ternary"],
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
  const dir = srcDir || path.join(process.cwd(), "src");
  const files = findTsFiles(dir);
  const rootDir = process.cwd();
  const analyses = files.map(f => analyzeFile(f, rootDir));

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
