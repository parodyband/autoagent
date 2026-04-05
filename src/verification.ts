/**
 * Pre-finalization verification — runs test/build commands in the target repo
 * before the agent finalizes. Advisory only: never blocks finalization.
 *
 * Only runs when workDir !== ROOT (never verifies autoagent's own repo).
 */

import { execSync } from "child_process";
import path from "path";

const ROOT = process.cwd();

// ─── Types ────────────────────────────────────────────────────

export interface VerificationResult {
  passed: boolean;
  command: string;
  output: string;
}

// ─── Command extraction ───────────────────────────────────────

// Priority-ordered list of commands we're willing to run
const PRIORITY_COMMANDS = [
  "npm test",
  "npx tsc --noEmit",
  "cargo test",
  "pytest",
  "go test ./...",
];

/**
 * Parse a repo fingerprint string and extract runnable verification commands.
 * Returns up to 3 commands from the priority list that are relevant to the repo.
 */
export function extractCommands(fingerprint: string): string[] {
  if (!fingerprint) return [];

  const found: string[] = [];

  // Check language/type lines to understand what kind of project this is
  const isNode = /\*\*Project type\*\*: Node\.js/.test(fingerprint);
  const isTypeScript = /\*\*Language\*\*: TypeScript/.test(fingerprint);
  const isRust = /\*\*Project type\*\*: Rust/.test(fingerprint);
  const isPython = /\*\*Project type\*\*: Python/.test(fingerprint);
  const isGo = /\*\*Project type\*\*: Go/.test(fingerprint);

  // Check what commands the fingerprint mentions
  const hasTest = /\*\*Test\*\*:/.test(fingerprint);
  const hasBuild = /\*\*Build\*\*:/.test(fingerprint);

  if (isNode) {
    if (hasTest) found.push("npm test");
    if (isTypeScript && hasBuild) found.push("npx tsc --noEmit");
  } else if (isTypeScript) {
    if (hasTest) found.push("npm test");
    found.push("npx tsc --noEmit");
  } else if (isRust) {
    found.push("cargo test");
  } else if (isPython) {
    if (hasTest) found.push("pytest");
  } else if (isGo) {
    if (hasTest) found.push("go test ./...");
  }

  // Filter to only priority-listed commands (safety) and deduplicate
  const filtered = found.filter(cmd => PRIORITY_COMMANDS.includes(cmd));
  return [...new Set(filtered)].slice(0, 3);
}

// ─── Runner ───────────────────────────────────────────────────

function runCommand(command: string, workDir: string): VerificationResult {
  try {
    const output = execSync(command, {
      cwd: workDir,
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      passed: true,
      command,
      output: output.trim().slice(0, 2000),
    };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    const out = [execErr.stdout || "", execErr.stderr || "", execErr.message || ""]
      .join("\n")
      .trim()
      .slice(0, 2000);
    return {
      passed: false,
      command,
      output: out,
    };
  }
}

// ─── Main entry point ─────────────────────────────────────────

/**
 * Run verification commands for an external repo.
 * Returns empty array if workDir === ROOT or no commands found.
 */
export async function runVerification(
  workDir: string,
  repoFingerprint: string
): Promise<VerificationResult[]> {
  // Never verify autoagent's own repo
  if (workDir === ROOT) return [];

  const commands = extractCommands(repoFingerprint);
  if (commands.length === 0) return [];

  const results: VerificationResult[] = [];
  for (const cmd of commands) {
    results.push(runCommand(cmd, workDir));
  }
  return results;
}

// ─── Formatting ───────────────────────────────────────────────

/**
 * Format verification results for injection into the conversation.
 */
export function formatVerificationResults(results: VerificationResult[]): string {
  if (results.length === 0) return "";

  const lines = ["## Pre-finalization Verification", ""];
  for (const r of results) {
    const status = r.passed ? "✅ PASSED" : "❌ FAILED";
    lines.push(`**${r.command}**: ${status}`);
    if (!r.passed && r.output) {
      lines.push("```");
      lines.push(r.output.slice(0, 500));
      lines.push("```");
    }
  }

  const allPassed = results.every(r => r.passed);
  const failed = results.filter(r => !r.passed);
  if (!allPassed) {
    lines.push("");
    lines.push(
      `⚠️  ${failed.length} verification check(s) failed. Review the output above and fix if possible before finalizing.`
    );
  }

  return lines.join("\n");
}
