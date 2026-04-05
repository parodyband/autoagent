/**
 * Diff Preview — compute unified diffs for write_file confirmation.
 * Uses a simple LCS-based algorithm with no external dependencies.
 */

// ─── LCS ─────────────────────────────────────────────────────

/**
 * Compute the longest common subsequence table for two line arrays.
 * Truncates to MAX_LINES to keep perf acceptable for large files.
 */
const MAX_LINES = 600;

function lcsTable(a: string[], b: string[]): number[][] {
  const m = Math.min(a.length, MAX_LINES);
  const n = Math.min(b.length, MAX_LINES);
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

interface DiffOp {
  type: "equal" | "add" | "delete";
  line: string;
  oldLine?: number;
  newLine?: number;
}

function buildDiffOps(a: string[], b: string[]): DiffOp[] {
  const aT = a.slice(0, MAX_LINES);
  const bT = b.slice(0, MAX_LINES);
  const dp = lcsTable(aT, bT);

  const ops: DiffOp[] = [];
  let i = aT.length, j = bT.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aT[i - 1] === bT[j - 1]) {
      ops.push({ type: "equal", line: aT[i - 1], oldLine: i, newLine: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "add", line: bT[j - 1], newLine: j });
      j--;
    } else {
      ops.push({ type: "delete", line: aT[i - 1], oldLine: i });
      i--;
    }
  }

  // Add truncation note if needed
  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    ops.push({ type: "equal", line: `... (truncated to ${MAX_LINES} lines)` });
  }

  ops.reverse();
  return ops;
}

// ─── Unified diff formatter ───────────────────────────────────

const CONTEXT_LINES = 3;

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

/**
 * Compute a unified diff string (similar to `diff -u`) between two file contents.
 * Returns empty string if content is identical.
 */
export function computeUnifiedDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  if (oldContent === newContent) return "";

  const oldLines = oldContent === "" ? [] : oldContent.split("\n");
  const newLines = newContent === "" ? [] : newContent.split("\n");

  // New file — all additions
  if (oldContent === "") {
    const header = `--- /dev/null\n+++ b/${filePath}`;
    const hunkHeader = `@@ -0,0 +1,${newLines.length} @@`;
    const body = newLines.map(l => `+${l}`).join("\n");
    return `${header}\n${hunkHeader}\n${body}`;
  }

  const ops = buildDiffOps(oldLines, newLines);

  // Build hunks: collect changed regions with CONTEXT_LINES around them
  const hunks: Hunk[] = [];
  let oldLine = 1, newLine = 1;

  // Collect indices of changed ops
  const changedIdx: number[] = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].type !== "equal") changedIdx.push(k);
  }

  if (changedIdx.length === 0) return "";

  // Group changed indices into hunks with context
  const groups: Array<[number, number]> = [];
  let start = Math.max(0, changedIdx[0] - CONTEXT_LINES);
  let end = Math.min(ops.length - 1, changedIdx[0] + CONTEXT_LINES);

  for (let k = 1; k < changedIdx.length; k++) {
    const next = changedIdx[k];
    if (next - CONTEXT_LINES <= end + 1) {
      end = Math.min(ops.length - 1, next + CONTEXT_LINES);
    } else {
      groups.push([start, end]);
      start = Math.max(0, next - CONTEXT_LINES);
      end = Math.min(ops.length - 1, next + CONTEXT_LINES);
    }
  }
  groups.push([start, end]);

  // Re-compute line numbers by walking all ops
  const opLines: Array<{ old: number; new: number }> = [];
  let ol = 1, nl = 1;
  for (const op of ops) {
    opLines.push({ old: ol, new: nl });
    if (op.type === "equal") { ol++; nl++; }
    else if (op.type === "delete") ol++;
    else nl++;
  }

  for (const [gs, ge] of groups) {
    const hunkLines: string[] = [];
    let hunkOldStart = opLines[gs].old;
    let hunkNewStart = opLines[gs].new;
    let hunkOldCount = 0, hunkNewCount = 0;

    for (let k = gs; k <= ge; k++) {
      const op = ops[k];
      if (op.type === "equal") {
        hunkLines.push(` ${op.line}`);
        hunkOldCount++; hunkNewCount++;
      } else if (op.type === "delete") {
        hunkLines.push(`-${op.line}`);
        hunkOldCount++;
      } else {
        hunkLines.push(`+${op.line}`);
        hunkNewCount++;
      }
    }

    hunks.push({
      oldStart: hunkOldStart,
      oldCount: hunkOldCount,
      newStart: hunkNewStart,
      newCount: hunkNewCount,
      lines: hunkLines,
    });
    oldLine = opLines[ge].old + (ops[ge].type !== "add" ? 1 : 0);
    newLine = opLines[ge].new + (ops[ge].type !== "delete" ? 1 : 0);
  }

  void oldLine; void newLine; // suppress unused warning

  const header = `--- a/${filePath}\n+++ b/${filePath}`;
  const hunkStr = hunks.map(h => {
    const hdr = `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`;
    return `${hdr}\n${h.lines.join("\n")}`;
  }).join("\n");

  return `${header}\n${hunkStr}`;
}

// ─── Summary stats ────────────────────────────────────────────

export interface DiffStats {
  additions: number;
  deletions: number;
  isNewFile: boolean;
}

/** Count additions and deletions in a unified diff string. */
export function getDiffStats(diff: string): DiffStats {
  const lines = diff.split("\n");
  let additions = 0, deletions = 0;
  let isNewFile = false;
  for (const line of lines) {
    if (line.startsWith("--- /dev/null")) { isNewFile = true; continue; }
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) continue;
    if (line.startsWith("+")) additions++;
    else if (line.startsWith("-")) deletions++;
  }
  return { additions, deletions, isNewFile };
}
