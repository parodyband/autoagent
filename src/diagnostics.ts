/**
 * Post-edit diagnostics — run tsc/lint after edits to catch errors early.
 * If errors are found, they can be injected back into the agent loop for self-correction.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** Maximum chars of diagnostic output to return (prevents context bloat). */
const MAX_OUTPUT_CHARS = 2000;

/**
 * Detect which diagnostic command to run for a project.
 * Returns null if no suitable checker is found.
 */
export function detectDiagnosticCommand(workDir: string): string | null {
  // Check for tsconfig.json → tsc
  if (fs.existsSync(path.join(workDir, "tsconfig.json"))) {
    // Prefer project-local tsc, fall back to global
    const localTsc = path.join(workDir, "node_modules", ".bin", "tsc");
    if (fs.existsSync(localTsc)) {
      return `${localTsc} --noEmit 2>&1`;
    }
    // Try resolving tsc from this process's node_modules (for testing)
    try {
      const tscPath = execSync("which tsc", { encoding: "utf-8", timeout: 3000 }).trim();
      if (tscPath) return `${tscPath} --noEmit 2>&1`;
    } catch { /* fall through */ }
    return "npx tsc --noEmit 2>&1";
  }

  // Check for pyproject.toml or setup.py → could add mypy/ruff later
  // For now, only TypeScript is supported
  return null;
}

/**
 * Run project diagnostics (e.g. `tsc --noEmit`) in the given directory.
 *
 * @returns null if clean (no errors), or a string with error output if failures found.
 *          Output is truncated to MAX_OUTPUT_CHARS.
 */
export async function runDiagnostics(
  workDir: string,
  timeoutMs: number = 15_000,
): Promise<string | null> {
  const cmd = detectDiagnosticCommand(workDir);
  if (!cmd) return null;

  try {
    execSync(cmd, {
      cwd: workDir,
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Exit code 0 → clean
    return null;
  } catch (err: unknown) {
    // execSync throws on non-zero exit
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    const output = (execErr.stdout ?? "") + (execErr.stderr ?? "");

    if (!output.trim()) {
      // Non-zero exit but no output (e.g., timeout killed) — skip
      return null;
    }

    // Truncate if too long
    if (output.length > MAX_OUTPUT_CHARS) {
      return output.slice(0, MAX_OUTPUT_CHARS) + `\n… (truncated, ${output.length} chars total)`;
    }

    return output.trim();
  }
}
