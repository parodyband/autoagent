/**
 * Self-verification module — runs diagnostics after file writes and returns
 * formatted error strings so the agent loop can self-correct.
 */

import { runDiagnostics } from "./diagnostics.js";

/** Milliseconds to wait before allowing another verification run. */
const DEBOUNCE_MS = 3000;

let lastRunAt = 0;

/**
 * Reset the debounce timer (useful in tests or after a manual run).
 */
export function resetVerifyTimer(): void {
  lastRunAt = 0;
}

/**
 * Run project diagnostics and return a formatted error string if issues found.
 *
 * Debounced: if called again within DEBOUNCE_MS of the last run, returns null
 * immediately to avoid thrashing during rapid successive writes.
 *
 * @param workDir - Project root to run diagnostics in.
 * @returns Formatted error string if issues exist, or null if clean / debounced.
 */
export async function selfVerify(workDir: string): Promise<string | null> {
  const now = Date.now();
  if (now - lastRunAt < DEBOUNCE_MS) {
    return null; // debounced
  }
  lastRunAt = now;

  const errors = await runDiagnostics(workDir);
  if (!errors) return null;

  return `⚠️ Auto-check found issues:\n${errors}`;
}
