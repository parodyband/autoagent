/**
 * Iteration Diff Analysis
 * 
 * Analyzes git history to compute diff statistics between iteration commits.
 */

import { executeBash } from "./tools/bash.js";

export interface IterationCommit {
  iteration: number;
  sha: string;
}

export interface FileDiffEntry {
  file: string;
  added: number;
  removed: number;
}

export interface DiffStats {
  iteration: number;
  fromSha: string;
  toSha: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  netDelta: number;
  files: FileDiffEntry[];
}

/**
 * Get all iteration commits from git log, sorted ascending by iteration number.
 */
export async function getIterationCommits(): Promise<IterationCommit[]> {
  const result = await executeBash(
    `git log --oneline --all --grep="iteration" --format="%H %s" 2>/dev/null || true`,
    30, undefined, true
  );

  const commits: IterationCommit[] = [];
  const lines = result.output.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const sha = line.slice(0, 40);
    const msg = line.slice(41);
    // Match patterns like "iteration 5", "Iteration 12", "iter-5", etc.
    const match = msg.match(/iteration\s*[-:]?\s*(\d+)/i);
    if (match && sha.length >= 40) {
      commits.push({ iteration: parseInt(match[1], 10), sha });
    }
  }

  // Sort ascending by iteration
  commits.sort((a, b) => a.iteration - b.iteration);

  // Deduplicate — keep the last commit for each iteration
  const seen = new Map<number, IterationCommit>();
  for (const c of commits) {
    seen.set(c.iteration, c);
  }
  return Array.from(seen.values()).sort((a, b) => a.iteration - b.iteration);
}

/**
 * Compute diff statistics between two commits.
 */
export async function computeDiffStats(
  fromSha: string,
  toSha: string,
  iteration: number,
  srcOnly?: boolean
): Promise<DiffStats> {
  const pathFilter = srcOnly ? "-- src/" : "";
  const result = await executeBash(
    `git diff --numstat ${fromSha} ${toSha} ${pathFilter} 2>/dev/null || true`,
    30, undefined, true
  );

  const files: FileDiffEntry[] = [];
  const lines = result.output.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length >= 3) {
      const added = parts[0] === "-" ? 0 : parseInt(parts[0], 10) || 0;
      const removed = parts[1] === "-" ? 0 : parseInt(parts[1], 10) || 0;
      files.push({ file: parts[2], added, removed });
    }
  }

  const linesAdded = files.reduce((s, f) => s + f.added, 0);
  const linesRemoved = files.reduce((s, f) => s + f.removed, 0);

  return {
    iteration,
    fromSha,
    toSha,
    filesChanged: files.length,
    linesAdded,
    linesRemoved,
    netDelta: linesAdded - linesRemoved,
    files,
  };
}

/**
 * Get diff stats for all consecutive iteration pairs.
 */
export async function getAllIterationDiffs(): Promise<DiffStats[]> {
  const commits = await getIterationCommits();
  const diffs: DiffStats[] = [];

  for (let i = 1; i < commits.length; i++) {
    const from = commits[i - 1];
    const to = commits[i];
    const stats = await computeDiffStats(from.sha, to.sha, to.iteration);
    diffs.push(stats);
  }

  return diffs;
}
