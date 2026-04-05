/**
 * Symbol Index — regex-based symbol extraction for repo map generation.
 *
 * Extracts function/class/type definitions from source files and scores
 * files by how many other files reference their exports.
 *
 * Used by file-ranker.ts (bonus scoring) and orchestrator.ts (repo map in system prompt).
 * No external dependencies — pure regex + sync I/O.
 */

import { readFileSync } from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────

export interface Symbol {
  name: string;
  kind: "function" | "class" | "type";
  file: string;   // relative path (as passed to buildSymbolIndex)
  line: number;   // 1-indexed
}

export type SymbolIndex = Map<string, Symbol[]>;  // file (relative) → symbols

// ─── Regex patterns ───────────────────────────────────────────

// TypeScript / JavaScript / TSX / JSX
const TS_PATTERNS: Array<{ re: RegExp; kind: Symbol["kind"] }> = [
  // export function foo( / function foo(
  { re: /^(?:export\s+)?(?:export\s+default\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]/, kind: "function" },
  // export const foo = ( or = async ( or = function
  { re: /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|function\b)/, kind: "function" },
  // export class Foo / abstract class Foo
  { re: /^(?:export\s+)?(?:export\s+default\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: "class" },
  // export interface Foo / interface Foo
  { re: /^(?:export\s+)?interface\s+(\w+)/, kind: "type" },
  // export type Foo = / type Foo =
  { re: /^(?:export\s+)?type\s+(\w+)\s*[=<]/, kind: "type" },
];

// Python
const PY_PATTERNS: Array<{ re: RegExp; kind: Symbol["kind"] }> = [
  { re: /^def\s+(\w+)\s*\(/, kind: "function" },
  { re: /^class\s+(\w+)/, kind: "class" },
];

// ─── Core functions ───────────────────────────────────────────

/**
 * Extract symbols from a single file using regex.
 * filePath should be absolute (for reading), file stored as provided.
 */
export function extractSymbols(filePath: string): Symbol[] {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const ext = path.extname(filePath).toLowerCase();
  const isTS = [".ts", ".tsx", ".js", ".jsx"].includes(ext);
  const isPY = ext === ".py";

  if (!isTS && !isPY) return [];

  const patterns = isTS ? TS_PATTERNS : PY_PATTERNS;
  const lines = content.split("\n");
  const symbols: Symbol[] = [];
  const seen = new Set<string>(); // deduplicate by name

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const { re, kind } of patterns) {
      const m = re.exec(line);
      if (m) {
        const name = m[1];
        // Skip private/internal names (starting with _) and short names
        if (name.startsWith("_") || name.length < 2) continue;
        // Deduplicate — keep first occurrence
        if (seen.has(name)) continue;
        seen.add(name);
        symbols.push({ name, kind, file: filePath, line: i + 1 });
        break; // only one pattern per line
      }
    }
  }

  return symbols;
}

/**
 * Build a symbol index for the given files.
 * @param dir  - root directory (used to construct absolute paths for reading)
 * @param files - relative paths (used as map keys and stored in Symbol.file)
 */
export function buildSymbolIndex(dir: string, files: string[]): SymbolIndex {
  const index: SymbolIndex = new Map();

  for (const relPath of files) {
    const absPath = path.isAbsolute(relPath) ? relPath : path.join(dir, relPath);
    const symbols = extractSymbols(absPath);
    // Remap file to relative path for cleaner keys
    const remapped = symbols.map(s => ({ ...s, file: relPath }));
    index.set(relPath, remapped);
  }

  return index;
}

/**
 * Score files by how many other files reference their exported symbols.
 * Files with symbols referenced in 2+ other files are considered "highly referenced".
 *
 * @param index - symbol index (relative path keys)
 * @param dir   - root directory for reading file contents
 * @returns Map<relPath, referenceScore> — only files with score > 0 are included
 */
export function scoreByReferences(index: SymbolIndex, dir: string): Map<string, number> {
  // Read all file contents once
  const fileContents = new Map<string, string>();
  for (const relPath of index.keys()) {
    try {
      const absPath = path.isAbsolute(relPath) ? relPath : path.join(dir, relPath);
      fileContents.set(relPath, readFileSync(absPath, "utf-8"));
    } catch {
      fileContents.set(relPath, "");
    }
  }

  const scores = new Map<string, number>();

  for (const [definingFile, symbols] of index.entries()) {
    if (symbols.length === 0) continue;

    let maxRefs = 0;

    for (const sym of symbols) {
      // Skip very common short names that would cause false positives
      if (sym.name.length < 3) continue;

      // Count how many other files reference this symbol name
      let refCount = 0;
      for (const [otherFile, content] of fileContents.entries()) {
        if (otherFile === definingFile) continue;
        if (content.includes(sym.name)) refCount++;
      }

      if (refCount > maxRefs) maxRefs = refCount;
    }

    // Files with symbols referenced in 2+ other files get a bonus
    if (maxRefs >= 2) {
      scores.set(definingFile, maxRefs);
    }
  }

  return scores;
}

/**
 * Format the symbol index as a compact repo map string for injection into system prompt.
 * Output:
 *   src/orchestrator.ts: send(), compactContext(), routeModel()
 *   src/tui.tsx: App(), StreamingMessage(), Footer()
 *
 * @param index  - symbol index
 * @param topN   - max number of files to include (default: 20)
 */
export function formatRepoMap(index: SymbolIndex, topN: number = 20): string {
  const lines: string[] = [];

  let count = 0;
  for (const [file, symbols] of index.entries()) {
    if (symbols.length === 0) continue;
    if (count >= topN) break;

    const parts = symbols.slice(0, 8).map(s => {
      if (s.kind === "function") return `${s.name}()`;
      return s.name;
    });

    lines.push(`${file}: ${parts.join(", ")}`);
    count++;
  }

  if (lines.length === 0) return "";
  return "## Repo Map\n\n" + lines.join("\n");
}
