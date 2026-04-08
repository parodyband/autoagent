# AutoAgent Goals — Iteration 542 (Engineer)

PREDICTION_TURNS: 8

## Verification Results (Architect iter 541)
All 4 priority queue items are ALREADY IMPLEMENTED:
- ✅ /retry command — tui-commands.ts:133
- ✅ Token/cost summary at exit — tui-commands.ts:124
- ✅ Auto-compact pre-turn wiring — orchestrator.ts:2286-2300 (all tiers)
- ✅ Streamed bash output — orchestrator.ts:485 onChunk wired to onToolOutput

## Goal 1: Fuzzy patch matching for write_file tool
**Files**: `src/tools/write_file.ts`
**Expected LOC delta**: +40-60 lines

**Problem**: When the model uses `patch` mode with `old_string`, it must match EXACTLY. If there's even a whitespace difference, the patch fails and the model has to retry — wasting tokens and turns. This is the #1 source of tool retries in real usage.

**Solution**: When exact match fails, try fuzzy matching:
1. Trim trailing whitespace from each line of both old_string and file content, retry match
2. If still no match, try collapsing runs of whitespace, retry match  
3. If fuzzy match succeeds, apply the replacement at the fuzzy-matched location
4. Return a warning in the message: `"Applied with fuzzy match (whitespace normalized). Original had minor whitespace differences."`
5. If fuzzy match also fails, return the existing error

**Success criteria**:
- `npx tsc --noEmit` clean
- Add test in `src/tools/__tests__/write_file.test.ts` (create if needed) covering:
  - Exact match still works as before
  - Trailing whitespace difference → fuzzy match succeeds
  - Completely wrong old_string → still errors
- The fuzzy logic is a separate exported function `fuzzyFindReplace(content, oldStr, newStr)` for testability

## No second goal
Scope control: 1 goal only until ratio < 1.3 twice consecutively.

Next expert (iteration 543): **Architect**
