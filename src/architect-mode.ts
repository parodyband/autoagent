/**
 * Architect Mode — Two-phase plan→edit workflow (Aider-style)
 *
 * Complex user requests go through two phases:
 *   Phase 1 (Plan):  A cheap/fast model generates a structured edit plan
 *   Phase 2 (Edit):  The plan is injected as a prefilled assistant message,
 *                     then the coding model executes targeted edits
 *
 * Benefits:
 *   - Separates reasoning from execution → fewer mistakes
 *   - Plan phase uses haiku → cheaper for the thinking step
 *   - Editor sees exactly which files to touch → more focused tool use
 *   - User sees the plan before edits happen → transparency
 *
 * Integration point: orchestrator.ts send() calls `runArchitectMode()` which
 * returns { plan, prefill } for injection into the agent loop.
 */

// ─── Types ───────────────────────────────────────────────────

export interface EditStep {
  file: string;
  action: "create" | "modify" | "delete";
  description: string;
  /** Optional: specific symbols/functions to change within the file */
  symbols?: string[];
}

export interface EditPlan {
  summary: string;
  steps: EditStep[];
  /** Files the plan wants to read first (for context gathering) */
  contextFiles?: string[];
}

export interface ArchitectResult {
  /** The generated plan (empty plan if skipped/failed) */
  plan: EditPlan;
  /** Formatted message to inject as assistant prefill in edit phase */
  prefill: string;
  /** Whether architect mode was actually used (vs skipped) */
  activated: boolean;
}

// ─── Constants ────────────────────────────────────────────────

/** Keywords that signal a complex, multi-step coding task. */
const COMPLEX_KEYWORDS = [
  "refactor", "implement", "add feature", "create", "build", "migrate",
  "redesign", "restructure", "overhaul", "rewrite", "scaffold", "generate",
  "integrate", "extract", "split", "merge", "convert", "upgrade",
];

/** Minimum message length to trigger architect mode (even without keywords). */
const LONG_MESSAGE_THRESHOLD = 300;

/** Minimum number of complexity keywords to trigger on shorter messages. */
const MIN_KEYWORD_HITS = 1;

// ─── Detection ────────────────────────────────────────────────

/**
 * Detect whether a user message warrants architect mode.
 *
 * Returns true if:
 * - Message is longer than 300 chars AND contains at least 1 complexity keyword, OR
 * - Message contains 2+ complexity keywords regardless of length
 *
 * Returns false for short queries, read-only questions, and simple single-file edits.
 */
export function needsArchitectMode(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();

  // Never trigger on questions/read-only
  const readPatterns = /^(what|how|why|explain|show|list|describe|find)\b/;
  if (readPatterns.test(lower.trim())) return false;

  const keywordHits = COMPLEX_KEYWORDS.filter(kw => lower.includes(kw)).length;

  // Long message + at least one keyword → architect mode
  if (userMessage.length > LONG_MESSAGE_THRESHOLD && keywordHits >= MIN_KEYWORD_HITS) {
    return true;
  }

  // Multiple keywords → architect mode regardless of length
  if (keywordHits >= 2) return true;

  return false;
}

// ─── Plan generation ──────────────────────────────────────────

const PLAN_PROMPT_TEMPLATE = `You are a software architect. Analyze this coding task and produce a structured edit plan.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "One-sentence description of the overall change",
  "steps": [
    {
      "file": "path/to/file.ts",
      "action": "create|modify|delete",
      "description": "What to do in this file",
      "symbols": ["functionName", "ClassName"]
    }
  ],
  "contextFiles": ["path/to/read-first.ts"]
}

Rules:
- List files in dependency order (shared types first, then implementations, then tests)
- Each step: file, action, description, and optionally symbols (functions/classes to change)
- "contextFiles" = files the editor should read for context but NOT modify
- Keep descriptions concise but specific (mention function names, not just "update file")
- Use "create" for new files, "modify" for existing, "delete" for removal

Repo context (key files and symbols):
{REPO_CONTEXT}

Project structure (truncated):
{REPO_MAP}

Task:
{USER_MESSAGE}`;

/**
 * Generate a structured edit plan from a user request.
 * Uses the provided cheap model caller (typically haiku).
 * Returns an empty plan on any failure (graceful degradation).
 */
