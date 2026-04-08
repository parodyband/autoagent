import { spawn } from "child_process";
import type Anthropic from "@anthropic-ai/sdk";

// Commands the agent must never run — these are reserved for the harness
const BLOCKED_PATTERNS = [
  /git\s+reset\s+--hard/,
  /git\s+checkout\s+\./,
  /git\s+checkout\s+--\s/,
  /git\s+clean\s+-[a-z]*f/,
  /git\s+push/,
  /git\s+rebase/,
  /git\s+merge/,
  /git\s+stash/,
  /git\s+branch\s+-[dD]/,
  /rm\s+-rf\s+\.git/,
  /rm\s+-rf\s+\.\//,
  /rm\s+-rf\s+\//, // no rm -rf absolute paths
];

export const bashToolDefinition: Anthropic.Tool = {
  name: "bash",
  description:
    "Execute a bash command and return its output. " +
    "Use this for system operations: reading/writing files, running programs, " +
    "installing packages, git log/status/diff/add, etc. " +
    "NOTE: Destructive git commands (reset, checkout ., push, rebase, clean) are blocked — " +
    "the harness manages git. Use git add, git status, git log, git diff freely. " +
    "Commands run in the project root. Timeout: 120s default, 600s max. " +
    "Commands with no output for 30s are killed (stall protection).",
  input_schema: {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "The bash command to execute.",
      },
      timeout: {
        type: "integer",
        description: "Timeout in seconds (default 120, max 600).",
      },
    },
    required: ["command"],
  },
};

export interface BashResult {
  output: string;
  exitCode: number;
}

export async function executeBash(
  command: string,
  timeout: number = 120,
  cwd?: string,
  skipGuards: boolean = false,
  onChunk?: (text: string) => void
): Promise<BashResult> {
  // Block destructive commands (unless harness is calling internally)
  if (!skipGuards) {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return {
          output: `BLOCKED: "${command.slice(0, 80)}" matches blocked pattern ${pattern}. ` +
            `Destructive git operations are reserved for the harness. ` +
            `You can use: git add, git status, git log, git diff, git tag.`,
          exitCode: -1,
        };
      }
    }
  }

  const workDir = cwd ?? process.cwd();
  const effectiveTimeout = Math.min(timeout, 600) * 1000;

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;
    let killReason = "";
    let lastDataTime = Date.now();

    const proc = spawn("bash", ["-c", command], {
      cwd: workDir,
      env: { ...process.env, TERM: "dumb" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Close stdin to prevent interactive hangs
    proc.stdin.end();

    proc.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      lastDataTime = Date.now();
      onChunk?.(text);
    });
    proc.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      lastDataTime = Date.now();
      onChunk?.("[stderr] " + text);
    });

    // Hard timeout
    const timer = setTimeout(() => {
      killed = true;
      killReason = "timeout";
      proc.kill("SIGTERM");
      setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
    }, effectiveTimeout);

    // Stall watchdog: kill if no output for 30s
    const STALL_MS = 30_000;
    const stallCheck = setInterval(() => {
      if (Date.now() - lastDataTime > STALL_MS && !killed) {
        killed = true;
        killReason = "stall";
        proc.kill("SIGTERM");
        setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 3000);
      }
    }, 5000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      clearInterval(stallCheck);

      if (killed) {
        const reason = killReason === "stall"
          ? `STALLED: No output for ${STALL_MS / 1000}s — command likely waiting for input or hung.`
          : `TIMEOUT: Command exceeded ${timeout}s limit.`;
        resolve({ output: `${reason}\n${stdout}\n${stderr}`.trim(), exitCode: -1 });
        return;
      }

      let output = stdout;
      if (stderr) output += (output ? "\n--- stderr ---\n" : "") + stderr;

      const maxChars = 100_000;
      if (output.length > maxChars) {
        output = output.slice(0, maxChars) + `\n... [truncated, ${output.length} total chars]`;
      }

      resolve({ output: output || "(no output)", exitCode: code ?? 1 });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      clearInterval(stallCheck);
      resolve({ output: `ERROR: ${err.message}`, exitCode: -1 });
    });
  });
}
