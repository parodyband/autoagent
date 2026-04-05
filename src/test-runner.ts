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
 * Strategy: direct name match + import-based scan.
 */
export function findRelatedTests(workDir: string, changedFiles: string[]): string[] {
  const found = new Set<string>();

  for (const file of changedFiles) {
    const base = path.basename(file, path.extname(file));
    const rel = path.relative(workDir, path.resolve(workDir, file));
    const dir = path.dirname(rel);

    // Direct match candidates
    const candidates = [
      path.join(dir, "__tests__", `${base}.test.ts`),
      path.join(dir, "__tests__", `${base}.test.tsx`),
      path.join("src", "__tests__", `${base}.test.ts`),
      path.join("src", "__tests__", `${base}.test.tsx`),
      path.join("test", `${base}.test.ts`),
      path.join("test", `${base}.test.tsx`),
      `${base}.test.ts`,
      `${base}.test.tsx`,
    ];

    for (const c of candidates) {
      const abs = path.resolve(workDir, c);
      if (fs.existsSync(abs)) found.add(c);
    }
  }

  // Import-based scan: find test files importing any changed module
  const testDirs = ["src/__tests__", "test", "__tests__"].map(d => path.join(workDir, d));
  const testFiles: string[] = [];
  for (const td of testDirs) {
    if (fs.existsSync(td)) {
      for (const f of fs.readdirSync(td)) {
        if (f.endsWith(".test.ts") || f.endsWith(".test.tsx")) {
          testFiles.push(path.join(td, f));
        }
      }
    }
  }

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
