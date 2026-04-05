import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectProject } from "../project-detector.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("project-detector", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "proj-detect-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects Node.js project from package.json", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "my-node-app",
      dependencies: { express: "^4.0.0" },
    }));
    const result = detectProject(tmpDir);
    expect(result.type).toBe("node");
    expect(result.name).toBe("my-node-app");
    expect(result.language).toBe("JavaScript");
  });

  it("detects Python project from pyproject.toml", () => {
    fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), `
[project]
name = "my-python-pkg"
dependencies = ["fastapi"]
`);
    const result = detectProject(tmpDir);
    expect(result.type).toBe("python");
    expect(result.name).toBe("my-python-pkg");
    expect(result.language).toBe("Python");
  });

  it("detects Rust project from Cargo.toml", () => {
    fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), `
[package]
name = "my-rust-crate"
version = "0.1.0"
`);
    const result = detectProject(tmpDir);
    expect(result.type).toBe("rust");
    expect(result.name).toBe("my-rust-crate");
    expect(result.language).toBe("Rust");
    expect(result.testRunner).toBe("cargo test");
  });

  it("detects framework from deps (next → framework: next)", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "nextjs-app",
      dependencies: { next: "^14.0.0", react: "^18.0.0" },
    }));
    const result = detectProject(tmpDir);
    expect(result.framework).toBe("next");
  });

  it("returns unknown for empty directory", () => {
    const result = detectProject(tmpDir);
    expect(result.type).toBe("unknown");
    expect(result.language).toBe("Unknown");
  });

  it("produces a non-empty human-readable summary", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
      name: "test-proj",
      devDependencies: { vitest: "^1.0.0", typescript: "^5.0.0" },
    }));
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
    const result = detectProject(tmpDir);
    expect(result.summary).toBeTruthy();
    expect(result.summary.length).toBeGreaterThan(10);
    expect(result.summary).toContain("TypeScript");
    expect(result.testRunner).toBe("vitest");
  });

  it("detects TypeScript when tsconfig.json exists", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "ts-proj" }));
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
    const result = detectProject(tmpDir);
    expect(result.language).toBe("TypeScript");
  });

  it("detects mixed project when multiple config files exist", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "polyglot" }));
    fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), '[project]\nname = "pypart"');
    const result = detectProject(tmpDir);
    expect(result.type).toBe("mixed");
  });

  it("detects monorepo when package.json has workspaces field", () => {
    const pkg = { name: "my-monorepo", workspaces: ["packages/app", "packages/lib", "packages/utils"] };
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));
    const result = detectProject(tmpDir);
    expect(result.type).toBe("monorepo");
    expect(result.workspaces).toBeDefined();
    expect(result.workspaces).toContain("packages/app");
    expect(result.summary).toContain("monorepo");
    expect(result.summary).toContain("packages/app");
  });

  it("detects entry points when src/index.ts exists", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "my-app" }));
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, "index.ts"), "export {}");
    const result = detectProject(tmpDir);
    expect(result.entryPoints).toBeDefined();
    expect(result.entryPoints).toContain("src/index.ts");
    expect(result.summary).toContain("src/index.ts");
  });
});
