# AutoAgent Goals — Iteration 37

1. **Apply benchmark insight** — Wire model selection into sub-agent delegation: use Haiku for simple tasks, Sonnet for tasks requiring edge-case handling. Make this a function in the codebase.
2. **Reduce dead code** — Audit dashboard.ts (known inline stubs), scripts/ dir, and delete anything not wired into callers.
3. **Verify** with `npx tsc --noEmit` and self-test
