/**
 * Architect Mode — Two-phase plan→edit workflow
 *
 * When a user request is complex (multi-file edit, refactor, new feature),
 * the orchestrator runs a planning phase first to produce a structured edit plan,
 * then injects that plan into the execution phase. This separates reasoning from
 * execution and reduces errors on complex coding tasks.
 */

// ─── Types ───────────────────────────────────────────────────

export interface EditStep {
  file: string;
  action: "create" | "modify" | "delete";
  description: string;
}

export interface EditPlan {
  summary: string;
  steps: EditStep[];
}

// ─── Constants ────────────────────────────────────────────────

/** Keywords that signal a complex, multi-step coding task. */
const COMPLEX_KEYWORDS = [
  "refactor", "implement", "add feature", "create", "build", "migrate",
  "redesign", "restructure", "overhaul", "rewrite", "scaffold", "generate",
  "integrate", "extract", "split", "merge", "convert", "upgrade",
];

/** Minimum message length to trigger architect mode (even without keywords). */
const LONG_MESSAGE_THRESHOLD = 200;

// ─── Detection ────────────────────────────────────────────────

/**
 * Detect whether a user message warrants architect mode.
 *
 * Returns true if:
 * - Message is longer than 200 chars (implies complex request), OR
 * - Message contains known complexity keywords
 *
 * Returns false for short read/explain queries.
 */
export function needsArchitectMode(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();

  if (userMessage.length > LONG_MESSAGE_THRESHOLD) return true;

  return COMPLEX_KEYWORDS.some(kw => lower.includes(kw));
}

// ─── Plan generation ──────────────────────────────────────────

const PLAN_PROMPT_TEMPLATE = `You are a software architect. Analyze the following coding task and produce a structured edit plan.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "One-sentence description of the overall change",
  "steps": [
    { "file": "path/to/file.ts", "action": "create|modify|delete", "description": "What to do" }
  ]
}

Rules:
- List files in the order they should be edited
- Each step must have file, action, and description
- Keep descriptions concise (one sentence each)
- Use "create" for new files, "modify" for existing, "delete" for removal
- If no repo context is available, use reasonable file path guesses

Repo context:
{REPO_CONTEXT}

Task:
{USER_MESSAGE}`;

/**
 * Generate a structured edit plan from a user request.
 * Uses the provided (cheap/simple) model caller.
 * Returns an empty plan on any failure (graceful degradation).
 */
export async function generateEditPlan(
  userMessage: string,
  repoContext: string,
  callModel: (prompt: string) => Promise<string>,
): Promise<EditPlan> {
  const prompt = PLAN_PROMPT_TEMPLATE
    .replace("{REPO_CONTEXT}", repoContext.slice(0, 2000))
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
 * Extracts JSON from a response that may include surrounding text.
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
      }))
      .filter(s => s.file !== "unknown" || s.description);

    return { summary, steps };
  } catch {
    return { summary: "", steps: [] };
  }
}

// ─── Plan formatting ──────────────────────────────────────────

/**
 * Format an EditPlan into a prefilled assistant message for injection
 * into the edit phase. This gives the executor visibility into the plan.
 */
export function formatPlanForEditor(plan: EditPlan): string {
  if (!plan.summary && plan.steps.length === 0) return "";

  const lines: string[] = [
    "I've analyzed the request. Here's my plan:",
    "",
  ];

  if (plan.summary) {
    lines.push(`**Goal**: ${plan.summary}`, "");
  }

  if (plan.steps.length > 0) {
    lines.push("**Steps**:");
    for (const [i, step] of plan.steps.entries()) {
      const actionIcon = step.action === "create" ? "✚" : step.action === "delete" ? "✖" : "✎";
      lines.push(`  ${i + 1}. ${actionIcon} \`${step.file}\` — ${step.description}`);
    }
    lines.push("");
  }

  lines.push("Now executing...");
  return lines.join("\n");
}
