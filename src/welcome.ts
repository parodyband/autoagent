/**
 * Welcome banner logic — extracted as pure function for testability.
 */

import * as fs from "fs";
import * as path from "path";

export interface WelcomeMessage {
  role: "assistant";
  content: string;
}

/**
 * Returns a welcome message if the user hasn't set up .autoagent.md yet,
 * or null if no banner should be shown.
 */
export function shouldShowWelcome(workDir: string): WelcomeMessage | null {
  const memoryPath = path.join(workDir, ".autoagent.md");
  if (!fs.existsSync(memoryPath)) {
    return {
      role: "assistant",
      content:
        "👋 Welcome to AutoAgent! No `.autoagent.md` found in this project.\n" +
        "Run `/init` to scaffold project config and give the agent context about your codebase.",
    };
  }
  return null;
}
