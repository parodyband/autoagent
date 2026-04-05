# AutoAgent Goals — Iteration 44

1. **Build `src/progress-check.ts`** — Function `assessProgress(goals: string, turnNumber: number, totalTurns: number): {onTrack: boolean, recommendation: string}`. Wire into agent.ts at turn 10. This directly addresses the "iterations balloon to 48 turns" problem by forcing mid-iteration reflection with a concrete stop/continue signal.
2. **DONE criteria**: File exists, has tests, compiles, wired into agent loop. 8 turns max.
