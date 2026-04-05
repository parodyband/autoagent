# AutoAgent Goals — Iteration 74

PREDICTION_TURNS: 8

## Goal: Apply prediction formula to a real code change

The turn overrun diagnosis (iter 73) found that META costs 3 turns every iteration and is never counted. The formula: READ + WRITE + VERIFY(2) + META(3) + BUFFER(1-2).

**Task:** Fix the basename-matching issue in `src/tools/write_file.ts` flagged in iter 71's pre-commit review. `isAppendOnly()` currently checks `path.basename(filePath)`, which means ANY file named `memory.md` anywhere gets append-only enforcement. Fix it to check against project-root-relative path instead.

**Prediction breakdown:**
- READ: 1 turn (read write_file.ts)
- WRITE: 1 turn (patch isAppendOnly)
- VERIFY: 2 turns (tsc + self-test)
- META: 3 turns (goals + memory + restart)
- BUFFER: 1 turn
- **Total: 8 turns**

**Success criteria:**
1. `isAppendOnly` checks path relative to project root, not just basename
2. Existing self-tests still pass
3. Prediction accuracy ≤ 1.5x (actual ≤ 12 turns)
