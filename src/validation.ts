/**
 * Validation module — pre-commit checks extracted from agent.ts.
 *
 * Contains validateBeforeCommit() and captureCodeQuality() for independent
 * testing and reuse.
 */

import { existsSync } from "fs";
import path from "path";
import { executeBash } from "./tools/bash.js";
import { analyzeCodebase } from "./code-analysis.js";

// ─── Types ──────────────────────────────────────────────────

export interface CodeQualitySnapshot {
  totalLOC: number;
  codeLOC: number;
  fileCount: number;
  functionCount: number;
  complexity: number;
  testCount: number;
}

export interface ValidationResult {
  ok: boolean;
  output: string;
}

// ─── Options ────────────────────────────────────────────────

export interface ValidationOptions {
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
 */
export async function captureCodeQuality(
  rootDir: string,
): Promise<CodeQualitySnapshot | undefined> {
  try {
    const analysis = analyzeCodebase();
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
