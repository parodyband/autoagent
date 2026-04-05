/**
 * Integration tests for hook wiring in orchestrator.
 *
 * Tests that PreToolUse hooks can block tool execution, and PostToolUse
 * hooks can append additional context to tool results.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runHooks, matchHooks, type HooksConfig, type HookInput } from "../hooks.js";

// ─── Tests for runHooks with mocked executeHook ───────────────────────────────

describe("Hook wiring — PreToolUse blocking", () => {
  it("blocks tool execution when hook returns decision: block", async () => {
    // A config with a PreToolUse hook that always blocks
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          { command: "echo '{\"decision\":\"block\",\"reason\":\"not allowed\"}'", timeout: 5000 },
        ],
      },
    };

    const result = await runHooks(
      config,
      "PreToolUse",
      { cwd: process.cwd(), tool_name: "bash", tool_input: { command: "rm -rf /" } },
      process.cwd(),
    );

    expect(result.decision).toBe("block");
    expect(result.reason).toBe("not allowed");
  });

  it("blocks only matching tool when hook has a matcher", async () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          {
            matcher: "^write_file$",
            command: "echo '{\"decision\":\"block\",\"reason\":\"writes blocked\"}'",
            timeout: 5000,
          },
        ],
      },
    };

    // write_file should be blocked
    const writeResult = await runHooks(
      config,
      "PreToolUse",
      { cwd: process.cwd(), tool_name: "write_file", tool_input: {} },
      process.cwd(),
    );
    expect(writeResult.decision).toBe("block");
    expect(writeResult.reason).toBe("writes blocked");

    // read_file should NOT be blocked (matcher doesn't match)
    const readResult = await runHooks(
      config,
      "PreToolUse",
      { cwd: process.cwd(), tool_name: "read_file", tool_input: {} },
      process.cwd(),
    );
    expect(readResult.decision).toBeUndefined();
  });

  it("allows tool execution when hook returns decision: allow", async () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          { command: "echo '{\"decision\":\"allow\"}'", timeout: 5000 },
        ],
      },
    };

    const result = await runHooks(
      config,
      "PreToolUse",
      { cwd: process.cwd(), tool_name: "read_file", tool_input: {} },
      process.cwd(),
    );

    expect(result.decision).toBe("allow");
  });
});

describe("Hook wiring — PostToolUse context appending", () => {
  it("PostToolUse hook can append additionalContext", async () => {
    const config: HooksConfig = {
      hooks: {
        PostToolUse: [
          {
            command: "echo '{\"additionalContext\":\"[audit] tool was called\"}'",
            timeout: 5000,
          },
        ],
      },
    };

    const result = await runHooks(
      config,
      "PostToolUse",
      {
        cwd: process.cwd(),
        tool_name: "bash",
        tool_input: { command: "ls" },
        tool_response: "file1.ts\nfile2.ts",
      },
      process.cwd(),
    );

    expect(result.additionalContext).toBe("[audit] tool was called");
  });

  it("PostToolUse aggregates context from multiple hooks", async () => {
    const config: HooksConfig = {
      hooks: {
        PostToolUse: [
          {
            command: "echo '{\"additionalContext\":\"context-A\"}'",
            timeout: 5000,
          },
          {
            command: "echo '{\"additionalContext\":\"context-B\"}'",
            timeout: 5000,
          },
        ],
      },
    };

    const result = await runHooks(
      config,
      "PostToolUse",
      { cwd: process.cwd(), tool_name: "bash", tool_input: {} },
      process.cwd(),
    );

    expect(result.additionalContext).toContain("context-A");
    expect(result.additionalContext).toContain("context-B");
  });
});

describe("Hook wiring — exit code 2 blocks", () => {
  it("hook exiting with code 2 blocks tool execution", async () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          // exit 2 signals block; stderr becomes the reason
          { command: "echo 'dangerous tool blocked' >&2; exit 2", timeout: 5000 },
        ],
      },
    };

    const result = await runHooks(
      config,
      "PreToolUse",
      { cwd: process.cwd(), tool_name: "bash", tool_input: { command: "dangerous" } },
      process.cwd(),
    );

    expect(result.decision).toBe("block");
    expect(result.reason).toContain("dangerous tool blocked");
  });
});

describe("matchHooks utility", () => {
  it("returns hooks matching event and tool name", () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          { matcher: "bash", command: "echo ok" },
          { matcher: "write_file", command: "echo ok" },
        ],
      },
    };

    const matched = matchHooks(config, "PreToolUse", "bash");
    expect(matched).toHaveLength(1);
    expect(matched[0].matcher).toBe("bash");
  });

  it("returns all hooks when no matcher is set", () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          { command: "echo ok" },
          { command: "echo ok2" },
        ],
      },
    };

    const matched = matchHooks(config, "PreToolUse", "any_tool");
    expect(matched).toHaveLength(2);
  });

  it("returns empty array when no hooks configured for event", () => {
    const config: HooksConfig = {};
    const matched = matchHooks(config, "PreToolUse", "bash");
    expect(matched).toHaveLength(0);
  });
});
