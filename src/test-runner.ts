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
 * Find test files related to the given changed source files.
 * Strategy: direct name match (co-located + conventional dirs) + import-based scan.
 * Supports .test.ts, .test.tsx, .spec.ts, .spec.tsx patterns.
 */
export function findRelatedTests(workDir: string, changedFiles: string[]): string[] {
  const found = new Set<string>();

  for (const file of changedFiles) {
    const base = path.basename(file, path.extname(file));
    const rel = path.relative(workDir, path.resolve(workDir, file));
    const dir = path.dirname(rel);

    // Direct match candidates — co-located + conventional dirs, .test + .spec variants
    const candidates = [
      // Co-located (same directory as source file)
      path.join(dir, `${base}.test.ts`),
      path.join(dir, `${base}.test.tsx`),
      path.join(dir, `${base}.spec.ts`),
      path.join(dir, `${base}.spec.tsx`),
      // __tests__ subdir of same directory
      path.join(dir, "__tests__", `${base}.test.ts`),
      path.join(dir, "__tests__", `${base}.test.tsx`),
      path.join(dir, "__tests__", `${base}.spec.ts`),
      path.join(dir, "__tests__", `${base}.spec.tsx`),
      // src/__tests__ (conventional monorepo location)
      path.join("src", "__tests__", `${base}.test.ts`),
      path.join("src", "__tests__", `${base}.test.tsx`),
      path.join("src", "__tests__", `${base}.spec.ts`),
      path.join("src", "__tests__", `${base}.spec.tsx`),
      // top-level test dir
      path.join("test", `${base}.test.ts`),
      path.join("test", `${base}.test.tsx`),
      path.join("test", `${base}.spec.ts`),
      path.join("test", `${base}.spec.tsx`),
      // top-level __tests__ dir
      path.join("__tests__", `${base}.test.ts`),
      path.join("__tests__", `${base}.test.tsx`),
      path.join("__tests__", `${base}.spec.ts`),
      path.join("__tests__", `${base}.spec.tsx`),
    ];

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
 * - Conventional dirs: src/__tests__, test, __tests__
 * - Co-located: any *.test.ts / *.spec.ts files anywhere in src/
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

  // Also scan top-level test and __tests__ dirs
  for (const td of ["test", "__tests__"]) {
    const dir = path.join(workDir, td);
    if (fs.existsSync(dir)) {
      walkDir(dir);
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
