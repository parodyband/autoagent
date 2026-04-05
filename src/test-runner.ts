/**
 * Smart test discovery — find and run tests related to changed files.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const MAX_OUTPUT_CHARS = 4096;

/** Detect test runner from package.json (vitest or jest). */
export function detectTestRunner(workDir: string): "vitest" | "jest" | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(workDir, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["vitest"]) return "vitest";
    if (deps["jest"]) return "jest";
  } catch { /* ignore */ }
  return null;
}

/**
 * Given a source file path (absolute or relative to workDir), return all candidate
 * test file paths (relative to workDir) — without checking if they exist.
 * Covers: co-located, __tests__ subdir, src/__tests__, test/, tests/, __tests__/,
 * and monorepo packages-star-src-__tests__ patterns.
 */
export function findTestFile(sourceFile: string, workDir: string): string[] {
  const rel = path.relative(workDir, path.resolve(workDir, sourceFile));
  const dir = path.dirname(rel);
  const base = path.basename(rel, path.extname(rel));
  const exts = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

  const candidates: string[] = [];

  for (const ext of exts) {
    // Co-located (same directory)
    candidates.push(path.join(dir, `${base}${ext}`));
    // __tests__ subdir of same directory
    candidates.push(path.join(dir, "__tests__", `${base}${ext}`));
    // src/__tests__
    candidates.push(path.join("src", "__tests__", `${base}${ext}`));
    // top-level test/ and tests/ dirs
    candidates.push(path.join("test", `${base}${ext}`));
    candidates.push(path.join("tests", `${base}${ext}`));
    // top-level __tests__
    candidates.push(path.join("__tests__", `${base}${ext}`));
  }

  // Monorepo: if source is under packages/PKG/..., also check packages/PKG/src/__tests__
  const parts = rel.split(path.sep);
  if (parts[0] === "packages" && parts.length >= 3) {
    const pkgRoot = path.join(parts[0], parts[1]);
    for (const ext of exts) {
      candidates.push(path.join(pkgRoot, "src", "__tests__", `${base}${ext}`));
      candidates.push(path.join(pkgRoot, "__tests__", `${base}${ext}`));
      candidates.push(path.join(pkgRoot, "test", `${base}${ext}`));
    }
  }

  return candidates;
}

/**
 * Find test files related to the given changed source files.
 * Strategy: direct name match (co-located + conventional dirs) + import-based scan.
 * Supports .test.ts, .test.tsx, .spec.ts, .spec.tsx patterns.
 */
export function findRelatedTests(workDir: string, changedFiles: string[]): string[] {
  const found = new Set<string>();

  for (const file of changedFiles) {
    const candidates = findTestFile(file, workDir);
    for (const c of candidates) {
      const abs = path.resolve(workDir, c);
      if (fs.existsSync(abs)) found.add(c);
    }
  }

  // Import-based scan: find test files importing any changed module.
  // Scans conventional dirs AND co-located files by walking src/ recursively.
  const testFiles = collectTestFiles(workDir);

  for (const changed of changedFiles) {
    const modName = path.basename(changed, path.extname(changed));
    for (const tf of testFiles) {
      try {
        const content = fs.readFileSync(tf, "utf-8");
        if (content.includes(`/${modName}`) || content.includes(`"${modName}"`)) {
          found.add(path.relative(workDir, tf));
        }
      } catch { /* ignore */ }
    }
  }

  return [...found];
}

/**
 * Collect all test files under workDir:
 * - Conventional dirs: src/__tests__, test, tests, __tests__
 * - Co-located: any *.test.ts / *.spec.ts files anywhere in src/
 * - Monorepo: packages/{name}/src/__tests__, packages/{name}/__tests__, packages/{name}/test
 */
function collectTestFiles(workDir: string): string[] {
  const files: string[] = [];
  const seen = new Set<string>();

  function addFile(abs: string) {
    if (!seen.has(abs)) {
      seen.add(abs);
      files.push(abs);
    }
  }

  // Walk a directory recursively, collecting test files
  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walkDir(abs);
      } else if (entry.isFile()) {
        if (
          entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx") ||
          entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.tsx")
        ) {
          addFile(abs);
        }
      }
    }
  }

  // Walk the full src/ tree to catch co-located and nested test files
  walkDir(path.join(workDir, "src"));

  // Also scan top-level test, tests, and __tests__ dirs
  for (const td of ["test", "tests", "__tests__"]) {
    const dir = path.join(workDir, td);
    if (fs.existsSync(dir)) {
      walkDir(dir);
    }
  }

  // Monorepo: scan packages/*/src/__tests__, packages/*/__tests__, packages/*/test
  const packagesDir = path.join(workDir, "packages");
  if (fs.existsSync(packagesDir)) {
    let pkgDirs: fs.Dirent[];
    try {
      pkgDirs = fs.readdirSync(packagesDir, { withFileTypes: true });
    } catch { pkgDirs = []; }
    for (const pkg of pkgDirs) {
      if (!pkg.isDirectory()) continue;
      const pkgRoot = path.join(packagesDir, pkg.name);
      walkDir(path.join(pkgRoot, "src"));
      for (const td of ["test", "tests", "__tests__"]) {
        walkDir(path.join(pkgRoot, td));
      }
    }
  }

  return files;
}

/** Run the given test files. Returns pass/fail + truncated output. */
export async function runRelatedTests(
  workDir: string,
  testFiles: string[],
): Promise<{ passed: boolean; output: string }> {
  if (testFiles.length === 0) return { passed: true, output: "" };

  const runner = detectTestRunner(workDir);
  if (!runner) return { passed: true, output: "" };

  const bin = path.join(workDir, "node_modules", ".bin", runner);
  const cmd = fs.existsSync(bin)
    ? `${bin} run ${testFiles.join(" ")}`
    : `npx ${runner} run ${testFiles.join(" ")}`;

  try {
    const output = execSync(cmd, {
      cwd: workDir,
      encoding: "utf-8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const trimmed = output.slice(0, MAX_OUTPUT_CHARS);
    return { passed: true, output: trimmed };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const raw = ((e.stdout ?? "") + (e.stderr ?? "")).slice(0, MAX_OUTPUT_CHARS);
    return { passed: false, output: raw };
  }
}
