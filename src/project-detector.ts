import * as fs from "fs";
import * as path from "path";

export interface ProjectSummary {
  name: string;
  type: string; // "node", "python", "rust", "go", "mixed", "unknown"
  framework?: string; // "next", "express", "fastapi", "react", "vue", etc.
  language: string;
  packageManager?: string; // "npm", "yarn", "pnpm", "pip", "cargo"
  testRunner?: string; // "vitest", "jest", "pytest", "cargo test"
  entryPoints?: string[];
  summary: string; // 1-2 sentence human-readable summary
}

function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function detectFrameworkFromDeps(deps: Record<string, string>): string | undefined {
  const allDeps = Object.keys(deps);
  // Order matters — check more specific first
  if (allDeps.includes("next")) return "next";
  if (allDeps.includes("nuxt") || allDeps.includes("nuxt3")) return "nuxt";
  if (allDeps.includes("@sveltejs/kit")) return "sveltekit";
  if (allDeps.includes("svelte")) return "svelte";
  if (allDeps.includes("@remix-run/node") || allDeps.includes("@remix-run/react")) return "remix";
  if (allDeps.includes("express")) return "express";
  if (allDeps.includes("fastify")) return "fastify";
  if (allDeps.includes("koa")) return "koa";
  if (allDeps.includes("hono")) return "hono";
  if (allDeps.includes("react")) return "react";
  if (allDeps.includes("vue")) return "vue";
  if (allDeps.includes("@angular/core")) return "angular";
  return undefined;
}

function detectTestRunnerFromScripts(scripts: Record<string, string>, deps: Record<string, string>): string | undefined {
  const scriptValues = Object.values(scripts).join(" ");
  if (scriptValues.includes("vitest") || "vitest" in deps) return "vitest";
  if (scriptValues.includes("jest") || "jest" in deps) return "jest";
  if (scriptValues.includes("mocha") || "mocha" in deps) return "mocha";
  if (scriptValues.includes("tap") || "tap" in deps) return "tap";
  if (scriptValues.includes("ava") || "ava" in deps) return "ava";
  return undefined;
}

function detectPackageManager(workDir: string): string | undefined {
  if (fileExists(path.join(workDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fileExists(path.join(workDir, "yarn.lock"))) return "yarn";
  if (fileExists(path.join(workDir, "package-lock.json"))) return "npm";
  if (fileExists(path.join(workDir, "bun.lockb"))) return "bun";
  return undefined;
}

function detectNodeProject(workDir: string): Partial<ProjectSummary> | null {
  const pkgPath = path.join(workDir, "package.json");
  const content = readFileSafe(pkgPath);
  if (!content) return null;

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  const name = (pkg.name as string) || path.basename(workDir);
  const deps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string>) || {}),
    ...((pkg.devDependencies as Record<string, string>) || {}),
  };
  const scripts = (pkg.scripts as Record<string, string>) || {};

  const framework = detectFrameworkFromDeps(deps);
  const testRunner = detectTestRunnerFromScripts(scripts, deps);
  const packageManager = detectPackageManager(workDir);

  // Detect language: TypeScript if tsconfig or ts deps present
  const hasTypeScript =
    "typescript" in deps ||
    fileExists(path.join(workDir, "tsconfig.json")) ||
    fileExists(path.join(workDir, "tsconfig.base.json"));

  const language = hasTypeScript ? "TypeScript" : "JavaScript";
  const type = "node";

  return { name, type, framework, language, packageManager, testRunner };
}

