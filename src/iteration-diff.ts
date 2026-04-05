/**
 * Iteration diff analysis — computes code change stats between iterations.
 *
 * Uses git diff between iteration commit SHAs to calculate:
 * - Files changed, lines added/removed, net delta per iteration
 * - Filterable to src/ only for "real code" vs all files
 */

import { executeBash } from "./tools/bash.js";

export interface IterationDiffStats {
  iteration: number;
  fromSha: string;
  toSha: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  netDelta: number;
  files: FileDiffStat[];
}

export interface FileDiffStat {
  file: string;
  added: number;
  removed: number;
}

/**
 * Discover iteration commit SHAs from git log.
 * Returns sorted array of { iteration, sha } objects.
 */
export async function getIterationCommits(): Promise<{ iteration: number; sha: string }[]> {
  const result = await executeBash(
    'git log --oneline --format="%H %s" --all',
    30,
    undefined,
    true
  );

  if (result.exitCode !== 0 || !result.output.trim()) return [];

  const commits: { iteration: number; sha: string }[] = [];
  const pattern = /^([0-9a-f]+)\s+autoagent: iteration (\d+)$/;

  for (const line of result.output.trim().split("\n")) {
    const match = line.match(pattern);
    if (match) {
      commits.push({ iteration: parseInt(match[2], 10), sha: match[1] });
    }
  }

  return commits.sort((a, b) => a.iteration - b.iteration);
}

/**
 * Compute diff stats between two commits.
 * If srcOnly is true, only counts changes in src/ and scripts/.
 */
export async function computeDiffStats(
  fromSha: string,
  toSha: string,
  iteration: number,
  srcOnly = false
): Promise<IterationDiffStats> {
  const pathFilter = srcOnly ? "-- src/ scripts/" : "";
  const result = await executeBash(
    `git diff --numstat ${fromSha} ${toSha} ${pathFilter}`,
    30,
    undefined,
    true
  );

  const files: FileDiffStat[] = [];
  let totalAdded = 0;
  let totalRemoved = 0;

  if (result.exitCode === 0 && result.output.trim()) {
    for (const line of result.output.trim().split("\n")) {
      // Format: added\tremoved\tfile
      // Binary files show as "-\t-\tfile"
      const parts = line.split("\t");
      if (parts.length < 3) continue;

      const added = parts[0] === "-" ? 0 : parseInt(parts[0], 10);
      const removed = parts[1] === "-" ? 0 : parseInt(parts[1], 10);
      const file = parts.slice(2).join("\t"); // filename might contain tabs (unlikely)

      if (!isNaN(added) && !isNaN(removed)) {
        files.push({ file, added, removed });
        totalAdded += added;
        totalRemoved += removed;
      }
    }
  }

  return {
    iteration,
    fromSha,
    toSha,
    filesChanged: files.length,
    linesAdded: totalAdded,
    linesRemoved: totalRemoved,
    netDelta: totalAdded - totalRemoved,
    files,
  };
}

/**
 * Get diff stats for all iterations.
 * Each iteration's diff is computed from the previous iteration's commit to the current one.
 */
export async function getAllIterationDiffs(srcOnly = false): Promise<IterationDiffStats[]> {
  const commits = await getIterationCommits();
  if (commits.length < 2) return [];

  const diffs: IterationDiffStats[] = [];
  for (let i = 1; i < commits.length; i++) {
    const from = commits[i - 1];
    const to = commits[i];
    const stats = await computeDiffStats(from.sha, to.sha, to.iteration, srcOnly);
    diffs.push(stats);
  }

  return diffs;
}
