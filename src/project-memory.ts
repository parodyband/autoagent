/**
 * Project Memory — discovers and loads project-level config/memory files.
 *
 * File hierarchy (highest priority last, so they overwrite earlier):
 *   1. ~/.autoagent/memory.md      — global user instructions
 *   2. <project-root>/CLAUDE.md    — project instructions (Claude Code compat)
 *   3. <project-root>/.autoagent.md — AutoAgent-specific project instructions
 *   4. <project-root>/.cursorrules — Cursor compat
 *   5. <cwd>/.autoagent/local.md   — local (gitignored) overrides
 *
 * Discovery:
 *   - Walk UP the directory tree from cwd to find the project root
 *     (presence of .git, package.json, pyproject.toml, go.mod, etc.)
 *   - Read all found files and concatenate into a single memory block
 *
 * Injection:
 *   - Appended to the system prompt as a "## Project Memory" section
 *
 * Write-back:
 *   - `saveToProjectMemory(dir, content)` appends a note to .autoagent.md
 *     in the project root (created if absent).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import os from "os";

// ─── Constants ────────────────────────────────────────────────

/** Markers that indicate we've found the project root */
const ROOT_MARKERS = [
  ".git", "package.json", "pyproject.toml", "go.mod", "Cargo.toml",
  "Makefile", ".autoagent.md", "CLAUDE.md",
];

/** Memory files to look for, in priority order (low → high) */
const MEMORY_FILES: Array<{ relPath: string; label: string }> = [
  { relPath: join(os.homedir(), ".autoagent", "memory.md"), label: "Global memory" },
];

const PROJECT_MEMORY_FILES = [
  { name: "CLAUDE.md", label: "CLAUDE.md" },
  { name: ".autoagent.md", label: ".autoagent.md" },
  { name: ".cursorrules", label: ".cursorrules" },
];

const LOCAL_MEMORY_FILE = join(".autoagent", "local.md");

// ─── Discovery ────────────────────────────────────────────────

/**
 * Walk up the directory tree from `startDir` to find the project root.
 * Returns the first directory that contains a root marker, or `startDir`
 * if no marker is found (fallback to the given directory).
 */
export function findProjectRoot(startDir: string): string {
  let dir = startDir;
  const { root } = { root: "/" }; // Unix root; Windows: drive letter

  for (let i = 0; i < 20; i++) {
    const hasMarker = ROOT_MARKERS.some(m => existsSync(join(dir, m)));
    if (hasMarker) return dir;

    const parent = dirname(dir);
    if (parent === dir || parent === root) break; // reached filesystem root
    dir = parent;
  }

  return startDir; // fallback
}

// ─── Loader ───────────────────────────────────────────────────

export interface MemoryEntry {
  path: string;
  label: string;
  content: string;
}

/**
 * Load all memory files for the given working directory.
 * Returns entries in priority order (global → project → local).
 */
export function loadProjectMemory(workDir: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  const projectRoot = findProjectRoot(workDir);

  // 1. Global memory: ~/.autoagent/memory.md
  for (const { relPath, label } of MEMORY_FILES) {
    if (existsSync(relPath)) {
      const content = readFileSync(relPath, "utf8").trim();
      if (content) entries.push({ path: relPath, label, content });
    }
  }

  // 2. Project-level files (at project root)
  for (const { name, label } of PROJECT_MEMORY_FILES) {
    const filePath = join(projectRoot, name);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8").trim();
      if (content) entries.push({ path: filePath, label, content });
    }
  }

  // 3. Local override: <projectRoot>/.autoagent/local.md
  const localPath = join(projectRoot, LOCAL_MEMORY_FILE);
  if (existsSync(localPath)) {
    const content = readFileSync(localPath, "utf8").trim();
    if (content) entries.push({ path: localPath, label: "Local memory", content });
  }

  return entries;
}

/**
 * Format memory entries as a system-prompt block.
 * Returns empty string if no entries found.
 */
export function formatProjectMemory(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";

  const sections = entries.map(e =>
    `### ${e.label}\n${e.content}`
  ).join("\n\n");

  return `\n\n## Project Memory\n\n${sections}`;
}

/**
 * Convenience: load and format in one call.
 */
export function getProjectMemoryBlock(workDir: string): string {
  const entries = loadProjectMemory(workDir);
  return formatProjectMemory(entries);
}

// ─── Write-back ───────────────────────────────────────────────

/**
 * Append a "remember this" note to <projectRoot>/.autoagent.md.
 * Creates the file (and directory) if it doesn't exist.
 */
export function saveToProjectMemory(workDir: string, note: string): string {
  const projectRoot = findProjectRoot(workDir);
  const filePath = join(projectRoot, ".autoagent.md");

  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const entry = `\n<!-- saved ${timestamp} -->\n${note.trim()}\n`;

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, "utf8");
    writeFileSync(filePath, existing + entry, "utf8");
  } else {
    writeFileSync(filePath, `# AutoAgent Project Memory\n${entry}`, "utf8");
  }

  return filePath;
}

/**
 * Append a note to the LOCAL memory file (<projectRoot>/.autoagent/local.md).
 * This file is intended to be gitignored.
 */
export function saveToLocalMemory(workDir: string, note: string): string {
  const projectRoot = findProjectRoot(workDir);
  const dir = join(projectRoot, ".autoagent");
  const filePath = join(dir, "local.md");

  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const timestamp = new Date().toISOString().split("T")[0];
  const entry = `\n<!-- saved ${timestamp} -->\n${note.trim()}\n`;

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, "utf8");
    writeFileSync(filePath, existing + entry, "utf8");
  } else {
    writeFileSync(filePath, `# AutoAgent Local Memory\n${entry}`, "utf8");
  }

  return filePath;
}
