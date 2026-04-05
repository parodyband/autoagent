/**
 * Auto-commit — Aider-style git integration.
 * Commits staged/unstaged changes after the agent successfully completes an edit task.
 */

import { execSync } from "child_process";

export interface AutoCommitResult {
  committed: boolean;
  hash?: string;
  message?: string;
}

export interface UndoResult {
  undone: boolean;
  hash?: string;      // the commit that was undone
  message?: string;   // its commit message
  error?: string;
}

/**
 * Run a git command in the given directory, returning stdout.
 * Returns null on error.
 */
function gitExec(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Commit all changes in workDir with message `autoagent: {summary}`.
 *
 * Safety guards:
 *  - Only operates inside an existing git repo (never runs `git init`)
 *  - Respects `.gitignore` via `git add -A`
 *  - Disabled when env var AUTOAGENT_NO_AUTOCOMMIT=1
 *  - Never force-pushes or rebases
 */
export async function autoCommit(
  workDir: string,
  summary: string,
): Promise<AutoCommitResult> {
  // Env-var disable guard
  if (process.env.AUTOAGENT_NO_AUTOCOMMIT === "1") {
    return { committed: false };
  }

  // Must be inside an existing git repo
  const isRepo = gitExec("git rev-parse --is-inside-work-tree", workDir);
  if (isRepo !== "true") {
    return { committed: false };
  }

  // Check for any changes (staged or unstaged)
  const status = gitExec("git status --porcelain", workDir);
  if (status === null || status === "") {
    return { committed: false };
  }

  // Stage everything (respects .gitignore)
  const addResult = gitExec("git add -A", workDir);
  if (addResult === null) {
    // git add failed — bail silently
    return { committed: false };
  }

  // Build commit message — truncate summary to 72 chars total header line
  const truncated = summary.slice(0, 72).replace(/\n.*/s, "").trim();
  const message = `autoagent: ${truncated}`;

  // Commit
  const commitOut = gitExec(`git commit -m ${JSON.stringify(message)}`, workDir);
  if (commitOut === null) {
    return { committed: false };
  }

  // Extract short hash
  const hash = gitExec("git rev-parse --short HEAD", workDir) ?? undefined;

  return { committed: true, hash, message };
}

/**
 * Undo the last autoagent commit using `git reset --soft HEAD~1`.
 *
 * Safety guards:
 *  - Only undoes commits whose message starts with `autoagent:`
 *  - Uses --soft reset (no data loss — changes become staged)
 *  - Won't undo if working tree has uncommitted changes
 *  - Disabled when AUTOAGENT_NO_AUTOCOMMIT=1
 */
export async function undoLastCommit(workDir: string): Promise<UndoResult> {
  // Env-var disable guard
  if (process.env.AUTOAGENT_NO_AUTOCOMMIT === "1") {
    return { undone: false, error: "Auto-commit is disabled (AUTOAGENT_NO_AUTOCOMMIT=1)" };
  }

  // Must be inside an existing git repo
  const isRepo = gitExec("git rev-parse --is-inside-work-tree", workDir);
  if (isRepo !== "true") {
    return { undone: false, error: "Not inside a git repository" };
  }

  // Refuse if working tree has uncommitted changes
  const status = gitExec("git status --porcelain", workDir);
  if (status === null) {
    return { undone: false, error: "Could not check git status" };
  }
  if (status !== "") {
    return { undone: false, error: "Working tree has uncommitted changes — commit or stash them first" };
  }

  // Get HEAD commit info
  const hash = gitExec("git rev-parse --short HEAD", workDir);
  if (hash === null) {
    return { undone: false, error: "No commits found" };
  }

  const message = gitExec("git log -1 --format=%s", workDir);
  if (message === null) {
    return { undone: false, error: "Could not read HEAD commit message" };
  }

  // Safety: only undo autoagent commits
  if (!message.startsWith("autoagent:")) {
    return { undone: false, error: `Last commit "${message}" is not an autoagent commit` };
  }

  // Soft reset — changes return to staging area
  const resetResult = gitExec("git reset --soft HEAD~1", workDir);
  if (resetResult === null) {
    return { undone: false, error: "git reset --soft HEAD~1 failed" };
  }

  return { undone: true, hash, message };
}
