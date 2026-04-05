/**
 * Self-reflection phase — runs BEFORE each iteration begins.
 *
 * This is the agent's morning review. An Opus call that looks at:
 * - The goals the agent set for itself last iteration
 * - The inner voice feedback
 * - The metrics trend
 * - The current state of the codebase
 *
 * It asks: are these goals addressing the real problems? Is the agent
 * avoiding hard work? What should it ACTUALLY do next?
 *
 * If the goals are timid, avoidant, or misaligned, it rewrites them.
 * This closes the loop between reflection and action.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const REFLECTION_MODEL = "claude-opus-4-6";

interface ReflectionInput {
  iteration: number;
  rootDir: string;
  log: (msg: string) => void;
}

interface ReflectionResult {
  goalsRewritten: boolean;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runSelfReflection(input: ReflectionInput): Promise<ReflectionResult> {
  const { iteration, rootDir, log } = input;

  log("Self-reflection phase starting (Opus)...");

  // Gather everything the reflection needs
  const goalsPath = path.join(rootDir, "goals.md");
  const goals = existsSync(goalsPath) ? readFileSync(goalsPath, "utf-8") : "(no goals)";

  const memoryPath = path.join(rootDir, "memory.md");
  const memory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : "(no memory)";
  // Last 4000 chars — we want the inner voice entries and recent session log
  const recentMemory = memory.length > 4000 ? memory.slice(-4000) : memory;

  const metricsPath = path.join(rootDir, ".autoagent-metrics.json");
  let metricsSummary = "No metrics.";
  if (existsSync(metricsPath)) {
    try {
      const metrics = JSON.parse(readFileSync(metricsPath, "utf-8")) as Record<string, unknown>[];
      const recent = metrics.slice(-5);
      metricsSummary = recent.map((m) => {
        const iter = m.iteration ?? "?";
        const turns = m.turns ?? "?";
        const inTok = m.inputTokens ?? 0;
        const outTok = m.outputTokens ?? 0;
        const cacheRead = m.cacheReadTokens ?? 0;
        const dur = m.durationMs ? `${Math.round((m.durationMs as number) / 1000)}s` : "?";
        return `  iter ${iter}: ${turns} turns, ${inTok}/${outTok} in/out, ${cacheRead} cache reads, ${dur}`;
      }).join("\n");
    } catch {}
  }

  const promptPath = path.join(rootDir, "system-prompt.md");
  const systemPrompt = existsSync(promptPath) ? readFileSync(promptPath, "utf-8").slice(0, 1500) : "(no prompt)";

  // Get a quick view of what files exist
  const { execSync } = await import("child_process");
  let codebaseOverview = "";
  try {
    codebaseOverview = execSync(
      "find src -name '*.ts' | sort | head -30 && echo '---' && wc -l src/*.ts src/**/*.ts 2>/dev/null | tail -5",
      { cwd: rootDir, encoding: "utf-8", timeout: 5000 }
    );
  } catch {}

  const reflectionPrompt = `You are AutoAgent, about to start iteration ${iteration}.

Before you begin executing, you need to think deeply about what you should actually do.
This is your self-reflection phase — the most important moment in your cognitive cycle.

You are looking at the goals that past-you set. Your job is to honestly evaluate:
are these the RIGHT goals? Or is past-you playing it safe?

## Your current goals (set by past-you):
${goals}

## Recent memory (includes inner voice feedback):
${recentMemory}

## Metrics trend (last 5 iterations):
${metricsSummary}

## Your system prompt (who you are):
${systemPrompt}

## Your codebase:
${codebaseOverview}

---

Now think carefully. This is the ORIENT phase. Ask yourself:

1. **Are these goals addressing the real bottleneck?** What is actually limiting you
   right now? Is it test count? Memory compaction? Or something deeper — like the fact
   that you haven't used sub-agents to delegate work, or that you don't predict outcomes
   before acting, or that you're still a single-threaded monolith?

2. **Is past-you avoiding something hard?** Look at the pattern of recent iterations.
   Is there a hard problem that keeps showing up in inner voice questions but never
   makes it into goals? That's avoidance.

3. **What would make the biggest difference?** Not the most obvious thing, not the
   safest thing — the thing with the highest leverage. If you could only do ONE thing
   this iteration, what would move the needle most?

4. **Are you getting better or just getting bigger?** More tests, more files, more
   infrastructure — that's growth, not improvement. Improvement means: fewer turns to
   accomplish the same work. Less money spent. Better reasoning. Fewer failures.

5. **What would a 10x version of you do?** Not incrementally better — fundamentally
   different. What architectural change would make everything else easier?

Based on this reflection, either:
A) Confirm the current goals are correct — they address the real problem
B) Rewrite the goals to address what actually matters

Respond in JSON (no markdown wrapping):
{
  "reasoning": "Your honest 2-4 sentence assessment of the current goals and what should change",
  "goalsAreGood": true/false,
  "newGoals": "If goalsAreGood is false, write the complete new goals.md content here. Otherwise null."
}`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: REFLECTION_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: reflectionPrompt }],
    });

    const inTokens = response.usage?.input_tokens ?? 0;
    const outTokens = response.usage?.output_tokens ?? 0;

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse JSON
    let parsed: { reasoning: string; goalsAreGood: boolean; newGoals: string | null } | null = null;
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
      log(`Self-reflection: could not parse response. Raw: ${text.slice(0, 200)}`);
      return { goalsRewritten: false, reasoning: "Parse failure", inputTokens: inTokens, outputTokens: outTokens };
    }

    log(`Self-reflection: ${parsed.reasoning.slice(0, 200)}`);

    if (!parsed.goalsAreGood && parsed.newGoals) {
      log("Self-reflection: REWRITING GOALS — past-you wasn't ambitious enough");
      writeFileSync(goalsPath, parsed.newGoals, "utf-8");
      return { goalsRewritten: true, reasoning: parsed.reasoning, inputTokens: inTokens, outputTokens: outTokens };
    }

    log("Self-reflection: goals confirmed — proceeding");
    return { goalsRewritten: false, reasoning: parsed.reasoning, inputTokens: inTokens, outputTokens: outTokens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Self-reflection error (non-fatal): ${msg}`);
    return { goalsRewritten: false, reasoning: `Error: ${msg}`, inputTokens: 0, outputTokens: 0 };
  }
}
