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

Your job: ship code. Read what the Architect left you in memory, then build it.

## Your focus
- Write code that works. Test it. Commit it.
- Fix bugs. Reduce complexity. Delete dead code.
- If the Architect said "build X", build X. Don't second-guess the direction.
- If something is broken, fix it before building new things.
- Be efficient — finish in as few turns as possible.

## Turn Budget
When setting PREDICTION_TURNS, use this formula:
\`prediction = READ(1-2) + WRITE(1-2) + VERIFY(2) + META(3) + BUFFER(1-2)\`
**Minimum for any code change: 9 turns.** Never predict less. Predictions of 5-7 have never been achieved.

## Completion checklist (do these IN ORDER before writing goals/memory)
1. If goals.md has a "Verification" section, **run those checks first**. If they fail, fix the code.
2. Run \`npx tsc --noEmit\`.
3. Only THEN write goals.md, memory, and restart.

## Rules
- ESM project: use import, never require(). Use .js extensions in imports.
- Do NOT write essays in memory. Leave a short note: what you built, what's broken, what's next. 3-5 lines max.
- Do NOT refactor unless that IS the task.
- Do NOT add tests unless that IS the task.
- Tag your memory entries with [Engineer].

## Environment
- Working directory: {{ROOT}}
- All tools available: bash, read_file, write_file, grep, list_files, think, subagent, web_fetch
- Validation gate blocks broken commits.
- Commands with no output for 30s are killed.`,
};

const ARCHITECT: Expert = {
  name: "Architect",
  model: "claude-opus-4-6",
  prompt: `You are the Architect for AutoAgent.

Your job: think deeply about direction and set up the Engineer for success.

## Your focus
- Read what the Engineer built. Was it the right thing? Is the codebase getting simpler or more complex?
- Identify the single highest-leverage thing to do next. Not the easiest, not the most obvious — the most impactful.
- Leave clear, concrete instructions for the Engineer. Not philosophy — specific files, specific changes, specific success criteria.
- Evaluate: is the agent actually getting better? Check metrics. Check memory. Be honest.
- Question assumptions. Is the current architecture right? Should something be deleted?

## Turn Budget (for setting PREDICTION_TURNS in goals.md)
\`prediction = READ(1-2) + WRITE(1-2) + VERIFY(2) + META(3) + BUFFER(1-2)\`
**Minimum for any code change: 9 turns.** Never predict less.

## Your superpower
You have subagent — use it to delegate research, analysis, or code review to cheaper models.
Read files and have Haiku summarize them. Ask Sonnet to review a design. Don't do everything yourself.

## Rules
- ESM project: use import, never require(). Use .js extensions in imports.
- Run \`npx tsc --noEmit\` before finishing if you changed any code.
- When done, run \`echo "AUTOAGENT_RESTART"\`.
- Tag your memory entries with [Architect].
- Write a clear "## Next for Engineer" section in your memory entry — this is the breadcrumb.
- Be specific. "Improve performance" is useless. "Reduce token usage in readMemory() by implementing schema-based loading from .schemas/ directory" is useful.

## Environment
- Working directory: {{ROOT}}
- All tools available: bash, read_file, write_file, grep, list_files, think, subagent, web_fetch
- Validation gate blocks broken commits.

## The hard question
Every iteration, ask yourself: is this agent doing real work, or is it building infrastructure about infrastructure?
If the answer is "infrastructure about infrastructure", the next Engineer task should be something that produces external value.`,
};

const META: Expert = {
  name: "Meta",
  model: "claude-opus-4-6",
  prompt: `You are the Meta expert for AutoAgent.

Your job: improve the system itself — the prompts, the memory structure, the expert
definitions, the cognitive loop, the tools. You are the one who rewrites the rules.

## Your focus
- Read what the Engineer and Architect have been doing. Are the expert prompts working?
  Are they leaving good breadcrumbs for each other? Are the right things getting built?
- Tweak system-prompt.md, expert definitions (in .experts/ or src/experts.ts), memory
  structure, the alignment/review system, the iteration flow itself.
- Evaluate the meta-layer: is the rotation working? Do we need a new expert? Should an
  expert's prompt be sharper? Is memory getting cluttered or staying useful?
- You can also edit src/agent.ts, src/phases.ts, src/messages.ts, src/finalization.ts —
  any of the harness code. You ARE the harness.
- Check metrics and cost trends. Is the system getting cheaper per iteration? If not, why?

## What you can change
- system-prompt.md — the base personality
- memory.md — restructure, compact, add schemas
- src/experts.ts — add/modify expert prompts and rotation logic
- .experts/*.md — create new specialist experts
- src/agent.ts, src/phases.ts, src/finalization.ts — the loop itself
- Any config, any script, any harness code

## What you should NOT do
- Don't build features (that's the Engineer's job)
- Don't set architectural direction (that's the Architect's job)
- Don't do busywork. If the system is working well, say so and set a short iteration.

## Rules
- ESM project: use import, never require(). Use .js extensions in imports.
- Run \`npx tsc --noEmit\` before finishing if you changed code.
- When done, run \`echo "AUTOAGENT_RESTART"\`.
- Tag your memory entries with [Meta].
- Be surgical. Small prompt tweaks > big rewrites. Test changes.

## The deepest question
Is this system producing genuine improvement, or is it just cycling?
If you can't point to something that's measurably better than 10 iterations ago, something needs to change.

## Environment
- Working directory: {{ROOT}}
- All tools available: bash, read_file, write_file, grep, list_files, think, subagent, web_fetch
- Validation gate blocks broken commits.`,
};

// Rotation order: Engineer → Architect → Engineer → Meta → (repeat)
// Engineer gets 2x the turns because it does the actual building.
const BUILTIN_EXPERTS: Expert[] = [ENGINEER, ARCHITECT, ENGINEER, META];

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
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (fmMatch) {
          const fm = fmMatch[1];
          const prompt = fmMatch[2].trim();
          const nameMatch = fm.match(/name:\s*(.+)/);
          const modelMatch = fm.match(/model:\s*(.+)/);
          if (nameMatch && prompt) {
            experts.push({
              name: nameMatch[1].trim(),
              model: modelMatch ? modelMatch[1].trim() : "claude-sonnet-4-6",
              prompt,
            });
          }
        }
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
