/**
 * Adaptive turn budgeting — the agent uses its own historical metrics
 * to set a dynamic turn budget for the current iteration.
 *
 * This is the first "closed feedback loop": metrics → behavior change.
 * Instead of just predicting turns, the agent constrains itself based
 * on what it has learned about its own performance.
 */

import { readFileSync, existsSync } from "fs";
import path from "path";

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
  /** Calibration factor from past prediction accuracy (1.0 = perfect) */
  calibration: number;
}

interface MetricsEntry {
  iteration: number;
  turns: number;
  success: boolean;
  predictedTurns?: number;
}

/**
 * Read past prediction accuracy ratios from memory.md.
 * These are injected by finalization.ts as [AUTO-SCORED] lines.
 * Returns array of (actual/predicted) ratios, most recent last.
 */
export function readPredictionCalibration(rootDir: string): number[] {
  const memFile = path.join(rootDir, "memory.md");
  if (!existsSync(memFile)) return [];
  const content = readFileSync(memFile, "utf-8");
  const ratios: number[] = [];
  const re = /\[AUTO-SCORED\].*ratio[:\s=]+(\d+\.?\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    ratios.push(parseFloat(m[1]));
  }
  return ratios;
}

/**
 * Compute a calibration factor from recent prediction accuracy.
 * If the agent consistently underestimates (ratio > 1), calibration > 1.
 * Uses median of last N ratios, clamped to [0.6, 2.5].
 * Returns 1.0 if insufficient data.
 */
export function computeCalibration(ratios: number[], minSamples: number = 2): number {
  if (ratios.length < minSamples) return 1.0;
  const recent = ratios.slice(-5); // last 5 predictions
  const sorted = [...recent].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.max(0.6, Math.min(2.5, median));
}

/**
 * Read metrics history and compute an adaptive turn budget.
 *
 * Logic:
 * - Compute average turns over last N successful iterations
 * - Read prediction accuracy history and compute calibration factor
 * - If prediction exists, adjust it: calibratedPrediction = prediction * calibration
 * - Use min(calibratedPrediction * 1.3, avg * 1.2) as budget
 * - Hard max is always 25 (system constraint)
 * - Warn at 80% of recommended budget
 */
export function computeTurnBudget(
  metricsFile: string,
  predictedTurns: number | null,
  hardMax: number = 25,
  lookback: number = 10,
  rootDir: string = ".",
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

  // Compute calibration from past prediction accuracy
  const pastRatios = readPredictionCalibration(rootDir);
  const calibration = computeCalibration(pastRatios);

  if (sampleSize === 0) {
    // No history — use conservative defaults
    const calibratedPrediction = predictedTurns ? Math.ceil(predictedTurns * calibration) : null;
    const recommended = calibratedPrediction ? Math.min(Math.ceil(calibratedPrediction * 1.5), hardMax) : 18;
    return {
      recommended,
      hardMax,
      warnAt: Math.ceil(recommended * 0.8),
      historicalAvg: 0,
      sampleSize: 0,
      predicted: predictedTurns,
      calibration,
    };
  }

  const avgTurns = successful.reduce((sum, e) => sum + e.turns, 0) / sampleSize;

  // Determine recommended budget — calibrate prediction using past accuracy
  let recommended: number;
  if (predictedTurns !== null && predictedTurns > 0) {
    // Apply calibration: if agent consistently underestimates by 1.8x, inflate prediction
    const calibratedPrediction = Math.ceil(predictedTurns * calibration);
    const fromPrediction = Math.ceil(calibratedPrediction * 1.3);
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
    calibration,
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
  if (budget.calibration !== 1.0) {
    parts.push(`Calibration: ${budget.calibration.toFixed(2)}x (${budget.calibration > 1 ? "you underestimate — budget inflated" : "you overestimate — budget deflated"})`);
  }
  return parts.join(" | ");
}

/**
 * Generate a calibration-informed suggestion for the agent's context.
 * This is THE feedback mechanism: past prediction accuracy directly
 * influences what the agent sees and thus its next prediction.
 */
export function calibrationSuggestion(budget: TurnBudget): string | null {
  if (budget.sampleSize < 3) return null; // Not enough data

  const suggestedPrediction = Math.round(budget.historicalAvg * budget.calibration);
  const clamped = Math.max(6, Math.min(suggestedPrediction, budget.hardMax));

  if (budget.calibration > 1.2) {
    return `## Calibration Advisory\n\nYour past predictions underestimate by ${budget.calibration.toFixed(1)}x. Average actual turns: ${budget.historicalAvg}. **Suggest predicting ${clamped} turns** for next iteration. Budget: ${budget.recommended} turns.`;
  } else if (budget.calibration < 0.8) {
    return `## Calibration Advisory\n\nYour past predictions overestimate by ${(1 / budget.calibration).toFixed(1)}x. Average actual turns: ${budget.historicalAvg}. **Suggest predicting ${clamped} turns** for next iteration. Budget: ${budget.recommended} turns.`;
  }
  return `## Calibration Advisory\n\nPredictions well-calibrated (${budget.calibration.toFixed(2)}x). Average actual: ${budget.historicalAvg} turns. Budget: ${budget.recommended} turns.`;
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
