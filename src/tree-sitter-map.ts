/**
 * Tree-sitter Repo Map — AST-based symbol extraction for TypeScript/JavaScript.
 *
 * Extracts exported symbols and imports from source files using tree-sitter,
 * with regex fallback for non-TS files.
 *
 * Used by: orchestrator.ts (rich repo map in system prompt)
 * Companion to: symbol-index.ts (regex-based, kept for non-TS files)
 */

import { readFileSync } from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// ─── Types ────────────────────────────────────────────────────

export type SymbolKind = "function" | "class" | "interface" | "type" | "const" | "enum";

export interface ParsedSymbol {
  name: string;
  kind: SymbolKind;
  line: number; // 1-indexed
  exported: boolean;
}

export interface ParsedImport {
  names: string[]; // imported names (empty for side-effect imports)
  from: string;    // module specifier
}

export interface ParsedFile {
  path: string;            // relative path
  exports: ParsedSymbol[];
  imports: ParsedImport[];
  parseError?: string;
}

export interface RepoMap {
  files: ParsedFile[];
  builtAt: number; // Date.now()
}

// ─── Tree-sitter setup ───────────────────────────────────────

let _parser: unknown = null;
let _tsLanguage: unknown = null;
let _tsxLanguage: unknown = null;

function getParser(): { parser: unknown; typescript: unknown; tsx: unknown } | null {
  if (_parser) return { parser: _parser, typescript: _tsLanguage, tsx: _tsxLanguage };
  try {
    const Parser = require("tree-sitter");
    const TS = require("tree-sitter-typescript");
    const parser = new Parser();
    _parser = parser;
    _tsLanguage = TS.typescript;
    _tsxLanguage = TS.tsx;
    return { parser, typescript: TS.typescript, tsx: TS.tsx };
  } catch {
    return null;
  }
}

// ─── AST Traversal ───────────────────────────────────────────

type TSNode = {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  children: TSNode[];
  namedChildren: TSNode[];
  childForFieldName(name: string): TSNode | null;
};

type TSTree = { rootNode: TSNode };

function findChildren(node: TSNode, types: string[]): TSNode[] {
  const result: TSNode[] = [];
  for (const child of node.namedChildren) {
    if (types.includes(child.type)) result.push(child);
  }
  return result;
}

function getText(node: TSNode | null): string {
  if (!node) return "";
  return node.text ?? "";
}

function getIdentifier(node: TSNode): string {
  const ident = node.childForFieldName("name") ?? findChildren(node, ["identifier", "type_identifier"])[0];
  return getText(ident);
}

/**
 * Extract exported symbols from a parsed AST tree.
 */
function extractExports(rootNode: TSNode): ParsedSymbol[] {
  const symbols: ParsedSymbol[] = [];
  const seen = new Set<string>();

  function visit(node: TSNode, parentExported = false): void {
    const t = node.type;

    // export statement wrapping a declaration
    if (t === "export_statement") {
      const decl = node.childForFieldName("declaration");
      if (decl) {
        visitDeclaration(decl, true);
      }
      // export { foo, bar }
      const clause = findChildren(node, ["export_clause"])[0];
      if (clause) {
        for (const spec of findChildren(clause, ["export_specifier"])) {
          const name = getText(spec.childForFieldName("name") ?? findChildren(spec, ["identifier"])[0]);
          if (name && !seen.has(name)) {
            seen.add(name);
            symbols.push({ name, kind: "const", line: spec.startPosition.row + 1, exported: true });
          }
        }
      }
      return;
    }

    // top-level declarations (not wrapped in export)
    if (parentExported) visitDeclaration(node, true);

    for (const child of node.namedChildren) {
      visit(child, false);
    }
  }

  function visitDeclaration(node: TSNode, exported: boolean): void {
    const t = node.type;
    let name = "";
    let kind: SymbolKind = "const";

    if (t === "function_declaration" || t === "function_signature") {
      name = getIdentifier(node);
      kind = "function";
    } else if (t === "class_declaration") {
      name = getIdentifier(node);
      kind = "class";
    } else if (t === "interface_declaration") {
      name = getIdentifier(node);
      kind = "interface";
    } else if (t === "type_alias_declaration") {
      name = getIdentifier(node);
      kind = "type";
    } else if (t === "enum_declaration") {
      name = getIdentifier(node);
      kind = "enum";
    } else if (t === "lexical_declaration" || t === "variable_declaration") {
      // const/let/var — grab all declarators
      for (const decl of findChildren(node, ["variable_declarator"])) {
        const n = getText(decl.childForFieldName("name") ?? findChildren(decl, ["identifier"])[0]);
        if (n && !seen.has(n)) {
          seen.add(n);
          symbols.push({ name: n, kind: "const", line: decl.startPosition.row + 1, exported });
        }
      }
      return;
    } else if (t === "abstract_class_declaration") {
      name = getIdentifier(node);
      kind = "class";
    }

    if (name && !seen.has(name)) {
      seen.add(name);
      symbols.push({ name, kind, line: node.startPosition.row + 1, exported });
    }
  }

  for (const child of rootNode.namedChildren) {
    visit(child);
  }

  return symbols;
}

