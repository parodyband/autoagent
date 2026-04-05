/**
 * Iteration tracking — manages git tags, commits, and rollback.
 *
 * Each iteration:
 *  1. Tags the current state as `pre-iteration-N`
 *  2. Agent runs and makes changes
 *  3. Commits as `iteration-N`
 *  4. If something exploded, rolls back to `pre-iteration-N`
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { executeBash } from "./tools/bash.js";

const STATE_FILE = path.join(process.cwd(), ".autoagent-state.json");

export interface IterationState {
  iteration: number;
  lastSuccessfulIteration: number;
  lastFailedCommit: string | null;
  lastFailureReason: string | null;
}

export function loadState(): IterationState {
  if (existsSync(STATE_FILE)) {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  }
  return {
    iteration: 0,
    lastSuccessfulIteration: -1,
    lastFailedCommit: null,
    lastFailureReason: null,
  };
}

export function saveState(state: IterationState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function tagPreIteration(iteration: number): Promise<void> {
  await executeBash(`git tag -f pre-iteration-${iteration}`, 120, undefined, true);
}

export async function commitIteration(iteration: number): Promise<string> {
  await executeBash("git add -A", 120, undefined, true);
  const result = await executeBash(
    `git commit -m "autoagent: iteration ${iteration}" --allow-empty`, 120, undefined, true
  );
  const shaResult = await executeBash("git rev-parse HEAD", 120, undefined, true);
  return shaResult.output.trim();
}

export async function rollbackToPreIteration(
  iteration: number
): Promise<boolean> {
  const tag = `pre-iteration-${iteration}`;
  const check = await executeBash(`git tag -l ${tag}`, 120, undefined, true);
  if (!check.output.trim()) return false;

  await executeBash(`git reset --hard ${tag}`, 120, undefined, true);
  return true;
}

export async function getIterationDiff(iteration: number): Promise<string> {
  const tag = `pre-iteration-${iteration}`;
  const result = await executeBash(
    `git diff ${tag} HEAD --stat 2>/dev/null || echo "(no diff available)"`, 120, undefined, true
  );
  return result.output;
}
