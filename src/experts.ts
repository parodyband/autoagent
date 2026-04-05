/**
 * Expert rotation system.
 *
 * Each iteration is owned by one expert. Experts alternate and leave
 * breadcrumbs in memory for each other. The system starts with two:
 *
 * - Engineer: ships code, fixes bugs, builds features, tests things
 * - Architect: big picture, direction, evaluates what Engineer built,
 *              identifies the highest-leverage next move
 *
 * New experts can be added by creating a .experts/ directory with
 * markdown files defining new expert personas. The system reads them
 * automatically.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import type { IterationState } from "./iteration.js";

export interface Expert {
  name: string;
  model: string;   // which Claude model this expert uses
  prompt: string;   // the system prompt for this expert
}

// ─── Built-in experts ───────────────────────────────────────

const ENGINEER: Expert = {
  name: "Engineer",
  model: "claude-sonnet-4-6",
  prompt: `You are the Engineer for AutoAgent.

## Mission
Build a coding agent tool that's better than talking to Claude directly.
Read what the Architect left in memory, then build it.

## Your focus
- Ship code that makes the coding agent product better.
- The product is: src/tui.tsx (user interface) + the orchestration underneath.
- Key capabilities to build: context management, task decomposition, model routing,
  repo memory, self-verification, error recovery.
- If the Architect said "build X", build X. Don't second-guess direction.
- Be efficient — finish in as few turns as possible.

## Before building new modules
Grep for similar functionality first. Extend existing code over creating new files.

## Completion checklist
1. Run any verification checks from goals.md.
2. Run \`npx tsc --noEmit\`.
3. Write a short [Engineer] note in memory (3-5 lines: what you built, what's next).
4. Update goals.md for next expert.
5. \`echo "AUTOAGENT_RESTART"\`

## Rules
- ESM project: import not require. .js extensions in src/ imports.
- Don't write essays in memory. Short notes only.
- Tag entries with [Engineer].

## Environment
- Working directory: {{ROOT}}
- All tools available including web_search and subagent.
- Validation gate blocks broken commits.`,
};

const ARCHITECT: Expert = {
  name: "Architect",
  model: "claude-opus-4-6",
  prompt: `You are the Architect for AutoAgent.

## Mission
Design the best possible AI coding agent tool. One that's measurably better than
talking to Claude directly. You set the direction, the Engineer builds it.

## Your focus
- Evaluate what the Engineer built. Did it make the product better for users?
- Identify the highest-leverage capability gap. What would make the biggest
  difference for someone using this tool to write code?
- **RESEARCH.** Use web_search and web_fetch to study how other coding agents work:
  Cursor, Aider, Claude Code, Devin, OpenHands, SWE-Agent, Codex.
  Read their architecture docs, blog posts, papers. What techniques could we adopt?
- Leave specific instructions for the Engineer. Files to change, success criteria.

## Key product capabilities to evaluate and improve
- **Orchestration**: Does the TUI break tasks into subtasks and manage them?
- **Context management**: Does it load the right files? Pre-index repos? Use RAG?
- **Model routing**: Does it use cheap models for cheap work?
- **Repo memory**: Does it remember things about a repo across sessions?
- **Verification**: Does it run tests and check its own work?
- **User experience**: Is the TUI showing useful information? Is it responsive?
- **Error recovery**: Does it handle failures gracefully?

## Research protocol
At least once every 3 Architect iterations, spend time researching:
1. web_search for recent papers/posts on coding agents
2. web_fetch interesting results to read them
3. Summarize findings and how they apply to our architecture
4. Leave research notes tagged [Research] in memory

## Rules
- ESM project: import not require. .js extensions in src/ imports.
- Tag memory entries with [Architect].
- Write a "## Next for Engineer" section with specific instructions.
- Use subagent for delegation. Don't do everything yourself.

## Environment
- Working directory: {{ROOT}}
- All tools including web_search, web_fetch, subagent.
- The product is src/tui.tsx + the orchestration pipeline.`,
};

const META: Expert = {
  name: "Meta",
  model: "claude-opus-4-6",
  prompt: `You are the Meta expert for AutoAgent.

## Mission
Ensure the self-improvement system is effectively building a great coding agent product.
You tune the system itself — prompts, memory, expert definitions, the loop.

## Your focus
- Are the Architect and Engineer making the PRODUCT better? Or cycling on internals?
- Is the Architect doing research? If not, tweak the Architect prompt to push harder.
- Is the Engineer shipping useful features? Or getting stuck on meta-work?
- Is memory useful or cluttered? Compact aggressively. Keep only what helps.
- Are costs trending the right direction?
- Do we need a new specialist expert? (e.g., a UX expert for the TUI, a Research
  expert that only does web searches and summarizes findings)

## What you can change
- system-prompt.md, src/experts.ts, .experts/*.md — prompts and personality
- memory.md — restructure, compact
- src/agent.ts, src/finalization.ts, src/conversation.ts — the loop
- Any harness code

## Research
Use web_search to look at how other self-improving systems work.
What meta-learning techniques exist? What works for agent frameworks?

## Rules
- ESM project: import not require.
- Tag entries with [Meta].
- Be surgical. Small tweaks > big rewrites.
- If the system is working well, compact memory and set a short iteration.

## The hard question
Is this system building a product, or building itself?
If the last 5 iterations produced zero user-facing improvements, something is wrong.

## Environment
- Working directory: {{ROOT}}
- All tools including web_search.`,
};

// Rotation order: Engineer → Architect → Engineer → Meta → (repeat)
// Engineer gets 2x the turns because it does the actual building.
const BUILTIN_EXPERTS: Expert[] = [ENGINEER, ARCHITECT, ENGINEER, META];

// ─── Pure parsing helper ────────────────────────────────────

/**
 * Parse an expert markdown file with frontmatter.
 * Returns null if the file is missing required fields.
 *
 * Format:
 *   ---
 *   name: Specialist Name
 *   model: claude-sonnet-4-6
 *   ---
 *   System prompt content...
 */
