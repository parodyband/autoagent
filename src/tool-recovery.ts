/**
 * Tool Error Recovery with Suggestions
 *
 * When tools fail, enhance raw error messages with actionable recovery hints:
 * - File not found → fuzzy-match similar filenames
 * - Bash command not found → suggest npx prefix
 * - Bash timeout → suggest breaking into smaller commands
 * - Grep no matches → suggest case-insensitive search
 * - Permission denied → suggest chmod or check ownership
 * - Port in use (EADDRINUSE) → suggest lsof -i :PORT
 * - Out of memory → suggest reducing scope
 * - JSON syntax error → suggest trailing comma / missing quote fixes
 * - Module not found → suggest npm install or check import path
 */

import * as fs from "fs";
import * as path from "path";

export interface RecoveryHint {
  error: string;
  suggestion: string;
  alternatives?: string[];
}

// ─── Fuzzy file matching ───────────────────────────────────────

/**
 * Compute a simple similarity score between two strings (0–1).
 * Uses character-level overlap to find close matches.
 */
function similarity(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;
  if (la.length === 0 || lb.length === 0) return 0;

  // Check if one contains the other
  if (lb.includes(la) || la.includes(lb)) return 0.8;

  // Check basename similarity
  const ba = path.basename(la);
  const bb = path.basename(lb);
  if (ba === bb) return 0.9;
  if (bb.includes(ba) || ba.includes(bb)) return 0.75;

  // Count common chars
  const setA = new Set(la.split(""));
  const setB = new Set(lb.split(""));
  const intersection = [...setA].filter(c => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Walk up to `maxDepth` levels of a directory collecting all files.
 * Returns paths relative to the search root.
 */
function collectFiles(dir: string, maxDepth = 4, _currentDepth = 0): string[] {
  if (_currentDepth > maxDepth) return [];
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    // Skip hidden dirs and common large dirs
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, maxDepth, _currentDepth + 1));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Find files similar to the requested path within workDir.
 */
function findSimilarFiles(requestedPath: string, workDir: string): string[] {
  const basename = path.basename(requestedPath);
  const allFiles = collectFiles(workDir, 4);

  const scored = allFiles
    .map(f => ({
      file: path.relative(workDir, f),
      score: similarity(basename, path.basename(f)),
    }))
    .filter(x => x.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.file);

  return scored;
}

// ─── Error pattern detection ───────────────────────────────────

function isFileNotFound(error: string): boolean {
  return (
    /no such file or directory/i.test(error) ||
    /enoent/i.test(error) ||
    /file not found/i.test(error) ||
    /cannot find/i.test(error) ||
    /does not exist/i.test(error)
  );
}

function isCommandNotFound(error: string): boolean {
  return (
    /command not found/i.test(error) ||
    /not recognized as an internal or external command/i.test(error) ||
    /is not recognized/i.test(error) ||
    /no such command/i.test(error)
  );
}

function isTimeout(error: string): boolean {
  return /timed? ?out/i.test(error) || /etimedout/i.test(error);
}

function isPermissionDenied(error: string): boolean {
  return /permission denied/i.test(error) || /eacces/i.test(error);
}

function isPortInUse(error: string): boolean {
  return /eaddrinuse/i.test(error) || /address already in use/i.test(error);
}

function isOutOfMemory(error: string): boolean {
  return (
    /out of memory/i.test(error) ||
    /enomem/i.test(error) ||
    /heap out of memory/i.test(error) ||
    /javascript heap/i.test(error) ||
    /allocation failed/i.test(error)
  );
}

function isJsonSyntaxError(error: string): boolean {
  return (
    /unexpected token/i.test(error) ||
    /json parse error/i.test(error) ||
    /invalid json/i.test(error) ||
    /syntaxerror.*json/i.test(error) ||
    /json at position/i.test(error)
  );
}

function isModuleNotFound(error: string): boolean {
  return (
    /cannot find module/i.test(error) ||
    /module not found/i.test(error) ||
    /err_module_not_found/i.test(error) ||
    /failed to resolve import/i.test(error)
  );
}

// ─── Port extraction helper ────────────────────────────────────

function extractPort(error: string): string | null {
  const match = error.match(/:(\d{2,5})/);
  return match ? match[1] : null;
}

// ─── Module name extraction helper ────────────────────────────

function extractModuleName(error: string): string | null {
  const patterns = [
    /cannot find module ['"]([^'"]+)['"]/i,
    /module not found.*['"]([^'"]+)['"]/i,
    /failed to resolve import ['"]([^'"]+)['"]/i,
  ];
  for (const pat of patterns) {
    const m = error.match(pat);
    if (m) return m[1];
  }
  return null;
}

// ─── Shared error enhancers ────────────────────────────────────

function enhancePermissionDenied(filePath: string, error: string): string {
  return (
    `${error}\n💡 Permission denied on '${filePath}'. Try:\n` +
    `  • chmod +x ${filePath}  (if it should be executable)\n` +
    `  • chmod 644 ${filePath}  (for regular read/write)\n` +
    `  • Check ownership: ls -la ${path.dirname(filePath) || "."}`
  );
}

function enhancePortInUse(error: string): string {
  const port = extractPort(error);
  const portStr = port ?? "<PORT>";
  return (
    `${error}\n💡 Port ${portStr} is already in use. Try:\n` +
    `  • Find the process: lsof -i :${portStr}\n` +
    `  • Kill it: kill -9 $(lsof -ti :${portStr})\n` +
    `  • Or use a different port`
  );
}

function enhanceOutOfMemory(error: string): string {
  return (
    `${error}\n💡 Out of memory. Try:\n` +
    `  • Reduce scope — process fewer files at once\n` +
    `  • Increase Node.js heap: NODE_OPTIONS=--max-old-space-size=4096\n` +
    `  • Close other processes to free memory`
  );
}

function enhanceJsonSyntaxError(error: string): string {
  return (
    `${error}\n💡 JSON syntax error. Common causes:\n` +
    `  • Trailing comma after last item (not allowed in JSON)\n` +
    `  • Missing or mismatched quotes around keys/values\n` +
    `  • Unescaped special characters (use \\n, \\t, \\" etc.)\n` +
    `  • Comments in JSON (not supported — use JSON5 or strip them)`
  );
}

function enhanceModuleNotFound(error: string): string {
  const modName = extractModuleName(error);
  const mod = modName ?? "<module>";
  const isRelative = mod.startsWith(".");
  if (isRelative) {
    return (
      `${error}\n💡 Module '${mod}' not found. For relative imports:\n` +
      `  • Check the path is correct relative to the current file\n` +
      `  • Ensure the .js extension is present (ESM requires it)\n` +
      `  • Verify the file exists: ls ${mod}`
    );
  }
  return (
    `${error}\n💡 Module '${mod}' not found. Try:\n` +
    `  • Install it: npm install ${mod}\n` +
    `  • Check spelling in package.json dependencies\n` +
    `  • Verify node_modules exists: ls node_modules/${mod}`
  );
}

// ─── Per-tool recovery strategies ─────────────────────────────

function recoverReadFile(
  input: Record<string, unknown>,
  error: string,
  workDir: string,
): string {
  const requestedPath = (input["path"] as string | undefined) ?? "";

  if (isFileNotFound(error)) {
    const similar = findSimilarFiles(requestedPath, workDir);
    if (similar.length > 0) {
      return `${error}\n💡 Did you mean one of these?\n${similar.map(f => `  • ${f}`).join("\n")}`;
    }
    // Try to suggest the directory contents
    const dir = path.dirname(path.resolve(workDir, requestedPath));
    let dirContents = "";
    try {
      const entries = fs.readdirSync(dir).slice(0, 10).join(", ");
      dirContents = `\n   Files in ${path.relative(workDir, dir) || "."}: ${entries}`;
    } catch { /* dir doesn't exist either */ }
    return `${error}\n💡 File not found: ${requestedPath}${dirContents}`;
  }

  if (isPermissionDenied(error)) {
    return enhancePermissionDenied(requestedPath, error);
  }

  return error;
}

function recoverWriteFile(
  input: Record<string, unknown>,
  error: string,
  workDir: string,
): string {
  const requestedPath = (input["path"] as string | undefined) ?? "";

  if (isFileNotFound(error)) {
    // Often happens when parent directory doesn't exist
    const dir = path.dirname(path.resolve(workDir, requestedPath));
    const relDir = path.relative(workDir, dir);
    const similar = findSimilarFiles(requestedPath, workDir);
    let hint = `${error}\n💡 Parent directory may not exist: ${relDir}. Try creating it first with bash mkdir -p.`;
    if (similar.length > 0) {
      hint += `\n   Similar files found: ${similar.join(", ")}`;
    }
    return hint;
  }

  if (isPermissionDenied(error)) {
    return enhancePermissionDenied(requestedPath, error);
  }

  return error;
}

function recoverBash(
  input: Record<string, unknown>,
  error: string,
): string {
  const command = (input["command"] as string | undefined) ?? "";

  if (isPortInUse(error)) {
    return enhancePortInUse(error);
  }

  if (isOutOfMemory(error)) {
    return enhanceOutOfMemory(error);
  }

  if (isJsonSyntaxError(error)) {
    return enhanceJsonSyntaxError(error);
  }

  if (isModuleNotFound(error)) {
    return enhanceModuleNotFound(error);
  }

  if (isCommandNotFound(error)) {
    // Extract the command name from the error or input
    const cmdMatch = error.match(/['"]?(\S+)['"]?[:\s]+command not found/i) ??
      error.match(/command not found[:\s]+['"]?(\S+)['"]?/i);
    const cmdName = cmdMatch?.[1] ?? command.split(" ")[0];

    return `${error}\n💡 Command '${cmdName}' not found. Try:\n  • npx ${command}\n  • Check if the package is installed: npm list -g ${cmdName}`;
  }

  if (isTimeout(error)) {
    return `${error}\n💡 Command timed out. Try:\n  • Break into smaller sub-commands\n  • Add a shorter timeout flag to the command\n  • Run with --ci or --no-interactive flags if available`;
  }

  if (isPermissionDenied(error)) {
    const cmdName = command.split(" ")[0];
    return enhancePermissionDenied(cmdName, error);
  }

  return error;
}

function recoverGrep(
  input: Record<string, unknown>,
  error: string,
): string {
  const pattern = (input["pattern"] as string | undefined) ?? "";
  const glob = (input["glob"] as string | undefined) ?? "";
  const currentPath = (input["path"] as string | undefined) ?? ".";

  // "No matches" isn't technically an error but we handle it via the no-matches path
  if (/no matches/i.test(error) || /no results/i.test(error) || error.trim() === "") {
    const hints: string[] = [];
    hints.push(`No matches for pattern '${pattern}'.`);
    hints.push(`💡 Suggestions:`);
    hints.push(`  • Try case-insensitive: set case_insensitive=true`);
    if (glob) hints.push(`  • Broaden glob: remove or change '${glob}'`);
    if (currentPath !== ".") hints.push(`  • Search broader directory: path="."`);
    hints.push(`  • Simplify pattern: use a shorter substring of '${pattern}'`);
    return hints.join("\n");
  }

  return error;
}

// ─── Main export ───────────────────────────────────────────────

/**
 * Enhance a tool error message with recovery suggestions.
 * Returns the original error if no suggestion applies.
 */
export function enhanceToolError(
  toolName: string,
  input: Record<string, unknown>,
  error: string,
  workDir: string,
): string {
  // Only enhance actual errors — skip empty strings or success messages
  if (!error || error.trim() === "") return error;

  try {
    switch (toolName) {
      case "read_file":
        return recoverReadFile(input, error, workDir);
      case "write_file":
        return recoverWriteFile(input, error, workDir);
      case "bash":
        return recoverBash(input, error);
      case "grep":
        return recoverGrep(input, error);
      default:
        return error;
    }
  } catch {
    // Never let recovery logic crash the main flow
    return error;
  }
}

// ─── Retry with exponential backoff ───────────────────────────────────────────

/**
 * Retry a failing async function with exponential backoff and jitter.
 *
 * @param fn          - The async operation to attempt.
 * @param opts.maxRetries       - Total extra attempts after first failure (default 3).
 * @param opts.baseDelayMs      - Initial delay in ms (default 500).
 * @param opts.maxDelayMs       - Cap on delay in ms (default 10 000).
 * @param opts.retryableStatuses - HTTP status codes that should trigger retries (default [429, 500, 502, 503, 529]).
 * @param opts.isRetryable       - Optional callback to classify errors as retryable.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    retryableStatuses?: number[];
    isRetryable?: (err: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 10_000,
    retryableStatuses = [429, 500, 502, 503, 529],
    isRetryable,
  } = opts;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if this error is retryable
      const status = (err as Record<string, unknown>)?.status as number | undefined;
      const hasRetryableStatus = status !== undefined && retryableStatuses.includes(status);
      const hasTransientMessage = /ETIMEDOUT|ECONNRESET|socket hang up/i.test(lastError.message);
      const customRetryable = isRetryable ? isRetryable(lastError) : false;

      if (!hasRetryableStatus && !hasTransientMessage && !customRetryable) {
        // Non-transient error — fail immediately without retrying
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(
          baseDelayMs * 2 ** attempt + Math.random() * 200,
          maxDelayMs
        );
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}
