import { describe, it, expect } from "vitest";
import { enhanceToolError } from "../tool-recovery.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tool-recovery-test-"));
}

describe("enhanceToolError - read_file", () => {
  it("file not found suggests similar files from directory listing", () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "utils.ts"), "");
    fs.writeFileSync(path.join(dir, "util-helpers.ts"), "");
    const error = "Error: ENOENT: no such file or directory, open 'util.ts'";
    const result = enhanceToolError("read_file", { path: "util.ts" }, error, dir);
    expect(result).toContain("Did you mean");
    expect(result).toContain("util");
  });

  it("nested path file not found searches parent directories", () => {
    const dir = makeTmpDir();
    const sub = path.join(dir, "src");
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, "orchestrator.ts"), "");
    const error = "Error: ENOENT: no such file or directory";
    const result = enhanceToolError("read_file", { path: "src/orchestrater.ts" }, error, dir);
    // Should suggest orchestrator.ts
    expect(result).toContain("orchestrator");
  });

  it("returns original error when no similar files found", () => {
    const dir = makeTmpDir();
    const error = "Error: ENOENT: no such file or directory, open 'zzz-nomatch.ts'";
    const result = enhanceToolError("read_file", { path: "zzz-nomatch.ts" }, error, dir);
    expect(result).toContain("ENOENT");
  });
});

describe("enhanceToolError - grep", () => {
  it("no matches suggests case-insensitive search", () => {
    const error = "No matches found";
    const result = enhanceToolError("grep", { pattern: "MyFunction", path: "src/" }, error, "/tmp");
    expect(result).toContain("case-insensitive");
    expect(result).toContain("MyFunction");
  });
});

describe("enhanceToolError - bash", () => {
  it("command not found suggests npx", () => {
    const error = "vitest: command not found";
    const result = enhanceToolError("bash", { command: "vitest run" }, error, "/tmp");
    expect(result).toContain("npx");
  });

  it("timeout suggests breaking into smaller commands", () => {
    const error = "Error: Command timed out after 30s";
    const result = enhanceToolError("bash", { command: "npm test" }, error, "/tmp");
    expect(result).toContain("smaller");
  });
});

describe("enhanceToolError - passthrough", () => {
  it("unknown tools pass through unchanged", () => {
    const error = "Some random error";
    const result = enhanceToolError("think", {}, error, "/tmp");
    expect(result).toBe(error);
  });

  it("empty error returns empty", () => {
    const result = enhanceToolError("read_file", { path: "x.ts" }, "", "/tmp");
    expect(result).toBe("");
  });
});
