import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runDiagnostics, detectDiagnosticCommand } from "../diagnostics.js";

// ─── Helpers ───────────────────────────────────────────────────

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "autoagent-diag-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── detectDiagnosticCommand ────────────────────────────────────

describe("detectDiagnosticCommand", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = mkTmpDir(); });
  afterEach(() => cleanup(tmpDir));

  it("returns tsc command when tsconfig.json exists", () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
    const cmd = detectDiagnosticCommand(tmpDir);
    expect(cmd).not.toBeNull();
    expect(cmd).toContain("tsc --noEmit");
  });

  it("returns null when no known config files exist", () => {
    expect(detectDiagnosticCommand(tmpDir)).toBeNull();
  });
});

// ─── runDiagnostics ─────────────────────────────────────────────

describe("runDiagnostics", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = mkTmpDir(); });
  afterEach(() => cleanup(tmpDir));

  it("returns null when no tsconfig.json (no checker)", async () => {
    const result = await runDiagnostics(tmpDir);
    expect(result).toBeNull();
  });

  it("returns null when tsc passes (clean project)", async () => {
    // Create a minimal valid TS project
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true },
      include: ["*.ts"],
    }));
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "export const x: number = 42;\n");

    const result = await runDiagnostics(tmpDir);
    expect(result).toBeNull();
  });

  it("returns error string when tsc finds errors", async () => {
    // Create a TS project with a type error
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true },
      include: ["*.ts"],
    }));
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "export const x: number = 'not a number';\n");

    const result = await runDiagnostics(tmpDir);
    expect(result).not.toBeNull();
    expect(result).toContain("error TS");
  });

  it("truncates output exceeding 2000 chars", async () => {
    // Create a TS project with many errors
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true },
      include: ["*.ts"],
    }));
    // Generate many type errors to produce long output
    const lines = Array.from({ length: 200 }, (_, i) =>
      `export const v${i}: number = "err${i}";`
    ).join("\n");
    fs.writeFileSync(path.join(tmpDir, "index.ts"), lines);

    const result = await runDiagnostics(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(2100); // 2000 + truncation message
    expect(result).toContain("truncated");
  });
});
