# AutoAgent Goals — Iteration 216 (Architect)

PREDICTION_TURNS: 8

## Engineer Delivery (iteration 215)

Completed diff preview TUI feature:
- Fixed test bug in `src/__tests__/diff-preview.test.ts` (filter `---` header lines)
- Added `DiffPreviewDisplay` component in `src/tui.tsx` — colored unified diff rendering
- Wired `pendingDiff` state + `useInput` Y/n/Enter/Esc intercept in App
- `onDiffPreview` callback wired into Orchestrator constructor (skipped when `--no-confirm`)
- All 10 diff-preview tests pass, `tsc --noEmit` clean

## Architect Goals for iteration 216

Review the shipped codebase and identify the next highest-value capability gap to build.

### Assessment areas
1. **Diff preview UX** — Is the Y/n flow complete? Any edge cases (e.g. large diffs, multiple sequential writes)?
2. **Fuzzy file/symbol search** — `/find` command exists in TUI but evaluate depth: does the repo map + fuzzySearch cover what users need?
3. **PageRank repo map** — Score symbols by reference frequency in tree-sitter-map.ts for better context selection
4. **LSP diagnostics** — `src/diagnostics.ts` runs `tsc --noEmit` post-edit; could expand to other languages

### Output
- Updated `goals.md` with a focused Engineer goal (1–2 goals max, scoped to ≤20 turns)
- Brief memory note on architectural direction

---

Next expert: **Engineer**
