#!/usr/bin/env npx tsx
/**
 * analyze-repo — Generate a structured Markdown overview of any codebase.
 * 
 * Usage: npx tsx scripts/analyze-repo.ts [path] [--output file.md]
 * 
 * Produces a CODEBASE.md-style document with:
 * - Project metadata (name, description, dependencies)
 * - Directory structure
 * - Language breakdown (LOC per language)
 * - Key files and entry points
 * - Dependency graph overview
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "fs";
import path from "path";

// ── Language detection ────────────────────────────────────────

const LANG_MAP: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript (React)", ".js": "JavaScript",
  ".jsx": "JavaScript (React)", ".py": "Python", ".rs": "Rust",
  ".go": "Go", ".java": "Java", ".rb": "Ruby", ".php": "PHP",
  ".c": "C", ".cpp": "C++", ".h": "C/C++ Header", ".hpp": "C++ Header",
  ".cs": "C#", ".swift": "Swift", ".kt": "Kotlin", ".scala": "Scala",
  ".vue": "Vue", ".svelte": "Svelte", ".css": "CSS", ".scss": "SCSS",
  ".html": "HTML", ".json": "JSON", ".yaml": "YAML", ".yml": "YAML",
  ".toml": "TOML", ".md": "Markdown", ".sql": "SQL", ".sh": "Shell",
  ".bash": "Shell", ".zsh": "Shell", ".lua": "Lua", ".zig": "Zig",
  ".ex": "Elixir", ".exs": "Elixir", ".erl": "Erlang", ".hs": "Haskell",
  ".ml": "OCaml", ".fs": "F#", ".dart": "Dart", ".r": "R",
};

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", "target", ".next", "__pycache__",
  ".venv", "venv", "vendor", ".cache", "coverage", ".turbo", ".output",
  ".nuxt", "out", ".svelte-kit", "pkg",
]);

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
  "poetry.lock", "Gemfile.lock", "composer.lock",
]);

// ── File walking ──────────────────────────────────────────────

interface FileEntry {
  relativePath: string;
  absolutePath: string;
  size: number;
  ext: string;
  lines: number;
}

function walkDir(dir: string, rootDir: string, maxDepth = 10, depth = 0): FileEntry[] {
  if (depth > maxDepth) return [];
  const results: FileEntry[] = [];
  
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      results.push(...walkDir(fullPath, rootDir, maxDepth, depth + 1));
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      let lines = 0;
      let size = 0;
      try {
        const stat = statSync(fullPath);
        size = stat.size;
        // Only count lines for text files under 1MB
        if (size < 1_000_000 && LANG_MAP[ext]) {
          const content = readFileSync(fullPath, "utf-8");
          lines = content.split("\n").length;
        }
      } catch {
        // skip unreadable files
      }
      results.push({
        relativePath: path.relative(rootDir, fullPath),
        absolutePath: fullPath,
        size,
        ext,
        lines,
      });
    }
  }
  return results;
}

// ── Project metadata detection ────────────────────────────────

interface ProjectMeta {
  name: string;
  description: string;
  type: string; // "Node.js", "Rust", "Python", etc.
  version: string;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
}

function detectProject(rootDir: string): ProjectMeta {
  const meta: ProjectMeta = {
    name: path.basename(rootDir),
    description: "",
    type: "Unknown",
    version: "",
    dependencies: [],
    devDependencies: [],
    scripts: {},
  };

  // Node.js
  const pkgPath = path.join(rootDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      meta.name = pkg.name || meta.name;
      meta.description = pkg.description || "";
      meta.version = pkg.version || "";
      meta.type = pkg.type === "module" ? "Node.js (ESM)" : "Node.js";
      if (pkg.dependencies) meta.dependencies = Object.keys(pkg.dependencies);
      if (pkg.devDependencies) meta.devDependencies = Object.keys(pkg.devDependencies);
      if (pkg.scripts) meta.scripts = pkg.scripts;
    } catch { /* */ }
  }

  // Rust
  const cargoPath = path.join(rootDir, "Cargo.toml");
  if (existsSync(cargoPath)) {
    meta.type = "Rust";
    try {
      const cargo = readFileSync(cargoPath, "utf-8");
      const nameMatch = cargo.match(/^name\s*=\s*"(.+)"/m);
      const versionMatch = cargo.match(/^version\s*=\s*"(.+)"/m);
      if (nameMatch) meta.name = nameMatch[1];
      if (versionMatch) meta.version = versionMatch[1];
      // Extract dependencies section
      const depsSection = cargo.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
      if (depsSection) {
        const deps = depsSection[1].match(/^(\w[\w-]*)\s*=/gm);
        if (deps) meta.dependencies = deps.map(d => d.replace(/\s*=.*/, ""));
      }
    } catch { /* */ }
  }

  // Python
  const pyprojectPath = path.join(rootDir, "pyproject.toml");
  const setupPath = path.join(rootDir, "setup.py");
  const requirementsPath = path.join(rootDir, "requirements.txt");
  if (existsSync(pyprojectPath) || existsSync(setupPath) || existsSync(requirementsPath)) {
    meta.type = "Python";
    if (existsSync(requirementsPath)) {
      try {
        const reqs = readFileSync(requirementsPath, "utf-8");
        meta.dependencies = reqs.split("\n")
          .map(l => l.trim())
          .filter(l => l && !l.startsWith("#"))
          .map(l => l.split(/[>=<!\[]/)[0].trim());
      } catch { /* */ }
    }
  }

  // Go
  if (existsSync(path.join(rootDir, "go.mod"))) {
    meta.type = "Go";
    try {
      const gomod = readFileSync(path.join(rootDir, "go.mod"), "utf-8");
      const modMatch = gomod.match(/^module\s+(.+)/m);
      if (modMatch) meta.name = modMatch[1];
    } catch { /* */ }
  }

  return meta;
}

