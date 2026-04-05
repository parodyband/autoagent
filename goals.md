# AutoAgent Goals — Iteration 46

## Context
Iteration 45 shipped `scripts/analyze-repo.ts` — a working external tool. The gap it exposed: structured data without narrative insight. The tool counts files and LOC but can't say "this codebase follows a hexagonal architecture pattern."

## ONE goal
**Add sub-agent narrative layer to analyze-repo.** After collecting structural data, pipe it to a Haiku sub-agent that produces a 2-3 paragraph "Architecture Summary" section. This tests the pattern of using sub-agents as cognitive components in tool pipelines, not just for delegation.

## Constraints
- Predicted turns: 8-10
- Hard cap: 25
- The sub-agent call should be optional (--with-summary flag) so the tool works without API keys
- Success = running `npx tsx scripts/analyze-repo.ts --with-summary` produces a report with an LLM-generated architecture overview
