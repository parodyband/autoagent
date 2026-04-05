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

/**
 * Load hooks config from .autoagent/hooks.json in the given workDir.
 * Returns empty config if file doesn't exist or is malformed.
 */
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

/**
 * Return hooks that match the given event + optional tool name.
 */
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

/**
 * Execute a single hook command.
 * - Pipes HookInput as JSON to stdin
 * - Parses stdout as HookOutput JSON (exit 0)
 * - Exit 2 => block with stderr as reason
 * - Other exit codes => ignore (pass-through)
 * - Timeout => treat as ignore
 */
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

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      resolve({}); // timeout => ignore
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code === 2) {
        // Block decision
        resolve({ decision: "block", reason: stderr.trim() || "Hook blocked tool use" });
        return;
      }

      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout.trim()) as HookOutput;
          resolve(parsed);
          return;
        } catch {
          // stdout wasn't JSON — treat as allow with no output
          resolve({});
          return;
        }
      }

      // Any other exit code => ignore
      resolve({});
    });

    child.on("error", () => {
      clearTimeout(timer);
      resolve({}); // spawn error => ignore
    });

    // Write input JSON to stdin
    try {
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    } catch {
      // stdin write error => ignore
    }
  });
}

// ─── Run all matching hooks ───────────────────────────────────

/**
 * Run all hooks matching the event. Aggregates results:
 * - Any "block" decision wins
 * - additionalContext strings are joined with newlines
 * - updatedInput from the last hook wins
 * - continue: false from any hook wins
 */
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
    // block wins over allow
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
