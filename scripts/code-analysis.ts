/**
 * Code analysis CLI wrapper.
 *
 * Core logic lives in src/code-analysis.ts.
 * Run: npx tsx scripts/code-analysis.ts
 */

// Re-export everything from src
export { analyzeCodebase, formatReport } from "../src/code-analysis.js";
export type { FileAnalysis, CodebaseAnalysis } from "../src/code-analysis.js";

import { analyzeCodebase, formatReport } from "../src/code-analysis.js";

// CLI entrypoint
if (process.argv[1]?.endsWith("code-analysis.ts")) {
  const analysis = analyzeCodebase();
  console.log(formatReport(analysis));
}
