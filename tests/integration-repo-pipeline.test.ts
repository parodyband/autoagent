/**
 * Integration test for the external-repo pipeline.
 *
 * Tests the four capability modules (repo-context, file-ranker, task-decomposer,
 * verification) in sequence — the same composition used in agent.ts for --repo mode.
 *
 * No API calls, no Claude mocking — tests only the deterministic parts.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";

import { fingerprintRepo } from "../src/repo-context.js";
import { rankFiles } from "../src/file-ranker.js";
import { shouldDecompose } from "../src/task-decomposer.js";
import { extractCommands } from "../src/verification.js";

// ─── Temp repo setup ──────────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  // Create temp dir
  tmpDir = mkdtempSync(join(tmpdir(), "autoagent-integration-"));

  // Create a realistic Node.js / TypeScript project
  writeFileSync(
    join(tmpDir, "package.json"),
    JSON.stringify(
      {
        name: "test-project",
        version: "1.0.0",
        scripts: {
          build: "tsc",
          test: "vitest run",
          check: "tsc --noEmit",
        },
        dependencies: {},
        devDependencies: { typescript: "^5.0.0", vitest: "^1.0.0" },
      },
      null,
      2
    )
  );

  writeFileSync(
    join(tmpDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          outDir: "dist",
          strict: true,
        },
        include: ["src"],
      },
      null,
      2
    )
  );

  // src/ directory
  mkdirSync(join(tmpDir, "src"), { recursive: true });
  writeFileSync(
    join(tmpDir, "src", "index.ts"),
    `import { add } from "./utils.js";\nexport function main() { return add(1, 2); }\n`
  );
  writeFileSync(
    join(tmpDir, "src", "utils.ts"),
    Array(120).fill("// filler line").join("\n") + "\nexport function add(a: number, b: number) { return a + b; }\n"
  );

  // tests/
  mkdirSync(join(tmpDir, "tests"), { recursive: true });
  writeFileSync(
    join(tmpDir, "tests", "utils.test.ts"),
    `import { add } from "../src/utils.js";\nimport { test, expect } from "vitest";\ntest("add", () => expect(add(1,2)).toBe(3));\n`
  );

  // git init + first commit
  const git = (cmd: string) =>
    execSync(cmd, { cwd: tmpDir, stdio: ["ignore", "ignore", "ignore"] });

  git("git init");
  git("git config user.email test@example.com");
  git("git config user.name Test");
  git("git add .");
  git("git commit -m 'initial commit'");

  // Make a second commit so HEAD~1 diff works for orient()
  writeFileSync(join(tmpDir, "src", "feature.ts"), "export const VERSION = '1.0.0';\n");
  git("git add .");
  git("git commit -m 'add feature.ts'");
});

afterAll(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

// ─── 1. fingerprintRepo ───────────────────────────────────────────────────────

describe("fingerprintRepo()", () => {
  it("detects Node.js project type", () => {
    const fp = fingerprintRepo(tmpDir);
    expect(fp).toContain("**Project type**: Node.js");
  });

  it("detects TypeScript language", () => {
    const fp = fingerprintRepo(tmpDir);
    expect(fp).toContain("**Language**: TypeScript");
  });

  it("includes Build line when build script exists", () => {
    const fp = fingerprintRepo(tmpDir);
    expect(fp).toContain("**Build**:");
  });

  it("includes Test line when test script exists", () => {
    const fp = fingerprintRepo(tmpDir);
    expect(fp).toContain("**Test**:");
  });

  it("includes recent commits section", () => {
    const fp = fingerprintRepo(tmpDir);
    expect(fp).toContain("**Recent commits**:");
    expect(fp).toContain("initial commit");
  });
});

// ─── 2. extractCommands(fingerprint) — cross-module data flow ─────────────────

describe("extractCommands(fingerprintRepo())", () => {
  it("returns npm test for a Node.js TypeScript project with test script", () => {
    const fp = fingerprintRepo(tmpDir);
    const cmds = extractCommands(fp);
    expect(cmds).toContain("npm test");
  });

  it("returns npx tsc --noEmit for a TypeScript project with build script", () => {
    const fp = fingerprintRepo(tmpDir);
    const cmds = extractCommands(fp);
    expect(cmds).toContain("npx tsc --noEmit");
  });

  it("returns non-empty array — fingerprintRepo output is parseable by extractCommands", () => {
    const fp = fingerprintRepo(tmpDir);
    const cmds = extractCommands(fp);
    expect(cmds.length).toBeGreaterThan(0);
  });
});

// ─── 3. rankFiles ─────────────────────────────────────────────────────────────

describe("rankFiles()", () => {
  it("returns an array of ranked files for the temp repo", () => {
    const files = rankFiles(tmpDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("entry point src/index.ts ranks higher than tests/utils.test.ts", () => {
    const files = rankFiles(tmpDir);
    const indexFile = files.find(f => f.path.includes("index.ts"));
    const testFile = files.find(f => f.path.includes("utils.test.ts"));
    expect(indexFile).toBeDefined();
    expect(testFile).toBeDefined();
    expect(indexFile!.score).toBeGreaterThan(testFile!.score);
  });

  it("large module src/utils.ts (120+ LOC) scores higher than test file", () => {
    const files = rankFiles(tmpDir);
    const utilsFile = files.find(f => f.path === "src/utils.ts");
    const testFile = files.find(f => f.path.includes("utils.test.ts"));
    expect(utilsFile).toBeDefined();
    expect(testFile).toBeDefined();
    expect(utilsFile!.score).toBeGreaterThan(testFile!.score);
  });

  it("each file has a numeric score and a reason string", () => {
    const files = rankFiles(tmpDir);
    for (const f of files) {
      expect(typeof f.score).toBe("number");
      expect(typeof f.reason).toBe("string");
      expect(f.reason.length).toBeGreaterThan(0);
    }
  });
});

// ─── 4. shouldDecompose ───────────────────────────────────────────────────────

describe("shouldDecompose()", () => {
  it("triggers on a realistic multi-step task description", () => {
    const task = `
      Refactor the authentication module:
      1. Extract token validation into a separate service
      2. Add rate limiting middleware
      3. Write unit tests for the new service
      4. Update the API documentation
      5. Add integration tests
    `;
    expect(shouldDecompose(task)).toBe(true);
  });

  it("does not trigger on a simple single-step task", () => {
    const task = "Fix the typo in the README.";
    expect(shouldDecompose(task)).toBe(false);
  });
});
