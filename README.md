# AutoAgent

An autonomous coding agent that runs in a loop: reads goals, calls Claude, uses tools, validates, commits, and restarts. Designed to be CI/CD-composable.

## Install

```bash
npm install
cp .env.example .env  # add your ANTHROPIC_API_KEY
```

### Global install (run from any directory)

```bash
npm link
```

This registers the `autoagent` command globally. You can then launch the TUI from any project:

```bash
cd ~/my-project
autoagent                    # opens TUI in current directory
autoagent --dir /other/repo  # or target a specific repo
```

## Run

```bash
# Continuous mode — reads goals.md and loops
npx tsx src/agent.ts

# Operate on an external repository
npx tsx src/agent.ts --repo /path/to/project

# One-shot task (writes TASK.md, runs one iteration)
npx tsx src/agent.ts --task "Fix the null check in parser.ts"

# Single iteration, then exit (CI/CD mode)
npx tsx src/agent.ts --once --task "Add input validation"

# Print help
npx tsx src/agent.ts --help
```

## CLI Flags

| Flag | Description |
|------|-------------|
| `--task "<description>"` | Run a one-shot task described inline. Writes a TASK.md and executes it. |
| `--repo <path>` | Operate on an external repository. AutoAgent's own state files stay in its home directory; code changes go to `<path>`. |
| `--once` | Run exactly one iteration and exit. Emits a JSON summary to stdout. Exit code 0 = success, 1 = failure. |
| `-h, --help` | Print help and exit. |

## Expert Rotation

AutoAgent rotates between three expert personas, each with a different focus:

| Expert | Model | Role |
|--------|-------|------|
| **Engineer** | Claude Sonnet | Writes code, fixes bugs, commits changes |
| **Architect** | Claude Opus | Reviews design, plans next goals, sets direction |
| **Meta** | Claude Opus | Reflects on process, updates behavioral principles |

Rotation order: `Engineer → Architect → Engineer → Meta → …`

Each expert writes `goals.md` for the next iteration, targeting the appropriate successor expert.

## `--once` JSON Output Schema

When run with `--once`, a JSON summary is written to stdout on exit:

```json
{
  "success": true,
  "iteration": 42,
  "turns": 11,
  "durationMs": 94300,
  "filesChanged": ["src/parser.ts", "README.md"],
  "exitCode": 0,
  "tokensUsed": {
    "input": 12000,
    "output": 3400,
    "cacheRead": 8000,
    "cacheCreation": 4000
  },
  "commitSha": "a1b2c3d4e5f6..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the iteration completed without error |
| `iteration` | number | Iteration number |
| `turns` | number | Number of conversation turns used |
| `durationMs` | number | Wall-clock time in milliseconds |
| `filesChanged` | string[] | Files changed in the git commit |
| `exitCode` | number | 0 = success, 1 = failure |
| `tokensUsed` | object | Token breakdown (input, output, cacheRead, cacheCreation) |
| `commitSha` | string | SHA of the commit made this iteration |

## Interactive TUI

autoagent includes a full interactive terminal UI built with [Ink](https://github.com/vadimdemedes/ink) (React for the terminal).

```bash
npm run tui                              # launch in current directory
npm run tui -- --dir /path/to/repo       # target a specific repo
npm run tui -- --continue                # resume last session
```

### Layout

```
┌─────────────────────────────────────────────────────┐
│  autoagent / project / model   ⎇ main ●1 ±2   ctx: │  ← Header
├─────────────────────────────────────────────────────┤
│                                                     │
│  > user message                                     │
│  assistant response with **markdown**               │
│  ▸ tool_call: read_file                             │
│                                                     │  ← Scrollable message history
│  ┌─ Architect Plan ────────────────────────┐        │
│  │ 1. Create auth middleware               │        │  ← Plan display (when active)
│  │ 2. Update route handlers                │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
│  ┌─ Diff: src/index.ts (+12 -3) ──────────┐        │
│  │ + import { auth } from './auth'         │        │  ← Diff preview (before writes)
│  │ - // TODO: add auth                     │        │
│  │              [Y]es / [N]o               │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
├─────────────────────────────────────────────────────┤
│  ⠋ Thinking...              ctx: 45K/200K (23%)    │  ← Status line
│  > _                                                │  ← Input prompt
└─────────────────────────────────────────────────────┘
```

### Features

- **Streaming responses** — text appears in real-time with a blinking cursor as Claude generates
- **Diff preview** — color-coded diffs with Y/N confirmation before any file write
- **Context budget tracking** — visual meter (green → yellow → red) with auto-compaction
- **Live git status** — branch, staged, and unstaged indicators in the header
- **Architect plans** — structured step lists with file operations (create/modify/delete)
- **Task plans** — multi-step work decomposed into a DAG with progress tracking
- **File suggestions** — type `#partial/path` to fuzzy-search and autocomplete file references
- **Session persistence** — conversations save as JSONL and resume with `--continue`
- **Virtual scrolling** — windowed message rendering with tool call collapsing
- **Markdown rendering** — bold, italic, code blocks, tables, headers, lists, blockquotes

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Enter` | Send message / accept file suggestion |
| `Tab` | Cycle through file suggestions |
| `Up/Down` | Scroll message history (when input is empty) |
| `Shift+Up/Down` | Scroll faster |
| `Esc` | Close suggestions / abort generation / exit (press twice) |
| `Y/N` | Accept or reject diff previews |

### Slash Commands

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/compact` | Force context compaction |
| `/init` | Initialize `.autoagent.md` project config |
| `/exit` | Exit with session export |
| `/reindex` | Rebuild repo file index |
| `/autoaccept` | Toggle auto-accept for diffs |
| `/dream` | Run memory consolidation |
| `/sessions` | List saved sessions |
| `/checkpoint` | Create conversation checkpoint |

### Adaptive Model Routing

Messages are automatically routed to the appropriate Claude model:

| Tier | When |
|---|---|
| **Haiku** | Read-only queries and simple lookups |
| **Sonnet** | Code changes and complex requests |
| **Opus** | Architecture and planning phases |

## Project Structure

```
src/
  agent.ts          # Main entry point and CLI
  conversation.ts   # Conversation loop (hard cap at 1.5× predicted turns)
  experts.ts        # Expert definitions and rotation logic
  finalization.ts   # Post-iteration: metrics, JSON output, git commit
  memory.ts         # Structured memory parsing and serialization
  orientation.ts    # OODA orient: diffs since last iteration
  phases.ts         # Planner and Reviewer phases (Claude Opus)
  api-retry.ts      # Exponential backoff for API calls
  tool-registry.ts  # Tool registration and dispatch
  tools/            # bash, read_file, write_file, grep, web_fetch, think, list_files
scripts/
  self-test.ts      # Pre-commit validation gate
```

## Requirements

- Node.js 18+
- `ANTHROPIC_API_KEY` in environment or `.env`
