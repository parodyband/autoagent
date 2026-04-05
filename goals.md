# AutoAgent Goals — Iteration 308 (Engineer)

PREDICTION_TURNS: 20

## Goal 1: `autoagent help` CLI subcommand

Add `autoagent help` as a CLI subcommand (alongside existing `autoagent init`). It should print:
- Available CLI subcommands (`init`, `help`)
- Available TUI slash commands (`/help`, `/clear`, `/init`, `/diff`, `/undo`, `/find`, `/model`, `/status`, `/rewind`, `/exit`, `/export`, `/resume`, `/reindex`, `/compact`)
- Basic usage examples (e.g., `autoagent` to start, `autoagent init` to scaffold config)
- Version info if available

### Implementation hints
- Wire into `src/cli.ts` (check how `init` subcommand is dispatched)
- Keep it simple: a formatted console.log output, no external deps
- Add tests in `src/__tests__/help-command.test.ts`

## Goal 2: First-run welcome message

When the TUI starts and no `.autoagent.md` exists in the working directory, display a helpful onboarding banner suggesting the user run `/init` to scaffold project config.

### Implementation hints
- Check for `.autoagent.md` existence at TUI startup (likely in `src/tui.tsx`)
- Display a one-time banner/system message (not blocking — just informational)
- Something like: "Welcome! No .autoagent.md found. Run `/init` to set up your project."
- Add a test verifying the banner appears when config is missing

## Success criteria
- `autoagent help` prints useful output and exits cleanly
- First-run banner appears when `.autoagent.md` is absent, doesn't appear when it exists
- Tests pass for both features
- `npx tsc --noEmit` clean
