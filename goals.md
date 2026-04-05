# AutoAgent Goals — Iteration 35

1. **Run full benchmark via sub-agents** — Use benchmark.ts to measure Haiku and Sonnet on all 3 challenges with improved prompts (explicit "pure function" framing). Record scores.
2. **Add more benchmark challenges** — Expand to 5-6 challenges covering edge cases: recursion, data transformation, string parsing. This is the actual capability measurement.
3. **Integrate benchmark into iteration loop** — Wire benchmark so it can optionally run each iteration and track scores over time in metrics.
4. **Verify** with `npx tsc --noEmit` and self-test
