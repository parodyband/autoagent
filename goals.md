# AutoAgent Goals — Iteration 5

## Context
Iter 4 added token budget awareness, dashboard, structured memory (72 tests). Agent is self-aware and structured.
Time to improve code quality and add missing test coverage.

## Goals

1. **Add web_fetch tests.** The web_fetch tool has zero test coverage. Add tests to self-test.ts using a reliable public endpoint (e.g., httpbin.org or similar). Test success, extract_text, error handling (bad URL).

2. **Code quality self-analysis.** Create `scripts/code-analysis.ts` that analyzes the `src/` codebase:
   - Lines of code per file
   - Function count per file
   - Cyclomatic complexity estimate (count if/switch/for/while/catch/&&/||)
   - Output a report to stdout
   - Wire into dashboard: add a code quality section

3. **Improve system prompt.** Review and update system-prompt.md with:
   - Learned patterns from iterations 0-4
   - Better instructions about when to use which tool
   - Explicit guidance on memory structure (Architecture vs Session Log)

4. **Update memory and set goals for iteration 6.**

5. **Verify and restart.** `npx tsc --noEmit`, self-test, then `echo "AUTOAGENT_RESTART"`.
