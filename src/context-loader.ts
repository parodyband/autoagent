/**
 * Query-aware context loading.
 *
 * Before the first LLM call, extract keywords from the user message,
 * fuzzy-search the repo map for relevant files, and return their contents
 * as a formatted string to prepend as context.
 *
 * Also supports explicit #file mentions in user messages.
 */

import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";
import type { RepoMap } from "./tree-sitter-map.js";
import { fuzzySearch, findFilesBySymbol } from "./tree-sitter-map.js";

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "has",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
  "how", "its", "may", "new", "now", "old", "see", "two", "who", "did",
  "she", "use", "way", "will", "with", "have", "from", "this", "that",
  "file", "code", "make", "into", "then", "want", "just", "need", "like",
  "also", "more", "than", "some", "what", "when", "where", "which", "there",
  "their", "them", "been", "they", "were", "each", "about", "edit", "add",
  "fix", "run", "put", "set", "let", "try", "via", "any", "help",
]);

const MAX_CONTEXT_CHARS = 48_000; // ~12000 tokens
const MAX_FILES = 5;
const MAX_LINES_PER_FILE = 500;

/** Budget cap for #file auto-loading (same as query-aware loading). */
const FILE_REF_BUDGET = 32_000;

/**
 * Extract explicit #file references from a user message.
 * Matches patterns like #src/foo.ts, #package.json, #path/to/file.ext
 * Only returns paths that exist on disk (relative to workDir).
 *
 * @param message - raw user message
 * @param workDir - working directory to resolve relative paths
 * @returns array of resolved absolute paths that exist
 */
export function extractFileReferences(message: string, workDir: string): string[] {
  // Match #<path> — path can contain letters, digits, /, ., -, _
  const regex = /#([\w./\-]+)/g;
  const seen = new Set<string>();
  const results: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    const rawPath = match[1];
    // Resolve relative to workDir
    const absPath = rawPath.startsWith("/")
      ? rawPath
      : resolve(workDir, rawPath);

    if (seen.has(absPath)) continue;
    seen.add(absPath);

    if (existsSync(absPath)) {
      results.push(absPath);
    }
    // Non-existent paths are silently skipped
  }

  return results;
}

/**
 * Strip #file references from a user message, returning clean text.
 * e.g. "look at #src/foo.ts and fix it" → "look at src/foo.ts and fix it"
 */
export function stripFileReferences(message: string): string {
  return message.replace(/#([\w./\-]+)/g, "$1");
}

/**
 * Load contents of explicitly-referenced files (from #file mentions),
 * respecting a char budget. Returns formatted context block or empty string.
 *
 * @param filePaths - absolute paths to load (pre-filtered to existing files)
 * @param workDir - working directory (for display paths)
 */
export function loadFileReferences(filePaths: string[], workDir: string): string {
  if (filePaths.length === 0) return "";

  const sections: string[] = [];
  let totalChars = 0;

  for (const absPath of filePaths) {
    if (totalChars >= FILE_REF_BUDGET) break;

    let contents: string;
    try {
      contents = readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }

    // Relative path for display
    const displayPath = absPath.startsWith(workDir)
      ? absPath.slice(workDir.length + 1)
      : absPath;

    const section = `--- file: ${displayPath} ---\n${contents}\n`;
    const remaining = FILE_REF_BUDGET - totalChars;

    if (section.length > remaining) {
      sections.push(section.slice(0, remaining) + "\n(... budget truncated)");
      totalChars = FILE_REF_BUDGET;
      break;
    }

    sections.push(section);
    totalChars += section.length;
  }

  if (sections.length === 0) return "";
  return `[Referenced files]\n\n${sections.join("\n")}`;
}

/**
 * Extract meaningful keywords from a user message.
 * Splits on non-word chars, filters stopwords, deduplicates, takes words ≥ 3 chars.
 */
export function extractKeywords(message: string): string[] {
  const words = message
    .split(/\W+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  // Deduplicate while preserving order
  return [...new Set(words)];
}

/** Maximum number of git-changed files to prioritize in context. */
const MAX_GIT_FILES = 3;

/** Maximum number of git-log files (recent commits) to include as second-tier context. */
const MAX_GIT_LOG_FILES = 5;

/** Binary file extensions to skip when loading context. */
const BINARY_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "ico", "svg", "woff", "woff2", "ttf", "eot",
  "pdf", "zip", "gz", "tar", "bz2", "7z", "rar", "exe", "bin", "dll", "so",
  "dylib", "class", "pyc", "o", "a", "lib",
]);