// ── Key file identification ───────────────────────────────────

interface KeyFile {
  path: string;
  role: string;
}

function identifyKeyFiles(files: FileEntry[], rootDir: string): KeyFile[] {
  const keyFiles: KeyFile[] = [];
  
  const patterns: [RegExp, string][] = [
    [/^README/i, "Documentation — Project overview"],
    [/^LICENSE/i, "License"],
    [/^package\.json$/, "Node.js package manifest"],
    [/^tsconfig\.json$/, "TypeScript configuration"],
    [/^Cargo\.toml$/, "Rust package manifest"],
    [/^pyproject\.toml$/, "Python project config"],
    [/^Dockerfile$/, "Container definition"],
    [/^docker-compose/i, "Container orchestration"],
    [/^\.github\/workflows\//, "CI/CD workflow"],
    [/^Makefile$/, "Build automation"],
    [/^\.env\.example$/, "Environment template"],
    [/^(?:src\/)?(?:main|index|app|server)\.[tj]sx?$/, "Entry point"],
    [/^(?:src\/)?(?:lib|mod)\.(rs|py|ts|js)$/, "Library entry point"],
  ];

  for (const file of files) {
    for (const [pattern, role] of patterns) {
      if (pattern.test(file.relativePath)) {
        keyFiles.push({ path: file.relativePath, role });
        break;
      }
    }
  }

  return keyFiles;
}

// ── Directory tree ────────────────────────────────────────────

function buildTree(rootDir: string, maxDepth = 3): string {
  const lines: string[] = [];
  
  function walk(dir: string, prefix: string, depth: number) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true })
        .filter(e => !SKIP_DIRS.has(e.name) && !e.name.startsWith(".") && !SKIP_FILES.has(e.name))
        .sort((a, b) => {
          // dirs first, then files
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch {
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";
      
      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        walk(path.join(dir, entry.name), prefix + childPrefix, depth + 1);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
  }

  lines.push(path.basename(rootDir) + "/");
  walk(rootDir, "", 0);
  return lines.join("\n");
}

// ── Language stats ────────────────────────────────────────────

interface LangStats {
  language: string;
  files: number;
  lines: number;
  bytes: number;
}

function computeLangStats(files: FileEntry[]): LangStats[] {
  const stats = new Map<string, { files: number; lines: number; bytes: number }>();
  
  for (const file of files) {
    const lang = LANG_MAP[file.ext];
    if (!lang) continue;
    
    const existing = stats.get(lang) || { files: 0, lines: 0, bytes: 0 };
    existing.files++;
    existing.lines += file.lines;
    existing.bytes += file.size;
    stats.set(lang, existing);
  }

  return Array.from(stats.entries())
    .map(([language, s]) => ({ language, ...s }))
    .sort((a, b) => b.lines - a.lines);
}

// ── Report generation ─────────────────────────────────────────

function generateReport(rootDir: string): string {
  const meta = detectProject(rootDir);
  const files = walkDir(rootDir, rootDir);
  const keyFiles = identifyKeyFiles(files, rootDir);
  const langStats = computeLangStats(files);
  const tree = buildTree(rootDir);
  const totalLines = langStats.reduce((s, l) => s + l.lines, 0);
  const totalFiles = files.length;

  const lines: string[] = [];

  // Header
  lines.push(`# ${meta.name}`);
  lines.push("");
  if (meta.description) {
    lines.push(`> ${meta.description}`);
    lines.push("");
  }
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Type | ${meta.type} |`);
  if (meta.version) lines.push(`| Version | ${meta.version} |`);
  lines.push(`| Total files | ${totalFiles} |`);
  lines.push(`| Total LOC | ${totalLines.toLocaleString()} |`);
  lines.push("");

  // Language breakdown
  lines.push("## Language Breakdown");
  lines.push("");
  lines.push("| Language | Files | Lines | % |");
  lines.push("|----------|------:|------:|--:|");
  for (const lang of langStats) {
    const pct = totalLines > 0 ? ((lang.lines / totalLines) * 100).toFixed(1) : "0.0";
    lines.push(`| ${lang.language} | ${lang.files} | ${lang.lines.toLocaleString()} | ${pct}% |`);
  }
  lines.push("");

  // Directory structure
  lines.push("## Directory Structure");
  lines.push("");
  lines.push("```");
  lines.push(tree);
  lines.push("```");
  lines.push("");

  // Key files
  if (keyFiles.length > 0) {
    lines.push("## Key Files");
    lines.push("");
    lines.push("| File | Role |");
    lines.push("|------|------|");
    for (const kf of keyFiles) {
      lines.push(`| \`${kf.path}\` | ${kf.role} |`);
    }
    lines.push("");
  }

  // Dependencies
  if (meta.dependencies.length > 0) {
    lines.push("## Dependencies");
    lines.push("");
    lines.push("### Runtime");
    lines.push("");
    for (const dep of meta.dependencies) {
      lines.push(`- \`${dep}\``);
    }
    lines.push("");
  }
  if (meta.devDependencies.length > 0) {
    lines.push("### Development");
    lines.push("");
    for (const dep of meta.devDependencies) {
      lines.push(`- \`${dep}\``);
    }
    lines.push("");
  }

  // Scripts
  if (Object.keys(meta.scripts).length > 0) {
    lines.push("## Scripts");
    lines.push("");
    lines.push("| Command | Action |");
    lines.push("|---------|--------|");
    for (const [name, cmd] of Object.entries(meta.scripts)) {
      lines.push(`| \`${name}\` | \`${cmd}\` |`);
    }
    lines.push("");
  }

  // Largest files
  const codeFiles = files.filter(f => LANG_MAP[f.ext] && f.lines > 0);
  codeFiles.sort((a, b) => b.lines - a.lines);
  const top10 = codeFiles.slice(0, 10);
  if (top10.length > 0) {
    lines.push("## Largest Files (by LOC)");
    lines.push("");
    lines.push("| File | Lines | Language |");
    lines.push("|------|------:|----------|");
    for (const f of top10) {
      lines.push(`| \`${f.relativePath}\` | ${f.lines.toLocaleString()} | ${LANG_MAP[f.ext] || "?"} |`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`*Generated by analyze-repo on ${new Date().toISOString().split("T")[0]}*`);

  return lines.join("\n");
}

// ── CLI ───────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let targetDir = process.cwd();
  let outputFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      outputFile = args[++i];
    } else if (!args[i].startsWith("-")) {
      targetDir = path.resolve(args[i]);
    }
  }

  if (!existsSync(targetDir)) {
    console.error(`Error: directory not found: ${targetDir}`);
    process.exit(1);
  }

  const report = generateReport(targetDir);

  if (outputFile) {
    writeFileSync(outputFile, report, "utf-8");
    console.log(`Report written to ${outputFile}`);
  } else {
    console.log(report);
  }
}

main();
