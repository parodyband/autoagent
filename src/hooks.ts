/**
 * Hook system for AutoAgent lifecycle events.
 *
 * Supports PreToolUse, PostToolUse, SessionStart, Stop events.
 * Hooks are configured in .autoagent/hooks.json and executed as shell commands.
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────

export type HookEvent = "PreToolUse" | "PostToolUse" | "SessionStart" | "Stop";

export interface HookConfig {
  matcher?: string;   // regex to match tool name
  command: string;    // shell command to run
  timeout?: number;   // ms, default 10000
}

export interface HooksConfig {
  hooks?: Partial<Record<HookEvent, HookConfig[]>>;
}

/** JSON object passed to hook on stdin */
export interface HookInput {
  hook_event_name: HookEvent;
  cwd: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
}

/** JSON object parsed from hook stdout */
export interface HookOutput {
  decision?: "allow" | "block";
  reason?: string;
  updatedInput?: unknown;
  additionalContext?: string;
  continue?: boolean;
}

// ─── Config loading ───────────────────────────────────────────

export function loadHooksConfig(workDir: string): HooksConfig {
  const configPath = path.join(workDir, ".autoagent", "hooks.json");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as HooksConfig;
  } catch {
    return {};
  }
}

// ─── Hook matching ────────────────────────────────────────────

export function matchHooks(
  config: HooksConfig,
  event: HookEvent,
  toolName?: string,
): HookConfig[] {
  const hooks = config.hooks?.[event] ?? [];
  return hooks.filter((hook) => {
    if (!hook.matcher) return true;
    try {
      return new RegExp(hook.matcher).test(toolName ?? "");
    } catch {
      return false;
    }
  });
}

// ─── Hook execution ───────────────────────────────────────────

export function executeHook(
  hook: HookConfig,
  input: HookInput,
  workDir: string,
): Promise<HookOutput> {
  return new Promise((resolve) => {
    const timeout = hook.timeout ?? 10_000;
    let timedOut = false;

    const child = spawn(hook.command, {
      shell: true,
      cwd: workDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutDone = false;
    let stderrDone = false;
    let exitCode: number | null = null;

    function tryResolve() {
      if (!stdoutDone || !stderrDone || exitCode === null) return;
      if (exitCode === 2) {
        resolve({ decision: "block", reason: stderr.trim() || "Hook blocked tool use" });
        return;
      }
      if (exitCode === 0) {
        try {
          const parsed = JSON.parse(stdout.trim()) as HookOutput;
          resolve(parsed);
          return;
        } catch {
          resolve({});
          return;
        }
      }
      resolve({});
    }

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stdout.on("end", () => { stdoutDone = true; tryResolve(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.stderr.on("end", () => { stderrDone = true; tryResolve(); });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      resolve({});
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      exitCode = code;
      tryResolve();
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolve({});
    });

    try {
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    } catch {
      // ignore
    }
  });
}

// ─── Run all matching hooks ───────────────────────────────────

export async function runHooks(
  config: HooksConfig,
  event: HookEvent,
  input: Omit<HookInput, "hook_event_name">,
  workDir: string,
): Promise<HookOutput> {
  const hooks = matchHooks(config, event, input.tool_name);
  if (hooks.length === 0) return {};

  const fullInput: HookInput = { hook_event_name: event, ...input };

  const outputs = await Promise.all(
    hooks.map((hook) => executeHook(hook, fullInput, workDir)),
  );

  const aggregated: HookOutput = {};
  const contextParts: string[] = [];

  for (const output of outputs) {
    if (output.decision === "block") {
      aggregated.decision = "block";
      aggregated.reason = output.reason ?? aggregated.reason;
    } else if (!aggregated.decision && output.decision === "allow") {
      aggregated.decision = "allow";
    }

    if (output.additionalContext) {
      contextParts.push(output.additionalContext);
    }

    if (output.updatedInput !== undefined) {
      aggregated.updatedInput = output.updatedInput;
    }

    if (output.continue === false) {
      aggregated.continue = false;
    }
  }

  if (contextParts.length > 0) {
    aggregated.additionalContext = contextParts.join("\n");
  }

  return aggregated;
}
