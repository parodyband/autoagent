/**
 * Query-aware context loading.
 *
 * Before the first LLM call, extract keywords from the user message,
 * fuzzy-search the repo map for relevant files, and return their contents
 * as a formatted string to prepend as context.
 */

import { readFileSync } from "fs";
import { join } from "path";
import type { RepoMap } from "./tree-sitter-map.js";
import { fuzzySearch } from "./tree-sitter-map.js";

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

const MAX_CONTEXT_CHARS = 32_000; // ~8000 tokens
const MAX_FILES = 3;
const MAX_LINES_PER_FILE = 500;

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

/**
 * Auto-load file contents relevant to the user's query.
 *
 * @param repoMap - current repo map
 * @param userMessage - the user's message
 * @param workDir - working directory to resolve file paths
 * @param alreadyMentioned - set of file paths already in conversation context (skip these)
 * @returns formatted string with file contents, or empty string if nothing relevant
 */
export function autoLoadContext(
  repoMap: RepoMap,
  userMessage: string,
  workDir: string,
  alreadyMentioned: Set<string> = new Set(),
): string {
  if (!repoMap || repoMap.files.length === 0) return "";

  const keywords = extractKeywords(userMessage);
  if (keywords.length === 0) return "";

  // Count keyword hits per file path
  const hitCounts = new Map<string, number>();
  for (const keyword of keywords) {
    const results = fuzzySearch(repoMap, keyword, 20);
    for (const r of results) {
      hitCounts.set(r.file, (hitCounts.get(r.file) ?? 0) + 1);
    }
  }

  if (hitCounts.size === 0) return "";

  // Sort by hit count descending, then path for stability
  const ranked = [...hitCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([path]) => path)
    .filter(p => !alreadyMentioned.has(p))
    .slice(0, MAX_FILES);

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
