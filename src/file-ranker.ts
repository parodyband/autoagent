/**
 * Smart file discovery — ranks source files by importance for external repos.
 *
 * When AutoAgent runs on an external repo, the agent wastes turns exploring
 * random files. This module ranks files so the agent reads the most relevant
 * ones first.
 *
 * Ranking signals:
 *   Entry points (+40): index.*, main.*, app.*, server.*, cli.* at root/src
 *   Recently modified (+30): files in last 10 git commits
 *   Large modules (+20): files > 100 LOC
 *   Config files (+10): package.json, tsconfig.json, Makefile, etc.
 *   Test files (-20): *.test.*, *.spec.*, __tests__/, test/, spec/
 *
 * Must run in < 1 second on repos up to 1000 files.
 * Uses sync fs + execSync (same pattern as repo-context.ts).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { execSync } from "child_process";
import { buildSymbolIndex, scoreByReferences } from "./symbol-index.js";

// ─── Types ──────────────────────────────────────────────────

export interface RankedFile {
  path: string;     // relative to dir
  score: number;    // 0–100
  reason: string;   // why it's important
}

// ─── Helpers ────────────────────────────────────────────────

function safeExec(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// Skip these directories when walking
const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".venv", "venv", "vendor", ".cache", "coverage", "target", ".output",
]);

// Source file extensions we care about
const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java",
  ".rb", ".php", ".c", ".cpp", ".h", ".cs", ".swift", ".kt",
  ".scala", ".ex", ".exs", ".hs", ".ml",
]);

// Config files always included
const CONFIG_FILES = new Set([
  "tsconfig.json", "package.json", "Makefile", "Cargo.toml",
  "go.mod", "pyproject.toml", "setup.py", "docker-compose.yml",
  "Dockerfile", ".env.example",
]);

// Entry point base names (without extension)
const ENTRY_NAMES = new Set(["index", "main", "app", "server", "cli", "mod", "lib"]);

// ─── File walking ───────────────────────────────────────────

const MAX_WALK_FILES = 500; // bail out early on huge trees

function walkFiles(dir: string, rootDir: string, maxDepth: number = 6, depth: number = 0, state?: { count: number }): string[] {
  if (!state) state = { count: 0 };
  if (depth > maxDepth || state.count >= MAX_WALK_FILES) return [];
  const results: string[] = [];

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (state.count >= MAX_WALK_FILES) break;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      results.push(...walkFiles(path.join(dir, entry.name), rootDir, maxDepth, depth + 1, state));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const baseName = entry.name;
      if (SOURCE_EXTS.has(ext) || CONFIG_FILES.has(baseName)) {
        results.push(path.relative(rootDir, path.join(dir, entry.name)));
        state.count++;
      }
    }
  }

  return results;
}

// ─── Signal detection ───────────────────────────────────────

function isEntryPoint(relPath: string): boolean {
  const base = path.basename(relPath, path.extname(relPath));
  const dir = path.dirname(relPath);
  // Entry points at root or src/
  if (dir === "." || dir === "src" || dir === "lib" || dir === "cmd") {
    return ENTRY_NAMES.has(base);
  }
  return false;
}

function isTestFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (/\.(test|spec)\./i.test(base)) return true;
  if (/\.tests?\./i.test(base)) return true;
  const parts = relPath.split(path.sep);
  return parts.some(p => p === "__tests__" || p === "test" || p === "tests" || p === "spec");
}

function isConfigFile(relPath: string): boolean {
  return CONFIG_FILES.has(path.basename(relPath));
}

function getLineCount(filePath: string): number {
  try {
    const stat = statSync(filePath);
    if (stat.size > 512 * 1024) return 200; // assume large for files > 512KB, skip reading
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

function getRecentlyModified(dir: string): Set<string> {
  const output = safeExec("git log --name-only --pretty=format: -10", dir);
  if (!output) return new Set();
  return new Set(output.split("\n").filter(Boolean));
}

// ─── Main export ────────────────────────────────────────────

/**
 * Rank source files in a directory by importance.
 * Returns top `maxFiles` sorted by score descending.
 * Safe to call on any directory — returns empty array on errors.
 */
export function rankFiles(dir: string, maxFiles: number = 20): RankedFile[] {
  try {
    if (!existsSync(dir)) return [];

    // Skip walking non-project directories (e.g. ~ or ~/Documents)
    if (!existsSync(path.join(dir, ".git")) &&
        !existsSync(path.join(dir, "package.json")) &&
        !existsSync(path.join(dir, "Cargo.toml")) &&
        !existsSync(path.join(dir, "go.mod")) &&
        !existsSync(path.join(dir, "pyproject.toml")) &&
        !existsSync(path.join(dir, "setup.py")) &&
        !existsSync(path.join(dir, "Makefile"))) {
      return [];
    }

    const files = walkFiles(dir, dir);
    if (files.length === 0) return [];

    const recentlyModified = getRecentlyModified(dir);

    const scored: RankedFile[] = [];

    for (const relPath of files) {
      let score = 0;
      const reasons: string[] = [];

      // Signal 1: Entry point (+40)
      if (isEntryPoint(relPath)) {
        score += 40;
        reasons.push("entry point");
      }

      // Signal 2: Recently modified (+30)
      if (recentlyModified.has(relPath)) {
        score += 30;
        reasons.push("recently modified");
      }

      // Signal 3: Large module (+20) — only for source files
      if (!isConfigFile(relPath)) {
        const lineCount = getLineCount(path.join(dir, relPath));
        if (lineCount > 100) {
          score += 20;
          reasons.push("large module");
        }
      }

      // Signal 4: Config file (+10)
      if (isConfigFile(relPath)) {
        score += 10;
        reasons.push("config file");
      }

      // Signal 5: Test file (-20)
      if (isTestFile(relPath)) {
        score -= 20;
        reasons.push("test file");
      }

      // Only include files with positive score
      if (score > 0) {
        scored.push({
          path: relPath,
          score: Math.max(0, Math.min(100, score)),
          reason: reasons.join(", "),
        });
      }
    }

    // Signal 6: Symbol references (+25) — files with highly-referenced exports
    try {
      const allPaths = scored.map(f => f.path);
      const symIndex = buildSymbolIndex(dir, allPaths);
      const refScores = scoreByReferences(symIndex, dir);
      for (const rf of scored) {
        if (refScores.has(rf.path)) {
          rf.score += 25;
          rf.reason = rf.reason ? rf.reason + ", symbol references" : "symbol references";
        }
      }
    } catch {
      // Non-fatal — symbol scoring is best-effort
    }

    // Sort by score descending, then alphabetically for ties
    scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

    return scored.slice(0, maxFiles);
  } catch {
    return [];
  }
}

/**
 * Format ranked files as a markdown block for injection into initial message.
 */
export function formatRankedFiles(files: RankedFile[]): string {
  if (files.length === 0) return "";
  const lines = ["## Key Files", ""];
  for (const f of files) {
    lines.push(`- \`${f.path}\` (score: ${f.score}) — ${f.reason}`);
  }
  return lines.join("\n");
}
