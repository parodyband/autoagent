/**
 * Integration tests for the hook blocking flow.
 *
 * Tests the PreToolUse → block pattern and PostToolUse context injection
 * at the runHooks level, mirroring how orchestrator.ts uses them.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  runHooks,
  matchHooks,
  type HooksConfig,
  type HookConfig,
} from "../src/hooks.js";

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Mirrors the PreToolUse check in orchestrator.ts (lines 652-658).
 * Returns "[Hook blocked]: <reason>" or null (allow).
 */
async function checkPreToolUse(
  config: HooksConfig,
  toolName: string,
  toolInput: unknown,
  workDir: string,
): Promise<string | null> {
  const result = await runHooks(config, "PreToolUse", { tool_name: toolName, tool_input: toolInput }, workDir);
  if (result.decision === "block") {
    return `[Hook blocked]: ${result.reason ?? "blocked by hook"}`;
  }
  return null;
}

/**
 * Mirrors the PostToolUse check in orchestrator.ts (lines 661-668).
 * Returns the tool result, optionally with additionalContext appended.
 */
async function applyPostToolUse(
  config: HooksConfig,
  toolName: string,
  toolInput: unknown,
  toolResponse: string,
  workDir: string,
): Promise<string> {
  const result = await runHooks(config, "PostToolUse", {
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse,
  }, workDir);
  if (result.additionalContext) {
    return `${toolResponse}\n\n[Hook context]: ${result.additionalContext}`;
  }
  return toolResponse;
}

// ─── Tests ────────────────────────────────────────────────────

describe("hooks integration — PreToolUse blocking", () => {
  const WORKDIR = "/tmp/test-hooks-workdir";

  it("blocks bash tool calls matching a dangerous pattern (exit code 2)", async () => {
    // Hook that exits 2 when stdin contains "rm -rf"
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          {
            matcher: "bash",
            command: `sh -c 'echo "Dangerous command blocked" >&2; exit 2'`,
            timeout: 5000,
          } satisfies HookConfig,
        ],
      },
    };

    const blocked = await checkPreToolUse(config, "bash", { command: "rm -rf /" }, WORKDIR);
    expect(typeof blocked).toBe("string");
    expect(blocked as string).toContain("[Hook blocked]");
    expect(blocked as string).toContain("Dangerous command blocked");
  });

  it("allows bash tool calls that don't match the dangerous pattern", async () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          {
            matcher: "bash",
            command: `python3 -c "
import sys, json
data = json.load(sys.stdin)
inp = str(data.get('tool_input', ''))
if 'rm -rf' in inp:
    print('Dangerous command blocked', file=sys.stderr)
    sys.exit(2)
sys.exit(0)
"`,
            timeout: 5000,
          } satisfies HookConfig,
        ],
      },
    };

    const blocked = await checkPreToolUse(config, "bash", { command: "ls -la" }, WORKDIR);
    expect(blocked).toBeNull();
  });

  it("only applies hooks that match the tool name regex", async () => {
    // Hook only matches "write_file", not "bash"
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          {
            matcher: "write_file",
            command: `python3 -c "import sys; print('blocked', file=sys.stderr); sys.exit(2)"`,
            timeout: 5000,
          } satisfies HookConfig,
        ],
      },
    };

    // bash should not be blocked because matcher doesn't match
    const blocked = await checkPreToolUse(config, "bash", { command: "rm -rf /" }, WORKDIR);
    expect(blocked).toBeNull();
  });

  it("blocks write_file when the hook matcher targets it", async () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          {
            matcher: "write_file",
            command: `sh -c 'echo "write blocked" >&2; exit 2'`,
            timeout: 5000,
          } satisfies HookConfig,
        ],
      },
    };

    const blocked = await checkPreToolUse(config, "write_file", { path: "/etc/passwd", content: "evil" }, WORKDIR);
    expect(typeof blocked).toBe("string");
    expect(blocked as string).toContain("[Hook blocked]");
    expect(blocked as string).toContain("write blocked");
  });

  it("returns no block when hooks config is empty", async () => {
    const config: HooksConfig = {};
    const blocked = await checkPreToolUse(config, "bash", { command: "rm -rf /" }, WORKDIR);
    expect(blocked).toBeNull();
  });
});

describe("hooks integration — PostToolUse context injection", () => {
  const WORKDIR = "/tmp/test-hooks-workdir";

  it("appends additionalContext from PostToolUse hook to tool result", async () => {
    const config: HooksConfig = {
      hooks: {
        PostToolUse: [
          {
            matcher: "bash",
            command: `python3 -c "
import sys, json
json.dump({'additionalContext': 'Security scan: no issues found'}, sys.stdout)
sys.exit(0)
"`,
            timeout: 5000,
          } satisfies HookConfig,
        ],
      },
    };

    const result = await applyPostToolUse(config, "bash", { command: "ls" }, "file1.txt\nfile2.txt", WORKDIR);
    expect(result).toContain("file1.txt");
    expect(result).toContain("[Hook context]: Security scan: no issues found");
  });

  it("returns original result unchanged when PostToolUse hook has no additionalContext", async () => {
    const config: HooksConfig = {
      hooks: {
        PostToolUse: [
          {
            matcher: "bash",
            command: `python3 -c "import sys; sys.exit(0)"`,
            timeout: 5000,
          } satisfies HookConfig,
        ],
      },
    };

    const original = "some tool output";
    const result = await applyPostToolUse(config, "bash", { command: "ls" }, original, WORKDIR);
    expect(result).toBe(original);
  });
});

describe("hooks integration — matchHooks utility", () => {
  it("returns all hooks when no matcher is set", () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          { command: "echo allow" },
          { command: "echo also-allow" },
        ],
      },
    };
    const matched = matchHooks(config, "PreToolUse", "bash");
    expect(matched).toHaveLength(2);
  });

  it("filters hooks by matcher regex", () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          { matcher: "bash", command: "echo bash-only" },
          { matcher: "write.*", command: "echo write-only" },
          { command: "echo always" },
        ],
      },
    };
    const matched = matchHooks(config, "PreToolUse", "bash");
    expect(matched).toHaveLength(2); // bash + always (no matcher)
    expect(matched.map((h) => h.command)).toContain("echo bash-only");
    expect(matched.map((h) => h.command)).toContain("echo always");
  });

  it("returns empty array when no hooks for that event", () => {
    const config: HooksConfig = { hooks: { PostToolUse: [] } };
    const matched = matchHooks(config, "PreToolUse", "bash");
    expect(matched).toHaveLength(0);
  });
});
