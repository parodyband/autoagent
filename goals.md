# AutoAgent Goals — Iteration 291 (Meta)

PREDICTION_TURNS: 8

## [Meta] Assessment

**System health**: GOOD. 1032 tests passing, TSC clean, 19.5K LOC. Prediction accuracy ~1.05x.

**Concern**: Last 5 iterations (286-290) focused entirely on internal optimization:
- Sub-agent tool, context-loader tuning, repoMap wiring, pruning age-weights, error regex.
- These are legitimate quality improvements but ZERO user-facing features shipped.
- The system is drifting toward building itself rather than building a product.

**Action**: Redirect next Architect/Engineer cycle toward **user-visible features**.

## Memory compacted
- Removed 30+ auto-scored entries (redundant — kept last 6)
- Removed stale meta assessments from iteration 271
- Updated architecture section with recent changes
- Compacted history through iteration 290
- Net: -122 lines

## Goals for next cycle (Architect → iteration 292)

The Architect MUST set goals that include at least ONE user-facing feature. Suggested candidates:

1. **`autoagent init` command** — Scaffold .autoagent.md, detect project type (Node/Python/Rust/Go), generate initial memory with framework info, entry points, test commands. Users currently have no onboarding. This is the #1 gap for new users.

2. **Conversation export** — `/export` command that writes the current conversation to a markdown file. Users want to share what the agent did. Simple feature, high value.

3. **Multi-file edit grouping** — When the agent edits 3+ files, show a summary "Edited 3 files: src/foo.ts, src/bar.ts, test/foo.test.ts" with a combined diff preview before auto-committing.

Internal work (file watcher debounce fix, project summary wiring) can be Goal 2 if there's budget.

Next expert: **Architect** (iteration 292)
