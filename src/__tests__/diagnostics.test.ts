import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runDiagnostics, detectDiagnosticCommand, detectDiagnosticTools } from "../diagnostics.js";

// ─── Helpers ───────────────────────────────────────────────────

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "autoagent-diag-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── detectDiagnosticTools ──────────────────────────────────────

describe("detectDiagnosticTools", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = mkTmpDir(); });
  afterEach(() => cleanup(tmpDir));

  it("returns tsc tool when tsconfig.json exists", () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
    const tools = detectDiagnosticTools(tmpDir);
    expect(tools.some(t => t.name === "tsc")).toBe(true);
  });

  it("returns empty array when no known config files exist", () => {
    const tools = detectDiagnosticTools(tmpDir);
    expect(tools).toHaveLength(0);
  });

  it("tsc tool has priority 1", () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
    const tools = detectDiagnosticTools(tmpDir);
    const tsc = tools.find(t => t.name === "tsc");
    expect(tsc?.priority).toBe(1);
  });

  it("tsc tool cmd contains --noEmit", () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
    const tools = detectDiagnosticTools(tmpDir);
    const tsc = tools.find(t => t.name === "tsc");
    expect(tsc?.cmd).toContain("--noEmit");
  });

  it("detects eslint when local binary and config exist", () => {
    // Create eslint config
    fs.writeFileSync(path.join(tmpDir, ".eslintrc.json"), JSON.stringify({ rules: {} }));
    // Create local eslint binary
    const binDir = path.join(tmpDir, "node_modules", ".bin");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, "eslint"), "#!/bin/sh\necho ok", { mode: 0o755 });

    const tools = detectDiagnosticTools(tmpDir);
    const eslint = tools.find(t => t.name === "eslint");
    expect(eslint).toBeDefined();
    expect(eslint?.priority).toBe(2);
  });

  it("returns tools sorted by priority", () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
    fs.writeFileSync(path.join(tmpDir, ".eslintrc.json"), JSON.stringify({ rules: {} }));
    const binDir = path.join(tmpDir, "node_modules", ".bin");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, "eslint"), "#!/bin/sh\necho ok", { mode: 0o755 });

    const tools = detectDiagnosticTools(tmpDir);
    const priorities = tools.map(t => t.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });
});

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

  it("prefixes output with tool name header", async () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true },
      include: ["*.ts"],
    }));
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "const x: number = 'bad';\n");

    const result = await runDiagnostics(tmpDir);
    expect(result).not.toBeNull();
    expect(result).toContain("[tsc]");
  });

  it("returns null when all tools pass", async () => {
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), JSON.stringify({
      compilerOptions: { noEmit: true },
      include: ["*.ts"],
    }));
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "export const x = 1;\n");

    const result = await runDiagnostics(tmpDir);
    expect(result).toBeNull();
  });
});
