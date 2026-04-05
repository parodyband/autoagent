/**
 * Tool output compressor — reduces large tool outputs before adding to conversation history.
 * Keeps the most relevant content while staying within context limits.
 */

const DEFAULT_MAX_CHARS = 3000;
const HARD_CAP = 8000;

// Lines to always preserve in bash test output
const TEST_RESULT_RE = /FAIL|PASS|Error|✓|✗|Tests:|test files/i;

/**
 * Compress a tool's output string to stay within context limits.
 *
 * @param toolName - The tool that produced this output (bash, grep, read_file, etc.)
 * @param output   - Raw string output from the tool
 * @param maxChars - Threshold above which compression kicks in (default 3000)
 * @returns Compressed (or original) output string
 */
export function compressToolOutput(
  toolName: string,
  output: string,
  maxChars: number = DEFAULT_MAX_CHARS
): string {
  // read_file is never compressed — user explicitly requested file content
  if (toolName === "read_file") {
    return applyHardCap(output);
  }

  // Short outputs pass through (just enforce hard cap)
  if (output.length <= maxChars) {
    return applyHardCap(output);
  }

  let compressed: string;

  if (toolName === "grep") {
    compressed = compressGrepOutput(output);
  } else if (toolName === "bash") {
    compressed = compressBashOutput(output);
  } else {
    // Generic: keep head + tail
    compressed = compressGeneric(output);
  }

  return applyHardCap(compressed);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function compressBashOutput(output: string): string {
  const lines = output.split("\n");

  // Check if this looks like test output
  const isTestOutput = lines.some((l) => TEST_RESULT_RE.test(l));

  if (isTestOutput) {
    return compressBashTestOutput(lines);
  }

  // Standard bash: first 20 lines + last 30 lines
  const HEAD = 20;
  const TAIL = 30;

  if (lines.length <= HEAD + TAIL) {
    return output;
  }

  const head = lines.slice(0, HEAD);
  const tail = lines.slice(lines.length - TAIL);
  const omitted = lines.length - HEAD - TAIL;

  return [...head, `... (${omitted} lines omitted)`, ...tail].join("\n");
}

function compressBashTestOutput(lines: string[]): string {
  // Always keep: summary lines, failure lines, error lines
  const important = lines.filter((l) => TEST_RESULT_RE.test(l));

  // Also keep first 10 lines (setup context) and last 20 lines (final summary)
  const HEAD = 10;
  const TAIL = 20;

  const head = lines.slice(0, HEAD);
  const tail = lines.slice(Math.max(0, lines.length - TAIL));

  // Merge: head + important (not already in head/tail) + tail, deduped
  const headSet = new Set(head.map((_, i) => i));
  const tailStart = Math.max(0, lines.length - TAIL);

  const middle: string[] = [];
  for (let i = HEAD; i < tailStart; i++) {
    if (TEST_RESULT_RE.test(lines[i])) {
      middle.push(lines[i]);
    }
  }

  const totalKept = HEAD + middle.length + TAIL;
  const omitted = lines.length - totalKept;

  if (omitted <= 0) {
    return lines.join("\n");
  }

  return [...head, `... (${omitted} lines omitted)`, ...middle, ...tail].join("\n");
}

function compressGrepOutput(output: string): string {
  const lines = output.split("\n").filter((l) => l.length > 0);
  const MAX_MATCHES = 30;

  if (lines.length <= MAX_MATCHES) {
    return output;
  }

  const kept = lines.slice(0, MAX_MATCHES);
  const more = lines.length - MAX_MATCHES;

  return [...kept, `... (${more} more matches)`].join("\n");
}

function compressGeneric(output: string): string {
  const lines = output.split("\n");
  const HEAD = 20;
  const TAIL = 30;

  if (lines.length <= HEAD + TAIL) {
    return output;
  }

  const head = lines.slice(0, HEAD);
  const tail = lines.slice(lines.length - TAIL);
  const omitted = lines.length - HEAD - TAIL;

  return [...head, `... (${omitted} lines omitted)`, ...tail].join("\n");
}

function applyHardCap(output: string): string {
  if (output.length <= HARD_CAP) {
    return output;
  }

  const total = output.length;
  return output.slice(0, HARD_CAP) + `\n... (truncated, ${total} chars total)`;
}
