import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  loadHooksConfig,
  matchHooks,
  executeHook,
  runHooks,
  type HooksConfig,
  type HookConfig,
} from "../src/hooks.js";

// ─── Helpers ──────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeHooksConfig(config: HooksConfig) {
  const dir = path.join(tmpDir, ".autoagent");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "hooks.json"), JSON.stringify(config));
}

// ─── loadHooksConfig ──────────────────────────────────────────

describe("loadHooksConfig", () => {
  it("returns empty config when no file exists", () => {
    const config = loadHooksConfig(tmpDir);
    expect(config).toEqual({});
  });

  it("parses a valid config file", () => {
    const expected: HooksConfig = {
      hooks: {
        PreToolUse: [{ command: "echo hi", matcher: "write_file" }],
      },
    };
    writeHooksConfig(expected);
    const config = loadHooksConfig(tmpDir);
    expect(config).toEqual(expected);
  });

  it("returns empty config for malformed JSON", () => {
    const dir = path.join(tmpDir, ".autoagent");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "hooks.json"), "{ bad json }");
    const config = loadHooksConfig(tmpDir);
    expect(config).toEqual({});
  });
});

// ─── matchHooks ───────────────────────────────────────────────

describe("matchHooks", () => {
  const config: HooksConfig = {
    hooks: {
      PreToolUse: [
        { command: "echo a", matcher: "write_file" },
        { command: "echo b", matcher: "read_file" },
        { command: "echo c" }, // no matcher — matches everything
      ],
      PostToolUse: [{ command: "echo d" }],
    },
  };

  it("returns hooks for matching event and tool name", () => {
    const hooks = matchHooks(config, "PreToolUse", "write_file");
    expect(hooks).toHaveLength(2); // write_file matcher + no-matcher
    expect(hooks.map((h) => h.command)).toContain("echo a");
    expect(hooks.map((h) => h.command)).toContain("echo c");
  });

  it("filters out non-matching hooks by regex", () => {
    const hooks = matchHooks(config, "PreToolUse", "bash");
    expect(hooks).toHaveLength(1); // only no-matcher hook
    expect(hooks[0].command).toBe("echo c");
  });

  it("returns empty array for event with no hooks", () => {
    const hooks = matchHooks(config, "SessionStart", "write_file");
    expect(hooks).toHaveLength(0);
  });

  it("returns all hooks when no tool name given and matcher present", () => {
    // matcher won't match empty string for "write_file" regex
    const hooks = matchHooks(config, "PreToolUse", undefined);
    // write_file regex won't match "", read_file regex won't match "" — only no-matcher
    expect(hooks.map((h) => h.command)).toContain("echo c");
  });
});

// ─── executeHook ──────────────────────────────────────────────

describe("executeHook", () => {
  it("handles exit 0 with valid JSON output", async () => {
    const hook: HookConfig = {
      command: `echo '{"decision":"allow","additionalContext":"ok"}'`,
    };
    const result = await executeHook(
      hook,
      { hook_event_name: "PreToolUse", cwd: tmpDir },
      tmpDir,
    );
    expect(result.decision).toBe("allow");
    expect(result.additionalContext).toBe("ok");
  });

  it("handles exit 2 as block with stderr reason", async () => {
    const hook: HookConfig = {
      // exit 2 and write reason to stderr
      command: `bash -c 'echo "blocked by policy" >&2; exit 2'`,
    };
    const result = await executeHook(
      hook,
      { hook_event_name: "PreToolUse", cwd: tmpDir },
      tmpDir,
    );
    expect(result.decision).toBe("block");
    expect(result.reason).toContain("blocked by policy");
  });

  it("handles timeout gracefully", async () => {
    const hook: HookConfig = {
      command: `sleep 10`,
      timeout: 100, // 100ms timeout
    };
    const start = Date.now();
    const result = await executeHook(
      hook,
      { hook_event_name: "PreToolUse", cwd: tmpDir },
      tmpDir,
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(result).toEqual({}); // timeout => ignore
  });

  it("handles exit 0 with non-JSON stdout as allow", async () => {
    const hook: HookConfig = { command: `echo "not json"` };
    const result = await executeHook(
      hook,
      { hook_event_name: "PreToolUse", cwd: tmpDir },
      tmpDir,
    );
    expect(result).toEqual({});
  });

  it("handles non-zero non-2 exit as ignore", async () => {
    const hook: HookConfig = { command: `exit 1` };
    const result = await executeHook(
      hook,
      { hook_event_name: "PreToolUse", cwd: tmpDir },
      tmpDir,
    );
    expect(result).toEqual({});
  });
});

// ─── runHooks ─────────────────────────────────────────────────

describe("runHooks", () => {
  it("returns empty output when no hooks configured", async () => {
    const result = await runHooks({}, "PreToolUse", { cwd: tmpDir }, tmpDir);
    expect(result).toEqual({});
  });

  it("block decision wins over allow when multiple hooks run", async () => {
    const config: HooksConfig = {
      hooks: {
        PreToolUse: [
          { command: `echo '{"decision":"allow"}'` },
          { command: `bash -c 'echo "no writes" >&2; exit 2'` },
        ],
      },
    };
    const result = await runHooks(
      config,
      "PreToolUse",
      { cwd: tmpDir, tool_name: "write_file" },
      tmpDir,
    );
    expect(result.decision).toBe("block");
  });

  it("merges additionalContext from multiple hooks", async () => {
    const config: HooksConfig = {
      hooks: {
        PostToolUse: [
          { command: `echo '{"additionalContext":"ctx1"}'` },
          { command: `echo '{"additionalContext":"ctx2"}'` },
        ],
      },
    };
    const result = await runHooks(
      config,
      "PostToolUse",
      { cwd: tmpDir, tool_name: "bash" },
      tmpDir,
    );
    expect(result.additionalContext).toContain("ctx1");
    expect(result.additionalContext).toContain("ctx2");
  });
});
