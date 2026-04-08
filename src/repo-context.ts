/**
 * Repo fingerprinting — quickly analyzes a directory and returns a compact
 * context summary injected into the initial message when running on external repos.
 *
 * Must be fast (< 500ms). Uses sync fs operations only.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { execSync } from "child_process";

// ─── Helpers ─────────────────────────────────────────────────

function safeRead(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function safeExec(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function topLevelDirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules")
      .map(d => d.name)
      .slice(0, 15);
  } catch {
    return [];
  }
}

// ─── Project type detection ───────────────────────────────────

interface ProjectInfo {
  type: string;
  language: string;
  buildCommands: string[];
  testCommands: string[];
}

function detectProject(dir: string): ProjectInfo {
  // Node.js / TypeScript
  const pkgPath = path.join(dir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = safeRead(pkgPath);
    let pkgJson: Record<string, unknown> = {};
    try { pkgJson = JSON.parse(pkg || "{}"); } catch {}

    const scripts = (pkgJson.scripts as Record<string, string>) || {};
    const buildCmds: string[] = [];
    const testCmds: string[] = [];

    for (const [name, cmd] of Object.entries(scripts)) {
      if (["build", "compile", "tsc"].includes(name)) buildCmds.push(`npm run ${name} (${cmd})`);
      if (["test", "test:run", "vitest", "jest", "check"].includes(name)) testCmds.push(`npm run ${name} (${cmd})`);
    }

    const hasTsConfig = existsSync(path.join(dir, "tsconfig.json"));
    const language = hasTsConfig ? "TypeScript" : "JavaScript";
    return { type: "Node.js", language, buildCommands: buildCmds, testCommands: testCmds };
  }

  // Python
  if (existsSync(path.join(dir, "pyproject.toml")) || existsSync(path.join(dir, "setup.py")) || existsSync(path.join(dir, "requirements.txt"))) {
    const buildCmds: string[] = [];
    const testCmds: string[] = [];
    if (existsSync(path.join(dir, "Makefile"))) {
      const mk = safeRead(path.join(dir, "Makefile")) || "";
      if (/^test:/m.test(mk)) testCmds.push("make test");
      if (/^build:/m.test(mk)) buildCmds.push("make build");
    }
    if (existsSync(path.join(dir, "pyproject.toml"))) {
      testCmds.push("pytest");
      buildCmds.push("python -m build");
    }
    return { type: "Python", language: "Python", buildCommands: buildCmds, testCommands: testCmds };
  }

  // Rust
  if (existsSync(path.join(dir, "Cargo.toml"))) {
    return {
      type: "Rust",
      language: "Rust",
      buildCommands: ["cargo build"],
      testCommands: ["cargo test"],
    };
  }

  // Go
  if (existsSync(path.join(dir, "go.mod"))) {
    return {
      type: "Go",
      language: "Go",
      buildCommands: ["go build ./..."],
      testCommands: ["go test ./..."],
    };
  }

  // Makefile fallback
  if (existsSync(path.join(dir, "Makefile"))) {
    const mk = safeRead(path.join(dir, "Makefile")) || "";
    const targets = [...mk.matchAll(/^([a-zA-Z][a-zA-Z0-9_-]*):/gm)].map(m => m[1]).slice(0, 8);
    return {
      type: "Unknown (Makefile)",
      language: "Unknown",
      buildCommands: targets.includes("build") ? ["make build"] : [],
      testCommands: targets.includes("test") ? ["make test"] : [],
    };
  }

  return { type: "Unknown", language: "Unknown", buildCommands: [], testCommands: [] };
}

// ─── Git info ─────────────────────────────────────────────────

function getGitInfo(dir: string): { commits: string[]; recentFiles: string[] } {
  const commits = safeExec("git log --oneline -5", dir);
  const recentFiles = safeExec("git diff --name-only HEAD~3 HEAD 2>/dev/null || git diff --name-only HEAD", dir);
  return {
    commits: commits ? commits.split("\n").filter(Boolean) : [],
    recentFiles: recentFiles ? [...new Set(recentFiles.split("\n").filter(Boolean))].slice(0, 10) : [],
  };
}

// ─── Size estimate ────────────────────────────────────────────

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go"]);
const SKIP_DIRS_EST = new Set(["node_modules", ".git", "dist", "build", ".next", "__pycache__", ".venv", "venv", "vendor", "target"]);
const MAX_ESTIMATE_FILES = 200;

function estimateSize(dir: string): { fileCount: number; approxLoc: number } {
  let fileCount = 0;
  let totalBytes = 0;

  function walk(d: string, depth: number): void {
    if (depth > 5 || fileCount >= MAX_ESTIMATE_FILES) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (fileCount >= MAX_ESTIMATE_FILES) return;
      if (entry.isDirectory()) {
        if (SKIP_DIRS_EST.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(path.join(d, entry.name), depth + 1);
      } else if (entry.isFile() && SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        fileCount++;
        try {
          totalBytes += statSync(path.join(d, entry.name)).size;
        } catch { /* skip unreadable files */ }
      }
    }
  }

  walk(dir, 0);
  // Estimate ~35 bytes per line for source code
  const approxLoc = Math.round(totalBytes / 35);
  return { fileCount, approxLoc };
}

// ─── Main export ──────────────────────────────────────────────

/**
 * Analyze a repository directory and return a compact context block (~15-30 lines).
 * Safe to call on any directory — returns empty string on errors.
 */
/** Quick check: is this directory a project root worth indexing? */
export function isProjectDir(dir: string): boolean {
  return existsSync(path.join(dir, ".git")) ||
    existsSync(path.join(dir, "package.json")) ||
    existsSync(path.join(dir, "Cargo.toml")) ||
    existsSync(path.join(dir, "go.mod")) ||
    existsSync(path.join(dir, "pyproject.toml")) ||
    existsSync(path.join(dir, "setup.py")) ||
    existsSync(path.join(dir, "Makefile"));
}

export function fingerprintRepo(dir: string): string {
  try {
    if (!existsSync(dir)) return "";

    // Skip heavy indexing for non-project directories (e.g. ~ or ~/Documents)
    if (!isProjectDir(dir)) return "";

    const proj = detectProject(dir);
    const dirs = topLevelDirs(dir);
    const git = getGitInfo(dir);
    const size = estimateSize(dir);

    const lines: string[] = [
      "## Repo Context",
      "",
      `**Project type**: ${proj.type}`,
      `**Language**: ${proj.language}`,
    ];

    if (proj.buildCommands.length > 0) {
      lines.push(`**Build**: ${proj.buildCommands.slice(0, 2).join(", ")}`);
    }
    if (proj.testCommands.length > 0) {
      lines.push(`**Test**: ${proj.testCommands.slice(0, 2).join(", ")}`);
    }

    if (dirs.length > 0) {
      lines.push(`**Top-level dirs**: ${dirs.join(", ")}`);
    }

    if (size.fileCount > 0) {
      lines.push(`**Size**: ~${size.fileCount} source files, ~${size.approxLoc.toLocaleString()} LOC`);
    }

    if (git.commits.length > 0) {
      lines.push("", "**Recent commits**:");
      for (const c of git.commits) {
        lines.push(`  - ${c}`);
      }
    }

    if (git.recentFiles.length > 0) {
      lines.push("", `**Recently changed files**: ${git.recentFiles.join(", ")}`);
    }

    return lines.join("\n");
  } catch {
    return "";
  }
}