/**
 * Extract import statements from a parsed AST tree.
 */
function extractImports(rootNode: TSNode): ParsedImport[] {
  const imports: ParsedImport[] = [];

  for (const node of rootNode.namedChildren) {
    if (node.type !== "import_statement") continue;

    const sourceNode = node.childForFieldName("source");
    const from = sourceNode ? getText(sourceNode).replace(/['"]/g, "") : "";
    const names: string[] = [];

    // import clause: default + named
    const clause = node.childForFieldName("import_clause");
    if (clause) {
      // default import: import Foo from '...'
      const defaultIdent = findChildren(clause, ["identifier"])[0];
      if (defaultIdent) names.push(getText(defaultIdent));

      // named imports: import { foo, bar } from '...'
      const namedImports = findChildren(clause, ["named_imports"])[0];
      if (namedImports) {
        for (const spec of findChildren(namedImports, ["import_specifier"])) {
          const n = spec.childForFieldName("name") ?? findChildren(spec, ["identifier"])[0];
          if (n) names.push(getText(n));
        }
      }

      // namespace import: import * as Foo from '...'
      const ns = findChildren(clause, ["namespace_import"])[0];
      if (ns) {
        const n = findChildren(ns, ["identifier"])[0];
        if (n) names.push("* as " + getText(n));
      }
    }

    imports.push({ names, from });
  }

  return imports;
}

// ─── Regex fallback ──────────────────────────────────────────

const REGEX_EXPORT_PATTERNS: Array<{ re: RegExp; kind: SymbolKind }> = [
  { re: /^export\s+(?:async\s+)?function\s+(\w+)/, kind: "function" },
  { re: /^export\s+const\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|function\b)/, kind: "function" },
  { re: /^export\s+(?:abstract\s+)?class\s+(\w+)/, kind: "class" },
  { re: /^export\s+interface\s+(\w+)/, kind: "interface" },
  { re: /^export\s+type\s+(\w+)\s*[=<{]/, kind: "type" },
  { re: /^export\s+enum\s+(\w+)/, kind: "enum" },
  { re: /^export\s+const\s+(\w+)/, kind: "const" },
];

const REGEX_IMPORT_PATTERN = /^import\s+(?:type\s+)?(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))(?:\s*,\s*(?:{([^}]+)}|\*\s+as\s+(\w+)))?.*?from\s+['"]([^'"]+)['"]/;

function parseFileRegex(filePath: string): ParsedFile {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (e) {
    return { path: filePath, exports: [], imports: [], parseError: String(e) };
  }

  const lines = content.split("\n");
  const exports: ParsedSymbol[] = [];
  const imports: ParsedImport[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // exports
    for (const { re, kind } of REGEX_EXPORT_PATTERNS) {
      const m = re.exec(line);
      if (m) {
        const name = m[1];
        if (!seen.has(name)) {
          seen.add(name);
          exports.push({ name, kind, line: i + 1, exported: true });
        }
        break;
      }
    }

    // imports
    const im = REGEX_IMPORT_PATTERN.exec(line);
    if (im) {
      const names: string[] = [];
      if (im[1]) names.push(...im[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean));
      if (im[2]) names.push(im[2]);
      if (im[3]) names.push("* as " + im[3]);
      if (im[4]) names.push(...im[4].split(",").map((s) => s.trim()).filter(Boolean));
      if (im[5]) names.push("* as " + im[5]);
      const from = im[6];
      if (from) imports.push({ names, from });
    }
  }

  return { path: filePath, exports, imports };
}

// ─── Public API ──────────────────────────────────────────────

const TS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

/**
 * Parse a single file and extract its exported symbols + imports.
 * Uses tree-sitter for TS/JS files; regex fallback otherwise.
 */
export function parseFile(filePath: string): ParsedFile {
  const ext = path.extname(filePath).toLowerCase();
  if (!TS_EXTS.has(ext)) {
    return parseFileRegex(filePath);
  }

  const setup = getParser();
  if (!setup) {
    // tree-sitter unavailable — use regex fallback
    return parseFileRegex(filePath);
  }

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (e) {
    return { path: filePath, exports: [], imports: [], parseError: String(e) };
  }

  try {
    const { parser, typescript, tsx } = setup as {
      parser: { setLanguage(l: unknown): void; parse(s: string): TSTree };
      typescript: unknown;
      tsx: unknown;
    };

    const lang = ext === ".tsx" || ext === ".jsx" ? tsx : typescript;
    parser.setLanguage(lang);
    const tree = parser.parse(content);

    const exports = extractExports(tree.rootNode);
    const imports = extractImports(tree.rootNode);
    return { path: filePath, exports, imports };
  } catch (e) {
    // Fall back to regex on parse error
    const fallback = parseFileRegex(filePath);
    fallback.parseError = `tree-sitter failed: ${e}; used regex fallback`;
    return fallback;
  }
}

