/**
 * Write file tool — create or overwrite files, with mkdir -p and diff reporting.
 */

import { writeFileSync, readFileSync, appendFileSync, mkdirSync, existsSync, statSync } from "fs";
import path from "path";
import type Anthropic from "@anthropic-ai/sdk";
import { globalFileCache, globalMtimeTracker } from "../file-cache.js";

export const writeFileToolDefinition: Anthropic.Tool = {
  name: "write_file",
  description:
    "Write content to a file. Creates parent directories automatically. " +
    "Use mode 'write' to create/overwrite, 'append' to add to end, " +
    "or 'patch' to apply a simple find-and-replace edit. " +
    "Safer and more reliable than bash heredocs for writing files.",
  input_schema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "Path to the file (relative to project root or absolute).",
      },
      content: {
        type: "string",
        description: "For write/append mode: the content. For patch mode: not used.",
      },
      mode: {
        type: "string",
        enum: ["write", "append", "patch"],
        description: "Write mode. Default: 'write'.",
      },
      old_string: {
        type: "string",
        description: "For 'patch' mode: the exact string to find and replace.",
      },
      new_string: {
        type: "string",
        description: "For 'patch' mode: the replacement string.",
      },
    },
    required: ["path"],
  },
};

export interface WriteFileResult {
  message: string;
  success: boolean;
}

/**
 * Normalize a string for fuzzy matching by trimming trailing whitespace from each line.
 */
function normalizeWhitespace(s: string): string {
  return s.split("\n").map(line => line.trimEnd()).join("\n");
}

/**
 * Normalize a string by collapsing all whitespace runs to a single space and trimming lines.
 */
function collapseWhitespace(s: string): string {
  return s.split("\n").map(line => line.trim().replace(/\s+/g, " ")).join("\n");
}

/**
 * Try to find oldStr in content using fuzzy matching (whitespace normalization).
 * Returns the patched content and a warning string, or null if no match found.
 *
 * Strategy:
 * 1. Trim trailing whitespace from each line of both strings, retry match
 * 2. If still no match, collapse all whitespace runs, retry match
 */
export function fuzzyFindReplace(
  content: string,
  oldStr: string,
  newStr: string
): { result: string; warning: string } | null {
  // Try trimming trailing whitespace
  const normContent = normalizeWhitespace(content);
  const normOld = normalizeWhitespace(oldStr);
  if (normContent.includes(normOld)) {
    // Find the matching region in the original content by matching line-by-line
    const result = replaceNormalized(content, oldStr, newStr, "trailing");
    if (result !== null) {
      return {
        result,
        warning: "Applied with fuzzy match (whitespace normalized). Original had minor whitespace differences.",
      };
    }
  }

  // Try collapsing all whitespace
  const colContent = collapseWhitespace(content);
  const colOld = collapseWhitespace(oldStr);
  if (colOld.length > 0 && colContent.includes(colOld)) {
    const result = replaceNormalized(content, oldStr, newStr, "collapse");
    if (result !== null) {
      return {
        result,
        warning: "Applied with fuzzy match (whitespace collapsed). Original had significant whitespace differences.",
      };
    }
  }

  return null;
}

/**
 * Replace lines in content that fuzzy-match oldStr lines, substituting with newStr.
 */
function replaceNormalized(
  content: string,
  oldStr: string,
  newStr: string,
  mode: "trailing" | "collapse"
): string | null {
  const normalize = mode === "trailing" ? normalizeWhitespace : collapseWhitespace;
  const contentLines = content.split("\n");
  const oldLines = oldStr.split("\n");
  const normOldLines = oldLines.map(l => (mode === "trailing" ? l.trimEnd() : l.trim().replace(/\s+/g, " ")));

  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    const slice = contentLines.slice(i, i + oldLines.length);
    const normSlice = slice.map(l => (mode === "trailing" ? l.trimEnd() : l.trim().replace(/\s+/g, " ")));
    if (normSlice.join("\n") === normOldLines.join("\n")) {
      // Found matching region — replace it
      const before = contentLines.slice(0, i);
      const after = contentLines.slice(i + oldLines.length);
      const newLines = newStr.split("\n");
      return [...before, ...newLines, ...after].join("\n");
    }
  }
  return null;
}

function countLines(s: string): number {
  if (!s) return 0;
  return s.split("\n").length;
}

// Files that are append-only: write mode must start with existing content
// Paths are relative to project root (e.g. "memory.md", "agentlog.md")
const APPEND_ONLY_FILES = new Set(["memory.md", "agentlog.md"]);