export async function generateEditPlan(
  userMessage: string,
  repoContext: string,
  callModel: (prompt: string) => Promise<string>,
  repoMap?: string,
): Promise<EditPlan> {
  const prompt = PLAN_PROMPT_TEMPLATE
    .replace("{REPO_CONTEXT}", repoContext.slice(0, 4000))
    .replace("{REPO_MAP}", repoMap ? repoMap.slice(0, 8000) : "(not available)")
    .replace("{USER_MESSAGE}", userMessage);

  try {
    const raw = await callModel(prompt);
    return parsePlan(raw);
  } catch {
    return { summary: "", steps: [] };
  }
}

/**
 * Parse a JSON plan response from the model.
 * Extracts JSON from a response that may include surrounding text/fences.
 */
export function parsePlan(raw: string): EditPlan {
  if (!raw || !raw.trim()) return { summary: "", steps: [] };

  try {
    // Extract JSON block if surrounded by markdown fences or prose
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { summary: "", steps: [] };

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!parsed || typeof parsed !== "object") return { summary: "", steps: [] };

    const obj = parsed as Record<string, unknown>;
    const summary = typeof obj.summary === "string" ? obj.summary : "";
    const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];

    const steps: EditStep[] = rawSteps
      .filter((s): s is Record<string, unknown> => s !== null && typeof s === "object")
      .map(s => ({
        file: typeof s.file === "string" ? s.file : "unknown",
        action: (["create", "modify", "delete"].includes(s.action as string)
          ? s.action
          : "modify") as EditStep["action"],
        description: typeof s.description === "string" ? s.description : "",
        symbols: Array.isArray(s.symbols)
          ? (s.symbols as unknown[]).filter((x): x is string => typeof x === "string")
          : undefined,
      }))
      .filter(s => s.file !== "unknown" || s.description);

    const contextFiles = Array.isArray(obj.contextFiles)
      ? (obj.contextFiles as unknown[]).filter((x): x is string => typeof x === "string")
      : undefined;

    return { summary, steps, contextFiles };
  } catch {
    return { summary: "", steps: [] };
  }
}

// ─── Plan formatting ──────────────────────────────────────────

/**
 * Format an EditPlan into a prefilled assistant message for injection
 * into the edit phase. Gives the executor clear direction.
 */
export function formatPlanForEditor(plan: EditPlan): string {
  if (!plan.summary && plan.steps.length === 0) return "";

  const lines: string[] = [
    "I've analyzed the request and created an edit plan:",
    "",
  ];

  if (plan.summary) {
    lines.push(`**Goal**: ${plan.summary}`, "");
  }

  if (plan.steps.length > 0) {
    lines.push("**Edit plan**:");
    for (const [i, step] of plan.steps.entries()) {
      const actionIcon = step.action === "create" ? "✚" : step.action === "delete" ? "✖" : "✎";
      let line = `  ${i + 1}. ${actionIcon} \`${step.file}\` — ${step.description}`;
      if (step.symbols && step.symbols.length > 0) {
        line += ` [${step.symbols.join(", ")}]`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  if (plan.contextFiles && plan.contextFiles.length > 0) {
    lines.push("**Context files to read first**: " + plan.contextFiles.map(f => `\`${f}\``).join(", "), "");
  }

  lines.push("I'll now execute this plan step by step.");
  return lines.join("\n");
}

// ─── Orchestrator integration ─────────────────────────────────

/**
 * Top-level entry point for architect mode. Called by orchestrator.send().
 *
 * Flow:
 *   1. Check if the message warrants architect mode (needsArchitectMode)
 *   2. If yes: call generateEditPlan with haiku, format the plan
 *   3. Return { plan, prefill, activated }
 *
 * The orchestrator uses the result:
 *   - If activated: inject prefill as assistant message before the agent loop
 *   - If not activated: proceed normally (no plan overhead)
 *
 * @param userMessage  - the raw user request
 * @param repoContext  - repo map / file list string for plan context
 * @param callModel    - cheap model caller (haiku via makeSimpleCaller)
 * @param repoMap      - optional repo map string (truncated to 8K) injected into plan prompt
 */
export async function runArchitectMode(
  userMessage: string,
  repoContext: string,
  callModel: (prompt: string) => Promise<string>,
  repoMap?: string,
): Promise<ArchitectResult> {
  if (!needsArchitectMode(userMessage)) {
    return { plan: { summary: "", steps: [] }, prefill: "", activated: false };
  }

  const plan = await generateEditPlan(userMessage, repoContext, callModel, repoMap);

  // If the plan came back empty, don't inject anything
  if (!plan.summary && plan.steps.length === 0) {
    return { plan, prefill: "", activated: false };
  }

  const prefill = formatPlanForEditor(plan);
  return { plan, prefill, activated: true };
}