/**
 * Build a repo map by parsing all given files.
 * @param workDir - root directory (used for display paths)
 * @param files   - absolute or relative paths to parse
 */
export function buildRepoMap(workDir: string, files: string[]): RepoMap {
  const parsedFiles: ParsedFile[] = files.map((f) => {
    const absPath = path.isAbsolute(f) ? f : path.join(workDir, f);
    const parsed = parseFile(absPath);
    // Store relative path for display
    parsed.path = path.relative(workDir, absPath);
    return parsed;
  });

  return { files: parsedFiles, builtAt: Date.now() };
}

/**
 * Rank exported symbols by how many files import them (in-degree count).
 *
 * @param repoMap - the repo map to analyze
 * @returns Map<symbolName, score> — only exported symbols, score = number of
 *          files that import the symbol (0 if never imported)
 */
export function rankSymbols(repoMap: RepoMap): Map<string, number> {
  // Build a map from exported symbol name → count of files importing it
  const scores = new Map<string, number>();

  // Initialize all exported symbols with score 0
  for (const file of repoMap.files) {
    for (const sym of file.exports) {
      if (sym.exported && !scores.has(sym.name)) {
        scores.set(sym.name, 0);
      }
    }
  }

  // For each file's imports, increment scores for matching exported symbols
  for (const file of repoMap.files) {
    for (const imp of file.imports) {
      for (const name of imp.names) {
        // Strip "* as X" namespace imports down to the alias, skip counting
        if (name.startsWith("* as ")) continue;
        if (scores.has(name)) {
          scores.set(name, (scores.get(name) ?? 0) + 1);
        }
      }
    }
  }

  return scores;
}

/**
 * Compute the aggregate rank score for a file (sum of its exported symbol scores).
 */
function fileAggregateScore(file: ParsedFile, ranked: Map<string, number>): number {
  let total = 0;
  for (const sym of file.exports) {
    if (sym.exported) total += ranked.get(sym.name) ?? 0;
  }
  return total;
}

/**
 * Format a RepoMap as a compact string suitable for LLM context.
 *
 * Output format:
 *   src/foo.ts
 *     exports: Foo (class:10), bar (function:25), MyType (type:5)
 *     imports: react, ./utils
 *
 * When `ranked` is provided, files are sorted by their aggregate symbol score
 * (highest first) and symbols within each file are also sorted by score.
 */
export function formatRepoMap(
  repoMap: RepoMap,
  opts?: { onlyExported?: boolean; maxFiles?: number; ranked?: Map<string, number> }
): string {
  const onlyExported = opts?.onlyExported ?? true;
  const maxFiles = opts?.maxFiles ?? 200;
  const ranked = opts?.ranked;

  const lines: string[] = ["# Repo Map"];

  let files = repoMap.files.filter((file) => {
    const relevantExports = onlyExported ? file.exports.filter((s) => s.exported) : file.exports;
    return relevantExports.length > 0 || file.imports.length > 0;
  });

  // Sort files by aggregate rank score (highest first) when ranked map is provided
  if (ranked) {
    files = [...files].sort((a, b) => {
      const sa = fileAggregateScore(a, ranked);
      const sb = fileAggregateScore(b, ranked);
      if (sb !== sa) return sb - sa;
      return a.path.localeCompare(b.path); // stable tie-break
    });
  }

  for (const file of files.slice(0, maxFiles)) {
    let relevantExports = onlyExported ? file.exports.filter((s) => s.exported) : file.exports;

    lines.push(file.path);

    if (relevantExports.length > 0) {
      // Sort by rank (highest first) if ranked map provided
      if (ranked) {
        relevantExports = [...relevantExports].sort((a, b) => {
          const sa = ranked.get(a.name) ?? 0;
          const sb = ranked.get(b.name) ?? 0;
          if (sb !== sa) return sb - sa;
          return a.name.localeCompare(b.name); // stable tie-break
        });
      }

      const symStr = relevantExports
        .map((s) => {
          const score = ranked?.get(s.name) ?? 0;
          const suffix = ranked && score >= 2 ? ` (×${score})` : "";
          return `${s.name}${suffix} (${s.kind}:${s.line})`;
        })
        .join(", ");
      lines.push(`  exports: ${symStr}`);
    }

    if (file.imports.length > 0) {
      const fromList = [...new Set(file.imports.map((i) => i.from))].join(", ");
      lines.push(`  imports: ${fromList}`);
    }
  }

  return lines.join("\n");
}