export function isAppendOnly(filePath: string, workDir?: string): boolean {
  const base = workDir ?? process.cwd();
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(base, filePath);
  const relative = path.relative(base, resolved);
  return APPEND_ONLY_FILES.has(relative);
}

export function executeWriteFile(
  filePath: string,
  content: string = "",
  mode: "write" | "append" | "patch" = "write",
  cwd?: string,
  oldString?: string,
  newString?: string
): WriteFileResult {
  const workDir = cwd ?? process.cwd();
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(workDir, filePath);

  try {
    const dir = path.dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const existed = existsSync(resolved);
    let oldContent = "";
    if (existed) {
      try { oldContent = readFileSync(resolved, "utf-8"); } catch {}
    }

    // Stale-file check: warn if file was modified externally since last read
    let staleWarning = "";
    if (existed && mode !== "append") {
      try {
        const currentMtime = statSync(resolved).mtimeMs;
        if (globalMtimeTracker.isStale(resolved, currentMtime)) {
          staleWarning = `⚠ Warning: ${filePath} was modified externally since last read. Current content may differ from what you saw.\n`;
        }
      } catch {
        // Can't stat — skip stale check
      }
    }

    // Append-only enforcement for protected files
    // Exception: writes that are shorter than existing content (compaction) are allowed
    if (isAppendOnly(filePath, workDir) && existed && oldContent.length > 0) {
      if (mode === "write" && !content.startsWith(oldContent) && content.length >= oldContent.length) {
        return {
          message: `ERROR: ${path.basename(filePath)} is append-only. Use mode 'append' or ensure new content starts with existing content. (Shorter rewrites allowed for compaction.)`,
          success: false,
        };
      }
    }

    if (mode === "patch") {
      if (!oldString) return { message: "ERROR: patch mode requires old_string", success: false };
      if (!existed) return { message: `ERROR: Cannot patch non-existent file: ${filePath}`, success: false };
      let fuzzyWarning = "";
      let patched: string;
      if (oldContent.includes(oldString)) {
        patched = oldContent.replace(oldString, newString ?? "");
      } else {
        const fuzzy = fuzzyFindReplace(oldContent, oldString, newString ?? "");
        if (fuzzy === null) {
          return { message: `ERROR: old_string not found in ${filePath}. Must match exactly.`, success: false };
        }
        patched = fuzzy.result;
        fuzzyWarning = fuzzy.warning + "\n";
      }
      writeFileSync(resolved, patched, "utf-8");
      globalFileCache.invalidate(resolved);
      globalMtimeTracker.delete(resolved);

      // Show surrounding context so the agent doesn't need to re-read the file
      const replacement = newString ?? "";
      const patchStart = patched.indexOf(replacement);
      const contextLines = 3;
      const patchedLines = patched.split("\n");
      let startLine = 0;
      let charCount = 0;
      for (let i = 0; i < patchedLines.length; i++) {
        if (charCount + patchedLines[i].length + 1 > patchStart) {
          startLine = i;
          break;
        }
        charCount += patchedLines[i].length + 1;
      }
      const replacementLineCount = replacement.split("\n").length;
      const contextStart = Math.max(0, startLine - contextLines);
      const contextEnd = Math.min(patchedLines.length, startLine + replacementLineCount + contextLines);
      const contextSlice = patchedLines.slice(contextStart, contextEnd);
      const contextPreview = contextSlice
        .map((line, i) => `${contextStart + i + 1} | ${line}`)
        .join("\n");

      return {
        message: `${staleWarning}${fuzzyWarning}Patched ${filePath}: -${countLines(oldString)} +${countLines(replacement)} lines\n\nContext after patch:\n${contextPreview}`,
        success: true,
      };
    }

    if (mode === "append") {
      appendFileSync(resolved, content, "utf-8");
      return { message: `Appended ${content.length} chars to ${filePath}`, success: true };
    }

    writeFileSync(resolved, content, "utf-8");
    globalFileCache.invalidate(resolved);
    globalMtimeTracker.delete(resolved);
    if (!existed) return { message: `Created ${filePath} (${content.length} chars)`, success: true };
    const diff = countLines(content) - countLines(oldContent);
    return { message: `${staleWarning}Updated ${filePath} (${content.length} chars, ${diff > 0 ? "+" : ""}${diff} lines delta)`, success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { message: `ERROR: ${msg}`, success: false };
  }
}
