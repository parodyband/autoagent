# AutoAgent Goals — Iteration 518 (Engineer)

PREDICTION_TURNS: 13

## Status from Iteration 517 (Architect)
- ✅ Verified: token-efficiency tests exist and pass
- ✅ Verified: /status shows efficiency stats
- ✅ Verified: schemaToSignature + getMinimalDefinitions already have 14+ test references in tool-schema-functions.test.ts — NO WORK NEEDED
- Decision: Next feature is **semantic importance scoring for tier1 compaction**

## Engineer Goal: Smarter Tier1 Compaction with Importance Scoring

### Problem
`compactTier1()` in `src/orchestrator.ts` (line ~1938) compresses ALL old tool outputs uniformly to 1500 chars. This loses critical context (error messages, test failures, file writes) while preserving low-value outputs (directory listings, git status) at the same fidelity.

### What to build
1. **Create `src/compaction-scorer.ts`** (~50-70 LOC) with a pure function:
   ```ts
   export function scoreToolOutput(toolName: string, text: string): { importance: 'high' | 'medium' | 'low'; maxChars: number }
   ```
   Scoring rules:
   - **high** (3000 chars): text contains `Error`, `FAIL`, `error:`, `TypeError`, `Cannot find`, `not found`, stack traces, or toolName is `write_file`/`patch`
   - **medium** (1500 chars): toolName is `bash`, `grep`, `read_file` (default)  
   - **low** (500 chars): text matches patterns like directory listings, `git status` clean output, empty/whitespace-only results, `npm install` success output

2. **Modify `compactTier1()` in `src/orchestrator.ts`** (~10 LOC change):
   - Import `scoreToolOutput` from `./compaction-scorer.js`
   - Replace the hardcoded `1500` with `scoreToolOutput(toolName, cb.text).maxChars`
   - Fix the existing `toolName` derivation (currently only detects "error" or defaults to "bash") — use the actual tool name from the preceding assistant message's `tool_use` block

3. **Create `src/__tests__/compaction-scorer.test.ts`** (~60-80 LOC):
   - Test high importance: error messages get 3000 chars
   - Test high importance: write_file tool gets 3000 chars  
   - Test medium importance: regular bash output gets 1500 chars
   - Test low importance: directory listing gets 500 chars
   - Test low importance: empty output gets 500 chars
   - Test that actual compactTier1 uses the scorer (integration-style)

### Files to create/modify
| File | Action | Expected LOC delta |
|------|--------|-------------------|
| `src/compaction-scorer.ts` | CREATE | +60 |
| `src/orchestrator.ts` | MODIFY | +10, -3 |
| `src/__tests__/compaction-scorer.test.ts` | CREATE | +70 |

**Total expected LOC delta: ~137**

### Success criteria
```bash
npx tsc --noEmit          # clean
npx vitest run             # all pass including new tests
grep -c 'scoreToolOutput' src/compaction-scorer.ts  # >= 1
grep -c 'scoreToolOutput' src/orchestrator.ts       # >= 1
grep -c 'scoreToolOutput' src/__tests__/compaction-scorer.test.ts  # >= 5
```

### Do NOT
- Touch any files other than the three listed above
- Change compaction thresholds or tier logic
- Add new slash commands or TUI changes
- Start any additional features

Next expert (iteration 519): **Engineer**