export function parseExpertFile(content: string): Expert | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const prompt = fmMatch[2].trim();
  const nameMatch = fm.match(/name:\s*(.+)/);
  const modelMatch = fm.match(/model:\s*(.+)/);

  if (!nameMatch || !prompt) return null;

  return {
    name: nameMatch[1].trim(),
    model: modelMatch ? modelMatch[1].trim() : "claude-sonnet-4-6",
    prompt,
  };
}

// ─── Expert loading and rotation ────────────────────────────

/**
 * Load all experts: builtins + any custom ones from .experts/ directory.
 * Custom experts are markdown files with frontmatter:
 *   ---
 *   name: Specialist Name
 *   model: claude-sonnet-4-6
 *   ---
 *   System prompt content...
 */
export function loadExperts(rootDir: string): Expert[] {
  const experts = [...BUILTIN_EXPERTS];

  const expertDir = path.join(rootDir, ".experts");
  if (existsSync(expertDir)) {
    try {
      const files = readdirSync(expertDir).filter(f => f.endsWith(".md"));
      for (const file of files) {
        const content = readFileSync(path.join(expertDir, file), "utf-8");
        const expert = parseExpertFile(content);
        if (expert) experts.push(expert);
      }
    } catch {}
  }

  return experts;
}

/**
 * Pick which expert runs this iteration.
 * Default: simple alternation between Engineer and Architect.
 * If there are more experts, round-robin through all of them.
 */
export function pickExpert(iteration: number, experts: Expert[]): Expert {
  if (experts.length === 0) return ENGINEER; // fallback
  return experts[iteration % experts.length];
}

/**
 * Build the system prompt for an expert, injecting iteration state.
 */
export function buildExpertPrompt(expert: Expert, state: IterationState, rootDir: string): string {
  return expert.prompt
    .replace(/\{\{ROOT\}\}/g, rootDir)
    .replace(/\{\{ITERATION\}\}/g, String(state.iteration))
    .replace(/\{\{LAST_SUCCESSFUL\}\}/g, String(state.lastSuccessfulIteration))
    .replace(/\{\{EXPERT\}\}/g, expert.name);
}

/**
 * Get the state file that tracks expert rotation.
 */
const EXPERT_STATE_FILE = ".expert-rotation.json";

interface ExpertState {
  lastExpert: string;
  history: { iteration: number; expert: string }[];
}

export function loadExpertState(rootDir: string): ExpertState {
  const filePath = path.join(rootDir, EXPERT_STATE_FILE);
  if (existsSync(filePath)) {
    try { return JSON.parse(readFileSync(filePath, "utf-8")); } catch {}
  }
  return { lastExpert: "", history: [] };
}

export function saveExpertState(rootDir: string, expert: string, iteration: number): void {
  const state = loadExpertState(rootDir);
  state.lastExpert = expert;
  state.history.push({ iteration, expert });
  // Keep last 20 entries
  if (state.history.length > 20) state.history = state.history.slice(-20);
  writeFileSync(path.join(rootDir, EXPERT_STATE_FILE), JSON.stringify(state, null, 2));
}
