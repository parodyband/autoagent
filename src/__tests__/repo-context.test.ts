import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import path from "path";
import os from "os";
import { fingerprintRepo } from "../repo-context.js";

// ─── Helpers ─────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "repo-context-test-"));
}

// ─── Tests ───────────────────────────────────────────────────

describe("fingerprintRepo", () => {
  it("returns empty string for a non-existent directory", () => {
    const result = fingerprintRepo("/this/path/does/not/exist/abc123");
    expect(result).toBe("");
  });

  it("handles an empty temp directory gracefully", () => {
    const dir = makeTempDir();
    try {
      const result = fingerprintRepo(dir);
      // Should return something (the header at minimum) or empty — no crash
      expect(typeof result).toBe("string");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects Node.js project from package.json", () => {
    const dir = makeTempDir();
    try {
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "test-project",
          scripts: {
            build: "tsc",
            test: "vitest run",
          },
        }),
        "utf-8"
      );
      const result = fingerprintRepo(dir);
      expect(result).toContain("Node.js");
      expect(result).toContain("JavaScript"); // no tsconfig.json → JavaScript
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects TypeScript when tsconfig.json is present", () => {
    const dir = makeTempDir();
    try {
      writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "ts-project", scripts: {} }), "utf-8");
      writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }), "utf-8");
      const result = fingerprintRepo(dir);
      expect(result).toContain("TypeScript");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("extracts build and test commands from package.json scripts", () => {
    const dir = makeTempDir();
    try {
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({
          name: "my-app",
          scripts: {
            build: "tsc --build",
            test: "vitest run",
          },
        }),
        "utf-8"
      );
      const result = fingerprintRepo(dir);
      expect(result).toContain("Build");
      expect(result).toContain("Test");
      expect(result).toContain("vitest");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects Python project from pyproject.toml", () => {
    const dir = makeTempDir();
    try {
      writeFileSync(path.join(dir, "pyproject.toml"), "[build-system]\nrequires = ['setuptools']\n", "utf-8");
      const result = fingerprintRepo(dir);
      expect(result).toContain("Python");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects Rust project from Cargo.toml", () => {
    const dir = makeTempDir();
    try {
      writeFileSync(path.join(dir, "Cargo.toml"), "[package]\nname = \"hello\"\nversion = \"0.1.0\"\n", "utf-8");
      const result = fingerprintRepo(dir);
      expect(result).toContain("Rust");
      expect(result).toContain("cargo");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detects Go project from go.mod", () => {
    const dir = makeTempDir();
    try {
      writeFileSync(path.join(dir, "go.mod"), "module example.com/hello\n\ngo 1.21\n", "utf-8");
      const result = fingerprintRepo(dir);
      expect(result).toContain("Go");
      expect(result).toContain("go build");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists top-level directories", () => {
    const dir = makeTempDir();
    try {
      writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf-8");
      mkdirSync(path.join(dir, "src"));
      mkdirSync(path.join(dir, "tests"));
      mkdirSync(path.join(dir, "docs"));
      const result = fingerprintRepo(dir);
      expect(result).toContain("src");
      expect(result).toContain("tests");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fingerprints the autoagent repo itself (known structure)", () => {
    // Run on the actual autoagent repo — CWD when tests run
    const result = fingerprintRepo(process.cwd());
    expect(result).toContain("TypeScript");
    expect(result).toContain("Node");
    // Should have recent commits
    expect(result).toContain("Recent commits");
  });
});
