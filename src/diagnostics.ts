/**
 * Post-edit diagnostics — run tsc/eslint/pyright/ruff after edits to catch errors early.
 * If errors are found, they can be injected back into the agent loop for self-correction.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/** Maximum chars of diagnostic output to return (prevents context bloat). */
const MAX_OUTPUT_CHARS = 2000;

/** A diagnostic tool with its command and priority (lower = higher priority). */
export interface DiagnosticTool {
  name: string;
  cmd: string;
  priority: number; // 1 = tsc, 2 = eslint errors, 3 = eslint warnings, 4 = other
}

/**
 * Detect which diagnostic tools are available for a project.
 * Returns list ordered by priority (highest priority first).
 */
export function detectDiagnosticTools(workDir: string): DiagnosticTool[] {
  const tools: DiagnosticTool[] = [];

  // TypeScript: tsc --noEmit (priority 1)
  if (fs.existsSync(path.join(workDir, "tsconfig.json"))) {
    const localTsc = path.join(workDir, "node_modules", ".bin", "tsc");
    if (fs.existsSync(localTsc)) {
      tools.push({ name: "tsc", cmd: `${localTsc} --noEmit 2>&1`, priority: 1 });
    } else {
      try {
        const tscPath = execSync("which tsc", { encoding: "utf-8", timeout: 3000 }).trim();
        if (tscPath) tools.push({ name: "tsc", cmd: `${tscPath} --noEmit 2>&1`, priority: 1 });
      } catch { /* fall through */ }
      if (!tools.find(t => t.name === "tsc")) {
        tools.push({ name: "tsc", cmd: "npx tsc --noEmit 2>&1", priority: 1 });
      }
    }
  }

  // Pyright (priority 1 — for Python/TS hybrid projects)
  const localPyright = path.join(workDir, "node_modules", ".bin", "pyright");
  if (fs.existsSync(localPyright)) {
    tools.push({ name: "pyright", cmd: `${localPyright} 2>&1`, priority: 1 });
  }

  // ESLint (priority 2)
  const eslintConfig = [
    ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json",
    ".eslintrc.yaml", ".eslintrc.yml", "eslint.config.js", "eslint.config.mjs",
  ].some(f => fs.existsSync(path.join(workDir, f)));

  if (eslintConfig) {
    const localEslint = path.join(workDir, "node_modules", ".bin", "eslint");
    if (fs.existsSync(localEslint)) {
      tools.push({ name: "eslint", cmd: `${localEslint} --max-warnings=0 . 2>&1`, priority: 2 });
    }
  }

  // Ruff (Python linter, priority 2)
  const hasPython = fs.existsSync(path.join(workDir, "pyproject.toml")) ||
    fs.existsSync(path.join(workDir, "setup.py")) ||
    fs.existsSync(path.join(workDir, "ruff.toml"));
  if (hasPython) {
    try {
      execSync("which ruff", { encoding: "utf-8", timeout: 3000 });
      tools.push({ name: "ruff", cmd: "ruff check . 2>&1", priority: 2 });
    } catch { /* ruff not installed */ }
  }

  return tools.sort((a, b) => a.priority - b.priority);
}

/**
 * Detect which diagnostic command to run for a project.
 * Returns null if no suitable checker is found.
 * @deprecated Use detectDiagnosticTools() for multi-tool support.
 */
export function detectDiagnosticCommand(workDir: string): string | null {
  const tools = detectDiagnosticTools(workDir);
  return tools.length > 0 ? tools[0].cmd : null;
}

/**
 * Run project diagnostics in the given directory.
 * Runs all detected tools (tsc, eslint, pyright, ruff) in priority order.
 * Stops after first tool that reports errors (higher priority errors take precedence).
 *
 * @returns null if clean (no errors), or a string with error output if failures found.
 *          Output is truncated to MAX_OUTPUT_CHARS.
 */
export async function runDiagnostics(
  workDir: string,
  timeoutMs: number = 15_000,
): Promise<string | null> {
  const tools = detectDiagnosticTools(workDir);
  if (tools.length === 0) return null;

  const allErrors: string[] = [];

  for (const tool of tools) {
    try {
      execSync(tool.cmd, {
        cwd: workDir,
        encoding: "utf-8",
        timeout: timeoutMs,
        stdio: ["ignore", "pipe", "pipe"],
      });
      // Exit code 0 → this tool is clean, continue to next
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; status?: number };
      const output = (execErr.stdout ?? "") + (execErr.stderr ?? "");

      if (!output.trim()) continue; // Non-zero exit but no output — skip

      // Higher priority tool has errors — report immediately (don't run lower priority)
      const header = `[${tool.name}]\n`;
      allErrors.push(header + output.trim());

      // tsc errors (priority 1) block eslint from running — cascade stops here
      if (tool.priority === 1) break;
    }
  }

  if (allErrors.length === 0) return null;

  const combined = allErrors.join("\n\n");
  if (combined.length > MAX_OUTPUT_CHARS) {
    return combined.slice(0, MAX_OUTPUT_CHARS) + `\n… (truncated, ${combined.length} chars total)`;
  }
  return combined;
}
