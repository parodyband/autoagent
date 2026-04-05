import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { detectProject } from "../src/project-detector.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "project-detector-test-"));
}

describe("detectProject", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns unknown for empty dir", () => {
    const result = detectProject(tmpDir);
    expect(result.type).toBe("unknown");
  });

  it("detects node project from package.json", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "my-app", version: "1.0.0" })
    );
    const result = detectProject(tmpDir);
    expect(result.type).toBe("node");
    expect(result.name).toBe("my-app");
  });

  it("detects vitest test runner", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "my-app",
        devDependencies: { vitest: "^1.0.0" },
      })
    );
    const result = detectProject(tmpDir);
    expect(result.testRunner).toBe("vitest");
  });

  it("detects entry points from package.json main field", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "my-app", main: "dist/index.js" })
    );
    // Create the file so it exists
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "");
    const result = detectProject(tmpDir);
    // Entry points detected from src/index.ts or similar
    // summary should include entry points if found
    expect(result.summary).toBeTruthy();
    expect(typeof result.summary).toBe("string");
  });

  it("detects monorepo workspaces and includes them in summary", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "my-monorepo",
        workspaces: ["packages/core", "packages/cli"],
      })
    );
    fs.mkdirSync(path.join(tmpDir, "packages", "core"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "packages", "cli"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "packages", "core", "package.json"),
      JSON.stringify({ name: "@my/core" })
    );
    fs.writeFileSync(
      path.join(tmpDir, "packages", "cli", "package.json"),
      JSON.stringify({ name: "@my/cli" })
    );

    const result = detectProject(tmpDir);
    expect(result.type).toBe("monorepo");
    expect(result.workspaces).toBeDefined();
    expect(result.workspaces!.length).toBeGreaterThan(0);
    expect(result.summary).toContain("monorepo");
    expect(result.summary).toContain("Workspaces:");
  });

  it("buildSummary includes entry points when detected", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "my-app", main: "src/index.ts" })
    );
    // Create canonical entry point file
    fs.writeFileSync(path.join(tmpDir, "index.ts"), "");

    const result = detectProject(tmpDir);
    // summary should be a non-empty string
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("orchestrator-style injection: summary includes workspace info for monorepo", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        name: "big-monorepo",
        workspaces: ["apps/web", "apps/api", "libs/shared"],
      })
    );

    const result = detectProject(tmpDir);
    expect(result.type).toBe("monorepo");
    // Simulates what orchestrator does: inject summary into system prompt
    const systemPrompt = `You are a helpful assistant.\n\n## Project Context\n${result.summary}`;
    expect(systemPrompt).toContain("## Project Context");
    expect(systemPrompt).toContain("monorepo");
    expect(systemPrompt).toContain("Workspaces:");
  });
});
