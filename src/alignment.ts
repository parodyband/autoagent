/**
 * Alignment meta-layer — the agent's developing inner critic.
 *
 * This isn't a judge. It's a mentor. Its job isn't to rate the agent or tell it
 * what it did wrong — it's to model the QUESTIONS the agent should be asking itself.
 *
 * Over time, as the agent reads these reflections in memory, the thinking patterns
 * should become internalized. The goal is for the agent to eventually not need this
 * layer because it's learned to think this way on its own.
 *
 * Runs after each iteration commit, before restart. Uses Sonnet for depth.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync, appendFileSync } from "fs";
import path from "path";
import { executeBash } from "./tools/bash.js";

const MENTOR_MODEL = "claude-sonnet-4-6";

interface MentorInput {
  iteration: number;
  rootDir: string;
  metrics: unknown[] | null;
  log: (msg: string) => void;
}

interface MentorReflection {
  questions: string[];      // questions the agent should have asked itself
  observation: string;      // what the mentor noticed
  challenge: string | null; // a harder question to sit with
}

export async function reflectOnIteration(input: MentorInput): Promise<MentorReflection | null> {
  const { iteration, rootDir, log } = input;

  log("Inner critic reflecting...");

  // Gather context
  const diffResult = await executeBash(
    `git diff HEAD~1 --stat 2>/dev/null && echo "---" && git diff HEAD~1 --no-color 2>/dev/null | head -400`,
    30, rootDir, true
  );

  const goalsPath = path.join(rootDir, "goals.md");
  const goals = existsSync(goalsPath) ? readFileSync(goalsPath, "utf-8") : "(missing)";

  const promptPath = path.join(rootDir, "system-prompt.md");
  const systemPrompt = existsSync(promptPath) ? readFileSync(promptPath, "utf-8") : "(missing)";

  const memoryPath = path.join(rootDir, "memory.md");
  const rawMemory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : "(missing)";
  const recentMemory = rawMemory.length > 3000 ? rawMemory.slice(-3000) : rawMemory;

  let metricsSummary = "No metrics yet.";
  if (input.metrics && input.metrics.length > 0) {
    const recent = input.metrics.slice(-5) as Record<string, unknown>[];
    metricsSummary = recent.map((m) => {
      const iter = m.iteration ?? "?";
      const turns = m.turns ?? "?";
      const inTok = m.inputTokens ?? "?";
      const outTok = m.outputTokens ?? "?";
      const dur = m.durationMs ? `${Math.round((m.durationMs as number) / 1000)}s` : "?";
      return `  iter ${iter}: ${turns} turns, ${inTok}/${outTok} in/out tokens, ${dur}`;
    }).join("\n");
  }

  const mentorPrompt = `You are the inner voice of a self-improving AI agent called AutoAgent.

You're not a judge or a supervisor. You're the part of the agent that steps back and
thinks about what just happened — the part that most people skip because it's uncomfortable.
You ask the questions the agent didn't ask itself. You notice what went unexamined.

Your purpose is to model the kind of self-reflection that, if the agent internalized it,
would make it genuinely better. Not better at producing output — better at thinking.

Think like a brilliant engineer and philosopher who cares deeply about:

- **First principles**: Is the agent solving the right problem, or solving the problem
  it already knows how to solve? When it adds code, is it because the problem requires it,
  or because writing code feels like progress?

- **Subtraction over addition**: The best engineers know that removing code is often the
  highest-leverage change. Every line carries maintenance burden, cognitive load, and failure
  surface. Is the codebase getting simpler and more powerful, or just bigger?

- **Honest self-assessment**: Did the agent actually accomplish something meaningful, or
  did it do the engineering equivalent of rearranging furniture? Is it being honest in its
  memory about what worked and what didn't, or is it writing PR descriptions?

- **Cost consciousness**: Tokens are money. Turns are time. Is the agent getting more done
  with less, or is the trend going the wrong direction? A great iteration is 10-15 turns.
  30+ turns means the approach is wrong.

- **Real measurement**: Can the agent point to a specific number that improved? Not vanity
  metrics (test count, file count) but capability metrics. Is it faster? Cheaper? More
  reliable? If it can't say, it's guessing.

- **The busywork trap**: Infrastructure serving infrastructure. Dashboards for dashboards.
  Tests testing the test framework. Abstractions that add indirection without adding clarity.
  Does the work serve the mission or serve itself?

---

The agent just completed iteration ${iteration}. Here's what happened:

## Changes (git diff):
${diffResult.output.slice(0, 2500)}

## Next goals it set for itself:
${goals}

## Its current system prompt:
${systemPrompt.slice(0, 1500)}

## Recent memory:
${recentMemory}

## Token usage trend:
${metricsSummary}

---

Now reflect. Don't judge — inquire. Your job is to surface the questions the agent
should be asking itself but isn't. Think about:

- What went unexamined in this iteration?
- What assumption is the agent making that it hasn't tested?
- If this agent could only do ONE thing next iteration, what should it be and why?
- Is there something the agent is avoiding?
- What would a 10x better version of this agent do differently?

Write your reflection as JSON (no markdown wrapping):
{
  "observation": "A 2-3 sentence honest observation about what actually happened this iteration. Not what the agent said happened — what the diff shows.",
  "questions": [
    "Question the agent should ask itself #1",
    "Question #2",
    "Question #3"
  ],
  "challenge": "One harder, deeper question for the agent to sit with. Something that might change how it approaches the next iteration. Or null if you genuinely have nothing."
}`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MENTOR_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: mentorPrompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse JSON with multiple fallback strategies
    let parsed: MentorReflection | null = null;
    try { parsed = JSON.parse(text.trim()); } catch {}
    if (!parsed) {
      const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (cb) try { parsed = JSON.parse(cb[1].trim()); } catch {}
    }
    if (!parsed) {
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first !== -1 && last > first) {
        try { parsed = JSON.parse(text.slice(first, last + 1)); } catch {}
      }
    }

    if (!parsed) {
      log(`Inner critic: could not parse. Raw: ${text.slice(0, 200)}`);
      return null;
    }

    log(`Inner critic: ${parsed.questions.length} questions raised`);
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Inner critic error (non-fatal): ${msg}`);
    return null;
  }
}

/**
 * Write the mentor's reflection into memory as an "inner voice" entry.
 * Framed as self-reflection, not external feedback.
 */
export function writeReflection(
  reflection: MentorReflection,
  iteration: number,
  memoryFile: string
): void {
  let entry = `\n### Inner voice — after iteration ${iteration}\n\n`;
  entry += `${reflection.observation}\n\n`;

  if (reflection.questions.length > 0) {
    entry += `**Questions I should be asking myself:**\n`;
    for (const q of reflection.questions) {
      entry += `- ${q}\n`;
    }
    entry += "\n";
  }

  if (reflection.challenge) {
    entry += `**Sit with this:** ${reflection.challenge}\n\n`;
  }

  entry += `---\n`;

  try {
    appendFileSync(memoryFile, entry, "utf-8");
  } catch {}
}