function detectPythonProject(workDir: string): Partial<ProjectSummary> | null {
  const hasPyproject = fileExists(path.join(workDir, "pyproject.toml"));
  const hasSetupPy = fileExists(path.join(workDir, "setup.py"));
  const hasSetupCfg = fileExists(path.join(workDir, "setup.cfg"));
  const hasRequirements = fileExists(path.join(workDir, "requirements.txt"));

  if (!hasPyproject && !hasSetupPy && !hasSetupCfg && !hasRequirements) return null;

  // Try to extract name from pyproject.toml
  let name = path.basename(workDir);
  let framework: string | undefined;
  let testRunner: string | undefined = "pytest"; // default for python

  if (hasPyproject) {
    const content = readFileSafe(path.join(workDir, "pyproject.toml")) || "";
    const nameMatch = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
    if (nameMatch) name = nameMatch[1];

    if (content.includes("fastapi")) framework = "fastapi";
    else if (content.includes("django")) framework = "django";
    else if (content.includes("flask")) framework = "flask";

    if (content.includes("pytest")) testRunner = "pytest";
    else if (content.includes("unittest")) testRunner = "unittest";
  }

  if (!framework && hasRequirements) {
    const req = readFileSafe(path.join(workDir, "requirements.txt")) || "";
    if (req.includes("fastapi")) framework = "fastapi";
    else if (req.includes("django")) framework = "django";
    else if (req.includes("flask")) framework = "flask";
  }

  return {
    name,
    type: "python",
    language: "Python",
    framework,
    testRunner,
    packageManager: "pip",
  };
}

function detectRustProject(workDir: string): Partial<ProjectSummary> | null {
  const content = readFileSafe(path.join(workDir, "Cargo.toml"));
  if (!content) return null;

  let name = path.basename(workDir);
  const nameMatch = content.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  if (nameMatch) name = nameMatch[1];

  return {
    name,
    type: "rust",
    language: "Rust",
    packageManager: "cargo",
    testRunner: "cargo test",
  };
}

function detectGoProject(workDir: string): Partial<ProjectSummary> | null {
  const content = readFileSafe(path.join(workDir, "go.mod"));
  if (!content) return null;

  let name = path.basename(workDir);
  const moduleMatch = content.match(/^module\s+(\S+)/m);
  if (moduleMatch) {
    // Use just the last segment of the module path as name
    const parts = moduleMatch[1].split("/");
    name = parts[parts.length - 1];
  }

  return {
    name,
    type: "go",
    language: "Go",
    testRunner: "go test",
  };
}

function buildSummary(info: Partial<ProjectSummary>): string {
  const parts: string[] = [];

  // Opening: language + type + framework
  let opening = `${info.language} ${info.type === "node" ? "Node.js" : info.type} project`;
  if (info.framework) opening += ` using ${info.framework}`;
  parts.push(opening + ".");

  const details: string[] = [];
  if (info.testRunner) details.push(`Test runner: ${info.testRunner}`);
  if (info.packageManager) details.push(`Package manager: ${info.packageManager}`);
  if (details.length > 0) parts.push(details.join(". ") + ".");

  return parts.join(" ");
}

/**
 * Detect the project type, framework, language, and test runner for a working directory.
 * Uses only synchronous fs reads — no subprocess calls. Should add <5ms to startup.
 */
export function detectProject(workDir: string): ProjectSummary {
  // Try each detector in priority order
  const node = detectNodeProject(workDir);
  const python = detectPythonProject(workDir);
  const rust = detectRustProject(workDir);
  const go = detectGoProject(workDir);

  const detected = [node, python, rust, go].filter(Boolean);

  let info: Partial<ProjectSummary>;

  if (detected.length === 0) {
    info = {
      name: path.basename(workDir),
      type: "unknown",
      language: "Unknown",
    };
  } else if (detected.length > 1) {
    // Mixed project — node wins if present (most common polyglot case)
    info = node || detected[0]!;
    info = { ...info, type: "mixed" };
  } else {
    info = detected[0]!;
  }

  const summary = buildSummary(info);

  return {
    name: info.name || path.basename(workDir),
    type: info.type || "unknown",
    framework: info.framework,
    language: info.language || "Unknown",
    packageManager: info.packageManager,
    testRunner: info.testRunner,
    entryPoints: info.entryPoints,
    summary,
  };
}
