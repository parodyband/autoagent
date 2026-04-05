/**
 * Tests for src/file-ranker.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rankFiles, formatRankedFiles, type RankedFile } from "../file-ranker.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import path from "path";
import { execSync } from "child_process";

const TEST_DIR = path.join(process.cwd(), ".self-test-tmp", "file-ranker-test");

function createFile(relPath: string, content: string = "// placeholder\n") {
  const full = path.join(TEST_DIR, relPath);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function initGit() {
  execSync("git init && git add -A && git commit -m 'init' --allow-empty", {
    cwd: TEST_DIR,
    stdio: "ignore",
  });
}

function gitCommitFile(relPath: string, content: string) {
  createFile(relPath, content);
  execSync(`git add "${relPath}" && git commit -m "update ${relPath}"`, {
    cwd: TEST_DIR,
    stdio: "ignore",
  });
}

describe("rankFiles", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("detects entry points at root and src/", () => {
    createFile("index.ts", "export default 1;\n");
    createFile("src/main.ts", "console.log('hi');\n");
    createFile("src/utils.ts", "export const x = 1;\n");
    initGit();

    const results = rankFiles(TEST_DIR);
    const entryPaths = results.filter(r => r.reason.includes("entry point")).map(r => r.path);
    expect(entryPaths).toContain("index.ts");
    expect(entryPaths).toContain(path.join("src", "main.ts"));
    // utils.ts should NOT be an entry point
    expect(entryPaths).not.toContain(path.join("src", "utils.ts"));
  });

  it("includes config files with +10 score", () => {
    createFile("package.json", '{"name": "test"}\n');
    createFile("tsconfig.json", '{"compilerOptions": {}}\n');
    createFile("src/foo.ts", "// nothing\n");
    initGit();

    const results = rankFiles(TEST_DIR);
    const configs = results.filter(r => r.reason.includes("config file"));
    expect(configs.length).toBeGreaterThanOrEqual(2);
    expect(configs.every(c => c.score >= 10)).toBe(true);
  });

  it("deprioritizes test files with -20 score", () => {
    // Create a test file that also has a positive signal (recently modified)
    createFile("src/app.ts", "console.log('app');\n");
    createFile("src/app.test.ts", "test('works', () => {});\n");
    createFile("src/__tests__/foo.test.ts", "test('foo', () => {});\n");
    initGit();
    // Make them recently modified
    gitCommitFile("src/app.ts", "console.log('app v2');\n");
    gitCommitFile("src/app.test.ts", "test('works v2', () => {});\n");

    const results = rankFiles(TEST_DIR);
    const app = results.find(r => r.path === path.join("src", "app.ts"));
    const appTest = results.find(r => r.path === path.join("src", "app.test.ts"));

    // app.ts should score higher than app.test.ts
    if (app && appTest) {
      expect(app.score).toBeGreaterThan(appTest.score);
    }
    // app.ts should definitely be in results
    expect(app).toBeDefined();
  });

  it("returns files sorted by score descending", () => {
    createFile("src/index.ts", "// entry\n" + "// line\n".repeat(150));
    createFile("src/utils.ts", "// small\n");
    createFile("package.json", '{"name": "test"}\n');
    initGit();
    // Make index recently modified
    gitCommitFile("src/index.ts", "// entry v2\n" + "// line\n".repeat(150));

    const results = rankFiles(TEST_DIR);
    // Verify sorted descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("returns empty array for nonexistent directory", () => {
    expect(rankFiles("/nonexistent/path/that/does/not/exist")).toEqual([]);
  });

  it("returns empty array for empty directory", () => {
    // TEST_DIR exists but has no files
    expect(rankFiles(TEST_DIR)).toEqual([]);
  });

  it("respects maxFiles limit", () => {
    // Create many files
    for (let i = 0; i < 30; i++) {
      createFile(`src/file${i}.ts`, "// line\n".repeat(150));
    }
    createFile("package.json", '{"name": "test"}\n');
    initGit();
    // Make them all recently modified
    for (let i = 0; i < 30; i++) {
      gitCommitFile(`src/file${i}.ts`, `// v2\n` + "// line\n".repeat(150));
    }

    const results5 = rankFiles(TEST_DIR, 5);
    expect(results5.length).toBeLessThanOrEqual(5);

    const results10 = rankFiles(TEST_DIR, 10);
    expect(results10.length).toBeLessThanOrEqual(10);
  });

  it("awards +20 for large modules (>100 LOC)", () => {
    createFile("src/big.ts", "// line\n".repeat(150));
    createFile("src/small.ts", "// line\n".repeat(10));
    initGit();
    // Make both recently modified so they show up
    gitCommitFile("src/big.ts", "// v2\n" + "// line\n".repeat(150));
    gitCommitFile("src/small.ts", "// v2\n" + "// line\n".repeat(10));

    const results = rankFiles(TEST_DIR);
    const big = results.find(r => r.path === path.join("src", "big.ts"));
    const small = results.find(r => r.path === path.join("src", "small.ts"));

    expect(big).toBeDefined();
    expect(big!.reason).toContain("large module");
    if (small) {
      expect(small.reason).not.toContain("large module");
    }
  });
});

describe("formatRankedFiles", () => {
  it("returns empty string for empty array", () => {
    expect(formatRankedFiles([])).toBe("");
  });

  it("formats files as markdown list", () => {
    const files: RankedFile[] = [
      { path: "src/agent.ts", score: 85, reason: "entry point, recently modified" },
      { path: "package.json", score: 10, reason: "config file" },
    ];
    const output = formatRankedFiles(files);
    expect(output).toContain("## Key Files");
    expect(output).toContain("`src/agent.ts`");
    expect(output).toContain("score: 85");
    expect(output).toContain("`package.json`");
  });
});
