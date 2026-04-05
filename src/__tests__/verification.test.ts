import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractCommands, runVerification, formatVerificationResults } from "../verification.js";
import type { VerificationResult } from "../verification.js";

// ─── extractCommands ──────────────────────────────────────────

describe("extractCommands", () => {
  it("returns empty array for empty fingerprint", () => {
    expect(extractCommands("")).toEqual([]);
  });

  it("extracts npm test for Node.js with test commands", () => {
    const fp = `## Repo Context\n**Project type**: Node.js\n**Language**: JavaScript\n**Test**: npm run test (jest)`;
    const cmds = extractCommands(fp);
    expect(cmds).toContain("npm test");
  });

  it("extracts npm test and npx tsc --noEmit for TypeScript Node project", () => {
    const fp = `## Repo Context\n**Project type**: Node.js\n**Language**: TypeScript\n**Build**: npm run build (tsc)\n**Test**: npm run test (vitest)`;
    const cmds = extractCommands(fp);
    expect(cmds).toContain("npm test");
    expect(cmds).toContain("npx tsc --noEmit");
  });

  it("only includes tsc when there's a build command (TypeScript)", () => {
    const fp = `## Repo Context\n**Project type**: Node.js\n**Language**: TypeScript\n**Test**: npm run test (vitest)`;
    const cmds = extractCommands(fp);
    expect(cmds).toContain("npm test");
    expect(cmds).not.toContain("npx tsc --noEmit");
  });

  it("extracts cargo test for Rust", () => {
    const fp = `## Repo Context\n**Project type**: Rust\n**Language**: Rust\n**Test**: cargo test`;
    const cmds = extractCommands(fp);
    expect(cmds).toContain("cargo test");
  });

  it("extracts pytest for Python with test", () => {
    const fp = `## Repo Context\n**Project type**: Python\n**Language**: Python\n**Test**: pytest`;
    const cmds = extractCommands(fp);
    expect(cmds).toContain("pytest");
  });

  it("extracts go test for Go", () => {
    const fp = `## Repo Context\n**Project type**: Go\n**Language**: Go\n**Test**: go test ./...`;
    const cmds = extractCommands(fp);
    expect(cmds).toContain("go test ./...");
  });

  it("returns at most 3 commands", () => {
    const fp = `## Repo Context\n**Project type**: Node.js\n**Language**: TypeScript\n**Build**: npm run build (tsc)\n**Test**: npm run test (vitest)`;
    const cmds = extractCommands(fp);
    expect(cmds.length).toBeLessThanOrEqual(3);
  });

  it("deduplicates commands", () => {
    const fp = `## Repo Context\n**Project type**: Node.js\n**Language**: TypeScript\n**Build**: npm run build (tsc)\n**Test**: npm run test (vitest)`;
    const cmds = extractCommands(fp);
    const unique = [...new Set(cmds)];
    expect(cmds).toEqual(unique);
  });
});

// ─── runVerification ──────────────────────────────────────────

describe("runVerification", () => {
  it("returns empty array when workDir equals ROOT (process.cwd())", async () => {
    const fp = `## Repo Context\n**Project type**: Node.js\n**Language**: TypeScript\n**Test**: npm run test`;
    const results = await runVerification(process.cwd(), fp);
    expect(results).toEqual([]);
  });

  it("returns empty array when fingerprint has no recognizable commands", async () => {
    const fp = `## Repo Context\n**Project type**: Unknown\n**Language**: Unknown`;
    // Use a non-ROOT dir that exists
    const results = await runVerification("/tmp", fp);
    expect(results).toEqual([]);
  });

  it("returns results array when commands are found", async () => {
    // Use /tmp with a Python fingerprint — pytest will likely fail but we get a result
    const fp = `## Repo Context\n**Project type**: Python\n**Language**: Python\n**Test**: pytest`;
    const results = await runVerification("/tmp", fp);
    // Either runs or returns results (pytest may not exist)
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("passed");
      expect(results[0]).toHaveProperty("command");
      expect(results[0]).toHaveProperty("output");
    }
  });
});

// ─── formatVerificationResults ───────────────────────────────

describe("formatVerificationResults", () => {
  it("returns empty string for empty results", () => {
    expect(formatVerificationResults([])).toBe("");
  });

  it("shows PASSED for successful commands", () => {
    const results: VerificationResult[] = [
      { passed: true, command: "npm test", output: "All tests passed" },
    ];
    const formatted = formatVerificationResults(results);
    expect(formatted).toContain("✅ PASSED");
    expect(formatted).toContain("npm test");
  });

  it("shows FAILED and output for failed commands", () => {
    const results: VerificationResult[] = [
      { passed: false, command: "npm test", output: "Error: 3 tests failed" },
    ];
    const formatted = formatVerificationResults(results);
    expect(formatted).toContain("❌ FAILED");
    expect(formatted).toContain("3 tests failed");
  });

  it("shows warning when any check fails", () => {
    const results: VerificationResult[] = [
      { passed: true, command: "npm test", output: "ok" },
      { passed: false, command: "npx tsc --noEmit", output: "type error" },
    ];
    const formatted = formatVerificationResults(results);
    expect(formatted).toContain("⚠️");
    expect(formatted).toContain("1 verification check(s) failed");
  });

  it("does not show warning when all checks pass", () => {
    const results: VerificationResult[] = [
      { passed: true, command: "npm test", output: "ok" },
    ];
    const formatted = formatVerificationResults(results);
    expect(formatted).not.toContain("⚠️");
  });
});
