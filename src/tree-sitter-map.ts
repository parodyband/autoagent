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
 * Format a RepoMap as a compact string suitable for LLM context.
 *
 * Output format:
 *   src/foo.ts
 *     exports: Foo (class:10), bar (function:25), MyType (type:5)
 *     imports: react, ./utils
 */
export function formatRepoMap(
  repoMap: RepoMap,
  opts?: { onlyExported?: boolean; maxFiles?: number; ranked?: Map<string, number> }
): string {
  const onlyExported = opts?.onlyExported ?? true;
  const maxFiles = opts?.maxFiles ?? 200;
  const ranked = opts?.ranked;

  const lines: string[] = ["# Repo Map"];

  const files = repoMap.files.slice(0, maxFiles);
  for (const file of files) {
    let relevantExports = onlyExported ? file.exports.filter((s) => s.exported) : file.exports;
    // Skip files with no exports and no imports (probably empty or non-source)
    if (relevantExports.length === 0 && file.imports.length === 0) continue;

    lines.push(file.path);

    if (relevantExports.length > 0) {
      // Sort by rank (highest first) if ranked map provided
      if (ranked) {
        relevantExports = [...relevantExports].sort((a, b) => {
          const sa = ranked.get(a.name) ?? 0;
          const sb = ranked.get(b.name) ?? 0;
          return sb - sa;
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
