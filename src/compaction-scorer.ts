/**
 * Semantic importance scoring for tier1 compaction.
 * Determines how many characters to keep for a tool output
 * based on the tool name and content.
 */

export type Importance = "high" | "medium" | "low";

export interface ScoreResult {
  importance: Importance;
  maxChars: number;
}

const HIGH_CHARS = 3000;
const MEDIUM_CHARS = 1500;
const LOW_CHARS = 500;

/** Tool names that always get high importance (writes/patches are critical). */
const HIGH_IMPORTANCE_TOOLS = new Set(["write_file", "patch"]);

/** Tool names that default to medium importance. */
const MEDIUM_IMPORTANCE_TOOLS = new Set(["bash", "grep", "read_file", "semantic_search"]);

/** Patterns in content that indicate high importance. */
const HIGH_IMPORTANCE_PATTERNS = [
  /\bError\b/,
  /\bFAIL\b/,
  /\berror:/i,
  /\bTypeError\b/,
  /\bCannot find\b/,
  /\bnot found\b/i,
  /^\s+at .+:\d+:\d+/m, // stack trace lines
  /AssertionError/,
  /\bthrown\b/i,
  /\bfailed\b/i,
  /\bpanic\b/i,
];

/** Patterns indicating low-value content. */
const LOW_IMPORTANCE_PATTERNS = [
  /^[\s\n]*$/, // empty/whitespace only
  /added \d+ package/i, // npm install success
  /npm warn/i,
  /up to date/i,
  /already up.to.date/i, // git pull clean
  /nothing to commit/i, // git status clean
  /working tree clean/i,
  /On branch \S+\nYour branch is up to date/,
  /^total \d+\n/m, // ls -l header
];

/**
 * Score a tool output to determine how many characters to preserve during compaction.
 *
 * @param toolName  The name of the tool that produced the output.
 * @param text      The raw text content of the tool output.
 * @returns         Importance level and max character budget.
 */
export function scoreToolOutput(toolName: string, text: string): ScoreResult {
  // High: write operations — always preserve more context
  if (HIGH_IMPORTANCE_TOOLS.has(toolName)) {
    return { importance: "high", maxChars: HIGH_CHARS };
  }

  // High: content contains error/failure indicators
  for (const pattern of HIGH_IMPORTANCE_PATTERNS) {
    if (pattern.test(text)) {
      return { importance: "high", maxChars: HIGH_CHARS };
    }
  }

  // Low: empty, whitespace, or low-value patterns
  for (const pattern of LOW_IMPORTANCE_PATTERNS) {
    if (pattern.test(text)) {
      return { importance: "low", maxChars: LOW_CHARS };
    }
  }

  // Low: very short output (no value to preserve heavily)
  if (text.trim().length < 20) {
    return { importance: "low", maxChars: LOW_CHARS };
  }

  // Medium: default for bash, grep, read_file, etc.
  if (MEDIUM_IMPORTANCE_TOOLS.has(toolName)) {
    return { importance: "medium", maxChars: MEDIUM_CHARS };
  }

  // Default medium for unknown tools
  return { importance: "medium", maxChars: MEDIUM_CHARS };
}