/** Extensions that are never useful for AI context. */
const NON_SOURCE_EXTS = new Set([
  "lock", "json", "md", "yaml", "yml", "toml", "ini", "cfg", "conf",
  "txt", "log", "csv", "env", "gitignore", "dockerignore",
]);

/**
 * Filter a list of git-changed file paths to only those present in the repo
 * map, removing lock files, JSON configs, markdown, and other non-source files.
 *
 * @param files - raw list of relative file paths from git
 * @param repoMapFiles - set of relative paths indexed in the repo map
 */
export function filterByRepoMap(files: string[], repoMapFiles: Set<string>): string[] {
  return files.filter(f => {
    // Always exclude by extension unless it's in the repo map
    const ext = f.split(".").pop()?.toLowerCase() ?? "";
    if (NON_SOURCE_EXTS.has(ext) && !repoMapFiles.has(f)) return false;
    // If repo map is non-empty, require file to be indexed
    if (repoMapFiles.size > 0 && !repoMapFiles.has(f)) return false;
    return true;
  });
}

/**
 * Return file paths touched in recent git commits (git log --name-only).
 * Deduplicates results and filters binary/non-existent files.
 *
 * @param workDir - the working directory to run git in
 * @param limit - number of commits to inspect (default 3)
 */
export function getRecentCommitFiles(workDir: string, limit: number = 3): string[] {
  try {
    const output = execSync(
      `git -C ${JSON.stringify(workDir)} log --oneline -${limit} --name-only`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (!output) return [];

    const seen = new Set<string>();
    const result: string[] = [];

    for (const line of output.split("\n")) {
      const f = line.trim();
      if (!f) continue;
      // Skip commit summary lines (they start with a short hash — contain spaces)
      if (f.includes(" ")) continue;
      if (seen.has(f)) continue;
      seen.add(f);

      // Filter binary extensions
      const ext = f.split(".").pop()?.toLowerCase() ?? "";
      if (BINARY_EXTS.has(ext)) continue;

      // Only include files that exist on disk
      const absPath = join(workDir, f);
      if (existsSync(absPath)) {
        result.push(f);
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Return recently-changed file paths from `git diff` (unstaged + staged).
 * Returns an empty array if not in a git repo or no changes are found.
 * Binary files and missing files are silently filtered out.
 *
 * @param workDir - the working directory to run git in
 * @param knownFiles - optional set of repo-map-indexed paths to filter against
 */
export function getRecentlyChangedFiles(workDir: string, knownFiles?: Set<string>): string[] {
  try {
    const run = (args: string) =>
      execSync(`git -C ${JSON.stringify(workDir)} ${args}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });

    const unstaged = run("diff --name-only").trim();
    const staged = run("diff --cached --name-only").trim();

    const seen = new Set<string>();
    const result: string[] = [];

    for (const line of [...unstaged.split("\n"), ...staged.split("\n")]) {
      const f = line.trim();
      if (!f || seen.has(f)) continue;
      seen.add(f);

      // Skip binary-looking files (no extension or known binary exts)
      const ext = f.split(".").pop() ?? "";
      const binaryExts = new Set(["png", "jpg", "jpeg", "gif", "ico", "svg", "woff", "woff2", "ttf", "eot", "pdf", "zip", "gz", "tar"]);
      if (binaryExts.has(ext.toLowerCase())) continue;

      // Only include files that still exist on disk
      const absPath = join(workDir, f);
      if (existsSync(absPath)) {
        result.push(f);
      }
    }

    // Apply repo-map filter if provided
    if (knownFiles && knownFiles.size > 0) {
      return filterByRepoMap(result, knownFiles);
    }

    return result;
  } catch {
    // Not a git repo, or git not available
    return [];
  }
}

/**
 * Look up files by exact symbol name match in the repo map.
 *
 * Returns files whose exported symbols match any of the given keywords
 * (case-sensitive exact match). This is the highest-priority tier — if a
 * keyword is a known symbol name, we want the defining file immediately.
 *
 * @param keywords - extracted keywords from user message
 * @param repoMap - current repo map with symbol index
 * @returns de-duplicated array of file paths ordered by symbol kind priority
 */
export function symbolLookup(keywords: string[], repoMap: RepoMap): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const kw of keywords) {
    for (const filePath of findFilesBySymbol(repoMap, kw)) {
      if (!seen.has(filePath)) {
        seen.add(filePath);
        results.push(filePath);
      }
    }
  }
  return results;
}

export function autoLoadContext(
  repoMap: RepoMap,
  userMessage: string,
  workDir: string,
  alreadyMentioned: Set<string> = new Set(),
): string {
  if (!repoMap || repoMap.files.length === 0) return "";

  const keywords = extractKeywords(userMessage);
  if (keywords.length === 0) return "";

  // --- Tier 0: Symbol-matched files (highest priority) ---
  // If the user mentioned a known symbol name, load its defining file first.
  const symbolMatched = symbolLookup(keywords, repoMap)
    .filter(p => !alreadyMentioned.has(p));

  // --- Tier 1: Git-changed files (unstaged/staged) ---
  const repoMapFileSet = new Set(repoMap.files.map(f => f.path));
  const gitChanged = getRecentlyChangedFiles(workDir, repoMapFileSet)
    .filter(p => !alreadyMentioned.has(p) && !symbolMatched.includes(p))
    .slice(0, MAX_GIT_FILES);

  // --- Tier 2: Recently committed files (git log) ---
  const gitLogFiles = getRecentCommitFiles(workDir, 3)
    .filter(p => !alreadyMentioned.has(p) && !symbolMatched.includes(p) && !gitChanged.includes(p))
    .slice(0, MAX_GIT_LOG_FILES);

  // --- Tier 3: Keyword-matched files ---
  const gitTierSet = new Set([...symbolMatched, ...gitChanged, ...gitLogFiles]);

  // Count keyword hits per file path
  const hitCounts = new Map<string, number>();
  for (const keyword of keywords) {
    const results = fuzzySearch(repoMap, keyword, 30);
    for (const r of results) {
      hitCounts.set(r.file, (hitCounts.get(r.file) ?? 0) + 1);
    }
  }

  // Sort keyword-matched files by hit count descending
  const keywordRanked = [...hitCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([path]) => path)
    .filter(p => !alreadyMentioned.has(p) && !gitTierSet.has(p));

  // Merge: symbol → git-diff → git-log → keyword results, capped at MAX_FILES total
  const ranked = [...symbolMatched, ...gitChanged, ...gitLogFiles, ...keywordRanked].slice(0, MAX_FILES);

  if (ranked.length === 0) return "";

  const sections: string[] = [];
  let totalChars = 0;

  for (const filePath of ranked) {
    if (totalChars >= MAX_CONTEXT_CHARS) break;

    let contents: string;
    try {
      const absPath = filePath.startsWith("/") ? filePath : join(workDir, filePath);
      const raw = readFileSync(absPath, "utf-8");
      const lines = raw.split("\n");
      const truncatedLines = lines.slice(0, MAX_LINES_PER_FILE);
      contents = truncatedLines.join("\n");
      if (lines.length > MAX_LINES_PER_FILE) {
        contents += `\n(... truncated at ${MAX_LINES_PER_FILE} lines)`;
      }
    } catch {
      continue; // skip unreadable files
    }

    // Budget check — truncate if needed
    const remaining = MAX_CONTEXT_CHARS - totalChars;
    const section = `--- file: ${filePath} ---\n${contents}\n`;
    if (section.length > remaining) {
      sections.push(section.slice(0, remaining) + "\n(... budget truncated)");
      totalChars = MAX_CONTEXT_CHARS;
      break;
    }
    sections.push(section);
    totalChars += section.length;
  }

  if (sections.length === 0) return "";
  return `[Auto-loaded context]\n\n${sections.join("\n")}`;
}

/**
 * Resolve the import graph for a given file up to `depth` levels deep.
 *
 * Parses `import ... from "./foo.js"` and `require("./bar")` patterns.
 * Only follows relative imports (skips node_modules).
 * Returns a deduplicated list of resolved absolute file paths.
 *
 * @param filePath - absolute or relative path of the entry file
 * @param depth    - how many levels of imports to follow (default: 2)
 * @param workDir  - working directory for resolving relative paths (default: process.cwd())
 */
export function resolveImportGraph(
  filePath: string,
  depth: number = 2,
  workDir: string = process.cwd(),
): string[] {
  const absEntry = filePath.startsWith("/") ? filePath : join(workDir, filePath);
  const seen = new Set<string>();
  const result: string[] = [];

  function visit(absPath: string, remaining: number): void {
    if (seen.has(absPath) || remaining <= 0) return;
    seen.add(absPath);

    let src: string;
    try {
      src = readFileSync(absPath, "utf-8");
    } catch {
      return;
    }

    // Match: import ... from "./foo.js"  OR  require("./bar")
    const importRe = /(?:import\s+[\s\S]*?from\s+|require\s*\(\s*)["'](\.[^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(src)) !== null) {
      const rawSpecifier = m[1];
      // Resolve candidate — try exact path, then common TS/JS extensions
      const resolved = resolveSpecifier(rawSpecifier, absPath);
      if (!resolved) continue;
      if (!seen.has(resolved)) {
        result.push(resolved);
      }
      visit(resolved, remaining - 1);
    }
  }

  visit(absEntry, depth);
  return result;
}

/** Attempt to resolve an import specifier to an existing file on disk. */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  const dir = fromFile.replace(/\/[^/]+$/, ""); // dirname
  const base = join(dir, specifier);

  // Try: exact path, strip .js → .ts, add .ts, add /index.ts
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    base.replace(/\.js$/, ".tsx"),
    base + ".ts",
    base + ".tsx",
    base + ".js",
    join(base, "index.ts"),
    join(base, "index.js"),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}


/**
 * Reverse import lookup: find all files that import the given target path.
 *
 * @param targetPath - absolute or relative path of the target file
 * @param workDir    - project working directory
 * @param knownFiles - optional pre-computed file list (absolute paths)
 * @returns array of absolute paths of files that import targetPath
 */
export function getImporters(
  targetPath: string,
  workDir: string,
  knownFiles?: string[],
): string[] {
  const absTarget = targetPath.startsWith("/") ? targetPath : join(workDir, targetPath);

  // Get file list from git if not provided
  let files = knownFiles;
  if (!files) {
    try {
      const raw = execSync("git ls-files", { cwd: workDir, encoding: "utf-8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] });
      files = raw.split("\n").filter(Boolean).map(f => join(workDir, f));
    } catch {
      return [];
    }
  }

  // Filter to source files
  const sourceExts = /\.(ts|tsx|js|jsx)$/;
  const sourceFiles = files.filter(f => sourceExts.test(f));

  const importRe = /(?:import\s+[\s\S]*?from\s+|require\s*\(\s*)["'](\.[^"']+)["']/g;
  const importers: string[] = [];

  for (const filePath of sourceFiles) {
    if (filePath === absTarget) continue;
    let src: string;
    try {
      src = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    let m: RegExpExecArray | null;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(src)) !== null) {
      const resolved = resolveSpecifier(m[1], filePath);
      if (resolved === absTarget) {
        importers.push(filePath);
        break;
      }
    }
  }

  return importers;
}
