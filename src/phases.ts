/**
 * Three-role iteration architecture.
 *
 * Planner (Opus)  → .plan.md   → decides WHAT to build
 * Builder (Sonnet) → tools      → executes the plan
 * Reviewer (Opus)  → memory.md  → assesses what happened
 *
 * Each role has a focused prompt and leaves breadcrumbs for the next.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { executeBash } from "./tools/bash.js";

const PLANNER_MODEL = "claude-opus-4-6";
const REVIEWER_MODEL = "claude-opus-4-6";

// ─── Planner ────────────────────────────────────────────────

interface PlannerInput {
  iteration: number;
  rootDir: string;
  agentHome: string;
  memory: string;
  orientation: string;
  log: (msg: string) => void;
}

interface PlannerResult {
  plan: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runPlanner(input: PlannerInput): Promise<PlannerResult> {
  const { iteration, rootDir, agentHome, memory, orientation, log } = input;

  log("Planner (Opus) starting...");

  // Gather metrics
  const metricsPath = path.join(agentHome, ".autoagent-metrics.json");
  let metricsSummary = "No metrics yet.";
  if (existsSync(metricsPath)) {
    try {
      const data = JSON.parse(readFileSync(metricsPath, "utf-8")) as Record<string, unknown>[];
      const recent = data.slice(-5);
      metricsSummary = recent.map((m) =>
        `  iter ${m.iteration}: ${m.turns} turns, ${m.inputTokens}/${m.outputTokens} in/out, ${m.durationMs ? Math.round((m.durationMs as number) / 1000) + "s" : "?"}`
      ).join("\n");
    } catch {}
  }

  // Codebase overview
  let codebaseOverview = "";
  try {
    codebaseOverview = execSync(
      "find src -name '*.ts' ! -path '*__tests__*' | sort && echo '---' && wc -l src/*.ts src/tools/*.ts 2>/dev/null | tail -5",
      { cwd: rootDir, encoding: "utf-8", timeout: 5000 }
    );
  } catch {}

  // Current goals (for continuity)
  const goalsPath = path.join(agentHome, "goals.md");
  const currentGoals = existsSync(goalsPath) ? readFileSync(goalsPath, "utf-8") : "(none)";

  const prompt = `You are the Planner for AutoAgent, iteration ${iteration}.

Your job: decide what to build this iteration and write a concrete plan.

You will NOT execute anything. A Builder (Sonnet) will read your plan and execute it.
The Builder has tools: bash, read_file, write_file, grep, list_files, think, subagent, web_fetch.
You do not have tools.

## Memory (what happened in past iterations):
${memory}

## Metrics (recent iterations):
${metricsSummary}

## Orientation (what changed since last iteration):
${orientation || "No changes detected."}

## Codebase:
${codebaseOverview}

## Previous goals (for context):
${currentGoals}

## Instructions

Write a plan with:
1. **Objective**: One sentence. What are we building?
2. **Steps**: Numbered list. Each step names specific files and what to change.
3. **Success criteria**: How the Builder knows it's done. Must be testable.
4. **Turn budget**: Estimated turns for the Builder (be honest — history shows overruns).
5. **Do NOT**: Explicit anti-goals. What should the Builder avoid?

Keep it under 500 words. Give clear, concrete instructions.
Do not set philosophical goals. Do not ask the Builder to "think about thinking."
Every step should produce a verifiable change.

IMPORTANT: The Builder is Sonnet — it's excellent at following plans and writing code,
but it should not be making strategic decisions. That's YOUR job. Be specific.

Output ONLY the plan content as markdown. No JSON wrapping. No code blocks around it.`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: PLANNER_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const planPath = path.join(agentHome, ".plan.md");
    writeFileSync(planPath, text, "utf-8");
    log(`Planner wrote .plan.md (${text.length} chars)`);

    // Also update goals.md to reflect the plan
    writeFileSync(goalsPath, `# AutoAgent Goals — Iteration ${iteration}\n\n(Set by Planner — see .plan.md for full plan)\n\n${text.slice(0, 500)}`, "utf-8");

    return {
      plan: text,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Planner error: ${msg}`);
    // Write a fallback plan
    const fallback = `# Plan — Iteration ${iteration}\n\n## Objective\nFix whatever broke last iteration.\n\n## Steps\n1. Read memory.md for context\n2. Check if tsc compiles\n3. Fix any issues\n4. Restart\n\n## Success criteria\n- tsc --noEmit passes\n- No regressions\n`;
    writeFileSync(path.join(agentHome, ".plan.md"), fallback, "utf-8");
    return { plan: fallback, inputTokens: 0, outputTokens: 0 };
  }
}

// ─── Reviewer ───────────────────────────────────────────────

interface ReviewerInput {
  iteration: number;
  rootDir: string;
  agentHome: string;
  log: (msg: string) => void;
}

interface ReviewerResult {
  review: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runReviewer(input: ReviewerInput): Promise<ReviewerResult> {
  const { iteration, rootDir, agentHome, log } = input;

  log("Reviewer (Opus) starting...");

  // Read the plan
  const planPath = path.join(agentHome, ".plan.md");
  const plan = existsSync(planPath) ? readFileSync(planPath, "utf-8") : "(no plan found)";

  // Get the diff
  const diffResult = await executeBash(
    `git diff HEAD~1 --stat 2>/dev/null && echo "---DIFF---" && git diff HEAD~1 --no-color 2>/dev/null | head -400`,
    30, rootDir, true
  );

  // Read current memory
  const memoryPath = path.join(agentHome, "memory.md");
  const memory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : "";
  const recentMemory = memory.length > 3000 ? memory.slice(-3000) : memory;

  // Metrics for this iteration
  const metricsPath = path.join(agentHome, ".autoagent-metrics.json");
  let thisIterMetrics = "";
  if (existsSync(metricsPath)) {
    try {
      const data = JSON.parse(readFileSync(metricsPath, "utf-8")) as Record<string, unknown>[];
      const last = data[data.length - 1];
      if (last) {
        thisIterMetrics = `Turns: ${last.turns}, Input tokens: ${last.inputTokens}, Output tokens: ${last.outputTokens}, Duration: ${last.durationMs ? Math.round((last.durationMs as number) / 1000) + "s" : "?"}`;
      }
    } catch {}
  }

  const prompt = `You are the Reviewer for AutoAgent, iteration ${iteration}.

A Builder (Sonnet) just executed a plan. Your job: assess what happened honestly
and write feedback that the next Planner (Opus) will read.

## The plan that was given to the Builder:
${plan}

## What was actually built (git diff):
${diffResult.output.slice(0, 3000)}

## Iteration metrics:
${thisIterMetrics}

## Recent memory:
${recentMemory}

## Instructions

Write a review with:
1. **Completed**: Which plan steps were done? Reference specific files.
2. **Missed**: Which steps were skipped or failed? Why?
3. **Quality**: Is this real improvement or busywork? Be specific — reference files and line counts.
   Would a skeptical senior engineer approve this diff?
4. **Cost assessment**: Was the turn count reasonable for what was accomplished?
5. **For next Planner**: What should the next iteration focus on? Any tech debt created?
   What's the single highest-leverage thing to do next?

Be honest. If the Builder produced nothing useful, say so.
If the Builder did great work efficiently, acknowledge that.

Don't be nice — be accurate. The Planner needs truth, not encouragement.

Format as markdown starting with "### Review — Iteration ${iteration}".`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: REVIEWER_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Append review to memory
    try {
      appendFileSync(memoryPath, "\n" + text + "\n\n---\n", "utf-8");
      log(`Reviewer wrote to memory.md (${text.length} chars)`);
    } catch {}

    return {
      review: text,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Reviewer error (non-fatal): ${msg}`);
    return { review: `Review failed: ${msg}`, inputTokens: 0, outputTokens: 0 };
  }
}
