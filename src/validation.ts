/**
 * Validation module — pre-commit checks extracted from agent.ts.
 *
 * Contains validateBeforeCommit() and captureCodeQuality() for independent
 * testing and reuse. Also contains codebase analysis (inlined from code-analysis.ts).
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { executeBash } from "./tools/bash.js";

// ─── Code Analysis Types ─────────────────────────────────────

interface FileAnalysis {
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

// ─── Code Analysis Helpers ───────────────────────────────────

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
    /\bfunction\s+\w+/g,
    /\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(/g,
    /\b(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function/g,
    /^\s+(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{/gm,
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

function analyzeCodebase(srcDir?: string): CodebaseAnalysis {
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

// ─── Types ──────────────────────────────────────────────────

export interface CodeQualitySnapshot {
  totalLOC: number;
  codeLOC: number;
  fileCount: number;
  functionCount: number;
  complexity: number;
  testCount: number;
}

export interface BenchmarkSnapshot {
  testDurationMs: number;
  testCount: number;
}

export interface ValidationResult {
  ok: boolean;
  output: string;
}

// ─── Options ────────────────────────────────────────────────

interface ValidationOptions {
  /** Skip running pre-commit-check.sh (useful to avoid recursion in self-tests). */
  skipPreCommitScript?: boolean;
}

// ─── Validation ─────────────────────────────────────────────

/**
 * Run pre-commit validation: TypeScript compilation + pre-commit-check.sh.
 * Returns { ok: true } if everything passes, { ok: false, output } otherwise.
 */
export async function validateBeforeCommit(
  rootDir: string,
  logFn?: (msg: string) => void,
  options?: ValidationOptions,
): Promise<ValidationResult> {
  const log = logFn ?? (() => {});

  log("Validating: npx tsc --noEmit ...");
  const tsc = await executeBash("npx tsc --noEmit 2>&1", 60, rootDir);
  if (tsc.exitCode !== 0) {
    log(`COMPILE FAILED:\n${tsc.output}`);
    return { ok: false, output: tsc.output };
  }
  log("Compilation OK");

  if (!options?.skipPreCommitScript) {
    const checkScript = path.join(rootDir, "scripts/pre-commit-check.sh");
    if (existsSync(checkScript)) {
      const pc = await executeBash(`bash "${checkScript}"`, 60, rootDir);
      if (pc.exitCode !== 0) {
        return { ok: false, output: `pre-commit-check failed:\n${pc.output}` };
      }
    }
  }
  return { ok: true, output: "ok" };
}

// ─── Code Quality ───────────────────────────────────────────

/**
 * Capture a code quality snapshot: LOC, functions, complexity, test count.
 * Returns undefined on any error (non-critical).
 * @param analyzeFn - optional override for analyzeCodebase (for testing via DI)
 */
export async function captureCodeQuality(
  rootDir: string,
  analyzeFn: () => CodebaseAnalysis = analyzeCodebase,
): Promise<CodeQualitySnapshot | undefined> {
  try {
    const analysis = analyzeFn();
    const totals = analysis.totals;
    // Count tests
    const testR = await executeBash(
      `grep -c "^  assert(" scripts/self-test.ts || echo 0`,
      10,
      rootDir,
    );
    const testCount = parseInt(testR.output.trim(), 10) || 0;
    return {
      totalLOC: totals.totalLines,
      codeLOC: totals.codeLines,
      fileCount: totals.fileCount,
      functionCount: totals.functionCount,
      complexity: totals.complexity,
      testCount,
    };
  } catch {
    return undefined;
  }
}

// ─── Benchmarks ─────────────────────────────────────────────

/**
 * Run self-test suite with timing. Returns duration and test count.
 * Returns undefined on any error (non-critical).
 */
export async function captureBenchmarks(
  rootDir: string,
): Promise<BenchmarkSnapshot | undefined> {
  try {
    const start = Date.now();
    const result = await executeBash(
      `npx tsx scripts/self-test.ts 2>&1`,
      120,
      rootDir,
    );
    const durationMs = Date.now() - start;

    if (result.exitCode !== 0) return undefined;

    // Parse test count from output: "Results: X passed, Y failed"
    const match = result.output.match(/Results:\s+(\d+)\s+passed/);
    const testCount = match ? parseInt(match[1], 10) : 0;

    return { testDurationMs: durationMs, testCount };
  } catch {
    return undefined;
  }
}
