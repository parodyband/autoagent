/**
 * Adaptive turn budgeting — the agent uses its own historical metrics
 * to set a dynamic turn budget for the current iteration.
 *
 * This is the first "closed feedback loop": metrics → behavior change.
 * Instead of just predicting turns, the agent constrains itself based
 * on what it has learned about its own performance.
 */

import { readFileSync, existsSync } from "fs";

export interface TurnBudget {
  /** Recommended max turns for this iteration */
  recommended: number;
  /** Hard ceiling (never exceed) */
  hardMax: number;
  /** Turn at which to warn (80% of recommended) */
  warnAt: number;
  /** Historical average turns per iteration */
  historicalAvg: number;
  /** How many past iterations were sampled */
  sampleSize: number;
  /** The predicted turns from goals.md, if any */
  predicted: number | null;
}

interface MetricsEntry {
  iteration: number;
  turns: number;
  success: boolean;
  predictedTurns?: number;
}

/**
 * Read metrics history and compute an adaptive turn budget.
 *
 * Logic:
 * - Compute average turns over last N successful iterations
 * - If goals.md has a prediction, use min(prediction * 1.3, avg * 1.2) as budget
 * - If no prediction, use avg * 1.2 as budget
 * - Hard max is always 25 (system constraint)
 * - Warn at 80% of recommended budget
 */
export function computeTurnBudget(
  metricsFile: string,
  predictedTurns: number | null,
  hardMax: number = 25,
  lookback: number = 10,
): TurnBudget {
  let entries: MetricsEntry[] = [];

  if (existsSync(metricsFile)) {
    try {
      const raw = readFileSync(metricsFile, "utf-8");
      entries = JSON.parse(raw) as MetricsEntry[];
    } catch {
      // Corrupted metrics — fall back to defaults
    }
  }

  // Filter to recent successful iterations
  const successful = entries.filter(e => e.success).slice(-lookback);
  const sampleSize = successful.length;

  if (sampleSize === 0) {
    // No history — use conservative defaults
    const recommended = predictedTurns ? Math.min(Math.ceil(predictedTurns * 1.5), hardMax) : 18;
    return {
      recommended,
      hardMax,
      warnAt: Math.ceil(recommended * 0.8),
      historicalAvg: 0,
      sampleSize: 0,
      predicted: predictedTurns,
    };
  }

  const avgTurns = successful.reduce((sum, e) => sum + e.turns, 0) / sampleSize;

  // Determine recommended budget
  let recommended: number;
  if (predictedTurns !== null && predictedTurns > 0) {
    // Use the more conservative of: prediction with buffer, or historical avg with buffer
    const fromPrediction = Math.ceil(predictedTurns * 1.3);
    const fromHistory = Math.ceil(avgTurns * 1.2);
    recommended = Math.min(fromPrediction, fromHistory);
  } else {
    recommended = Math.ceil(avgTurns * 1.2);
  }

  // Clamp to [8, hardMax]
  recommended = Math.max(8, Math.min(recommended, hardMax));

  return {
    recommended,
    hardMax,
    warnAt: Math.ceil(recommended * 0.8),
    historicalAvg: Math.round(avgTurns * 10) / 10,
    sampleSize,
    predicted: predictedTurns,
  };
}

/**
 * Format the turn budget as a human-readable string for logging.
 */
export function formatTurnBudget(budget: TurnBudget): string {
  const parts = [
    `Turn budget: ${budget.recommended}/${budget.hardMax}`,
    `(warn at ${budget.warnAt})`,
  ];
  if (budget.sampleSize > 0) {
    parts.push(`Historical avg: ${budget.historicalAvg} turns over ${budget.sampleSize} iterations`);
  }
  if (budget.predicted !== null) {
    parts.push(`Predicted: ${budget.predicted}`);
  }
  return parts.join(" | ");
}

/**
 * Generate a budget warning message if the current turn exceeds the warn threshold.
 * Returns null if no warning needed.
 */
export function dynamicBudgetWarning(turn: number, budget: TurnBudget): string | null {
  if (turn === budget.warnAt) {
    return (
      `SYSTEM: ⚠️ ADAPTIVE BUDGET WARNING — Turn ${turn}/${budget.recommended} (${Math.round(turn / budget.recommended * 100)}% of budget). ` +
      `Historical avg: ${budget.historicalAvg} turns. ` +
      `You are approaching your adaptive turn budget. ` +
      `Start wrapping up: finish current work, write memory, update goals, run \`npx tsc --noEmit\`, \`echo "AUTOAGENT_RESTART"\`. ` +
      `Every turn past ${budget.recommended} is overshoot.`
    );
  }
  if (turn === budget.recommended) {
    return (
      `SYSTEM: 🛑 BUDGET EXCEEDED — Turn ${turn}. You have hit your adaptive budget of ${budget.recommended} turns. ` +
      `STOP ALL WORK NOW. Write memory. Update goals. Commit. Restart. ` +
      `Hard limit is ${budget.hardMax} but you should have been done by now.`
    );
  }
  return null;
}