/**
 * Truncate a formatted repo map string to fit within a token budget.
 *
 * Uses the heuristic: 1 token ≈ 4 characters.
 * Drops complete file sections from the bottom (lowest-ranked appear last
 * when formatRepoMap is called with `ranked`), so the highest-value symbols
 * are preserved.
 *
 * @param map       - formatted repo map string (output of formatRepoMap)
 * @param maxTokens - token budget (default 4000 → ~16K chars)
 * @returns         - truncated map string, with trailing note if cut
 */
export function truncateRepoMap(map: string, maxTokens = 4000): string {
  const maxChars = maxTokens * 4;
  if (map.length <= maxChars) return map;

  // Split into header + file sections
  // Each file section starts with a line that doesn't begin with whitespace or '#'
  const allLines = map.split("\n");
  const header: string[] = [];
  const sections: string[][] = [];
  let current: string[] | null = null;

  for (const line of allLines) {
    if (line.startsWith("#")) {
      header.push(line);
    } else if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
      // New file section
      current = [line];
      sections.push(current);
    } else if (current) {
      current.push(line);
    } else {
      header.push(line);
    }
  }

  // Greedily include sections until we hit the budget
  const headerStr = header.join("\n");
  let result = headerStr;
  let included = 0;

  for (const section of sections) {
    const sectionStr = "\n" + section.join("\n");
    if (result.length + sectionStr.length > maxChars) break;
    result += sectionStr;
    included++;
  }

  const omitted = sections.length - included;
  if (omitted > 0) {
    result += `\n… (${omitted} more file${omitted === 1 ? "" : "s"} omitted — token budget ${maxTokens})`;
  }

  return result;
}

// ─── Fuzzy Search ─────────────────────────────────────────────

export interface SearchResult {
  file: string;        // relative path
  symbol?: string;     // undefined = file match only
  kind?: string;       // 'function' | 'class' | 'interface' etc.
  line?: number;
  score: number;       // match quality 0–1
}

/**
 * Subsequence match score: how well `query` matches `target` as a subsequence.
 * Returns 0 if not a subsequence match. Returns 0–1 for quality.
 *
 * Scoring heuristics (fzf-like):
 * - Base: proportion of query chars matched (always 1.0 if subsequence)
 * - Bonus for consecutive chars matched
 * - Bonus for prefix match (query starts at target start)
 * - Bonus for shorter targets (tighter match)
 */
function subsequenceScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (q.length === 0) return 0;
  if (q.length > t.length) return 0;

  // Check if q is a subsequence of t, tracking positions
  const positions: number[] = [];
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      positions.push(ti);
      qi++;
    }
  }
  if (qi < q.length) return 0; // not a subsequence

  // Base score
  let score = 0.4;

  // Consecutive bonus: fraction of consecutive pairs
  let consecutiveCount = 0;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] === positions[i - 1] + 1) consecutiveCount++;
  }
  if (positions.length > 1) {
    score += 0.3 * (consecutiveCount / (positions.length - 1));
  } else {
    score += 0.3; // single char — treat as fully consecutive
  }

  // Prefix bonus
  if (positions[0] === 0) {
    score += 0.15;
  }

  // Tight match bonus (query covers most of target)
  score += 0.15 * (q.length / t.length);

  return Math.min(score, 1.0);
}

/**
 * Fuzzy search across files and symbols in a repo map.
 *
 * @param repoMap - the repo map to search
 * @param query - search string (matched as subsequence)
 * @param maxResults - max results to return (default 20)
 */
export function fuzzySearch(repoMap: RepoMap, query: string, maxResults = 20): SearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const q = query.trim();
  const results: SearchResult[] = [];

  for (const file of repoMap.files) {
    // Score file path (use basename for primary match, full path as tiebreaker)
    const basename = file.path.split("/").pop() ?? file.path;
    const fileScore = Math.max(
      subsequenceScore(q, basename),
      subsequenceScore(q, file.path) * 0.8 // slight penalty for full-path match
    );
    if (fileScore > 0) {
      results.push({ file: file.path, score: fileScore });
    }

    // Score each exported symbol
    for (const sym of file.exports) {
      const symScore = subsequenceScore(q, sym.name);
      if (symScore > 0) {
        results.push({
          file: file.path,
          symbol: sym.name,
          kind: sym.kind,
          line: sym.line,
          score: symScore,
        });
      }
    }
  }

  // Sort by score descending, then by file path for stability
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.file.localeCompare(b.file);
  });

  return results.slice(0, maxResults);
}
