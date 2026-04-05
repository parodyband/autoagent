/**
 * Task decomposition — breaks complex tasks into ordered subtasks.
 *
 * Used when TASK.md content is large or structured enough that a single
 * monolithic pass would be less efficient than ordered subtasks.
 */

// ─── Types ───────────────────────────────────────────────────

export interface Subtask {
  id: number;
  title: string;
  description: string;
  dependsOn: number[]; // subtask ids this depends on
}

// ─── Heuristics ──────────────────────────────────────────────

/**
 * Returns true if taskContent is complex enough to warrant decomposition.
 * Heuristics:
 *   - wordCount > 300
 *   - has a numbered list with 3+ items (e.g. "1. ...", "2. ...", "3. ...")
 *   - has multiple "##" headings (2 or more)
 */
export function shouldDecompose(taskContent: string): boolean {
  // Word count heuristic
  const wordCount = taskContent.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 300) return true;

  // Numbered list with 3+ items
  const numberedItems = taskContent.match(/^\s*\d+\.\s+\S/gm);
  if (numberedItems && numberedItems.length >= 3) return true;

  // Multiple ## headings
  const h2Headings = taskContent.match(/^##\s+\S/gm);
  if (h2Headings && h2Headings.length >= 2) return true;

  return false;
}

// ─── Decomposition ───────────────────────────────────────────

const DECOMPOSE_PROMPT = (taskContent: string) => `You are a task decomposition assistant. Break the following task into 3–7 ordered subtasks.

Return ONLY valid JSON — an array of objects with these fields:
- id: number (starting from 1)
- title: string (short, imperative, ≤10 words)
- description: string (1–3 sentences explaining the subtask)
- dependsOn: number[] (ids of subtasks this one depends on; empty array if none)

Rules:
- Return 3–7 subtasks. No more than 7.
- Keep descriptions concise.
- Only add dependsOn entries where there is a real ordering dependency.
- Return ONLY the JSON array. No markdown fences, no explanation.

Task to decompose:
${taskContent}`;

/**
 * Calls Claude with a focused prompt to decompose the task into 3–7 subtasks.
 * Falls back to a single subtask wrapping the full content if Claude call fails
 * or returns malformed JSON.
 */
export async function decomposeTasks(
  taskContent: string,
  callClaude: (prompt: string) => Promise<string>,
): Promise<Subtask[]> {
  const fallback: Subtask[] = [
    {
      id: 1,
      title: "Complete the task",
      description: taskContent.slice(0, 300).trim(),
      dependsOn: [],
    },
  ];

  let raw: string;
  try {
    raw = await callClaude(DECOMPOSE_PROMPT(taskContent));
  } catch {
    return fallback;
  }

  try {
    // Strip optional markdown fences if Claude includes them despite instructions
    const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;

    const subtasks: Subtask[] = parsed
      .slice(0, 7) // never more than 7
      .map((item: unknown, idx: number) => {
        if (typeof item !== "object" || item === null) throw new Error("invalid item");
        const obj = item as Record<string, unknown>;
        return {
          id: typeof obj.id === "number" ? obj.id : idx + 1,
          title: typeof obj.title === "string" ? obj.title : `Subtask ${idx + 1}`,
          description: typeof obj.description === "string" ? obj.description : "",
          dependsOn: Array.isArray(obj.dependsOn)
            ? (obj.dependsOn as unknown[]).filter((x): x is number => typeof x === "number")
            : [],
        };
      });

    return subtasks;
  } catch {
    return fallback;
  }
}

// ─── Formatting ──────────────────────────────────────────────

/**
 * Returns a markdown representation of the subtask list for injection
 * into the agent context.
 */
export function formatSubtasks(subtasks: Subtask[]): string {
  const lines: string[] = ["## Task Decomposition", ""];
  for (const st of subtasks) {
    const deps =
      st.dependsOn.length > 0
        ? ` _(depends on: ${st.dependsOn.map((d) => `#${d}`).join(", ")})_`
        : "";
    lines.push(`### ${st.id}. ${st.title}${deps}`);
    lines.push("");
    lines.push(st.description);
    lines.push("");
  }
  return lines.join("\n");
}
