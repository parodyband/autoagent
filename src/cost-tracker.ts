/**
 * Cost tracking for AutoAgent API calls.
 * Estimates USD cost from token usage per model.
 */

import { MODEL_OPUS, MODEL_SONNET, MODEL_HAIKU } from "./models.js";

// Model pricing per 1M tokens (input/output) as of 2025
const PRICING: Record<string, { input: number; output: number }> = {
  [MODEL_SONNET]: { input: 3, output: 15 },
  [MODEL_OPUS]: { input: 15, output: 75 },
  [MODEL_HAIKU]: { input: 1, output: 5 },
  // Legacy model IDs for historical cost entries
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-3-5-haiku-20241022": { input: 1, output: 5 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-7-sonnet-20250219": { input: 3, output: 15 },
};

export interface CostEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;       // USD
  timestamp: number;
}

export class CostTracker {
  private entries: CostEntry[] = [];

  record(model: string, inputTokens: number, outputTokens: number): CostEntry {
    const pricing = PRICING[model] ?? { input: 3, output: 15 }; // fallback to sonnet pricing
    const cost =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output;

    const entry: CostEntry = {
      model,
      inputTokens,
      outputTokens,
      cost,
      timestamp: Date.now(),
    };
    this.entries.push(entry);
    return entry;
  }

  get totalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.cost, 0);
  }

  get totalInputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.inputTokens, 0);
  }

  get totalOutputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.outputTokens, 0);
  }

  /** Format: "$0.42 (12.3K in / 4.1K out)" */
  get sessionSummary(): string {
    const cost = this.totalCost;
    const inK = (this.totalInputTokens / 1000).toFixed(1);
    const outK = (this.totalOutputTokens / 1000).toFixed(1);
    return `$${cost.toFixed(2)} (${inK}K in / ${outK}K out)`;
  }

  get entryCount(): number {
    return this.entries.length;
  }

  reset(): void {
    this.entries = [];
  }
}
