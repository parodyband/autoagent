/**
 * Think tool — allows the agent to reason through problems without side effects.
 * The agent sends its thoughts, and they're simply returned back.
 * This is useful for complex planning and reasoning.
 */

import type Anthropic from "@anthropic-ai/sdk";

export const thinkToolDefinition: Anthropic.Tool = {
  name: "think",
  description:
    "Use this tool to think through a problem step-by-step. " +
    "Your thoughts will be recorded but have no side effects. " +
    "Use this before making complex changes to plan your approach.",
  input_schema: {
    type: "object" as const,
    properties: {
      thought: {
        type: "string",
        description: "Your reasoning or planning thoughts.",
      },
    },
    required: ["thought"],
  },
};

export interface ThinkResult {
  content: string;
  success: boolean;
}

export function executeThink(thought: string): ThinkResult {
  return {
    content: `Thought recorded (${thought.length} chars). Continue with your plan.`,
    success: true,
  };
}
