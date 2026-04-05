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

describe("enhanceToolError - permission denied", () => {
  it("read_file permission denied suggests chmod", () => {
    const error = "Error: EACCES: permission denied, open '/etc/shadow'";
    const result = enhanceToolError("read_file", { path: "/etc/shadow" }, error, "/tmp");
    expect(result).toContain("chmod");
    expect(result).toContain("Permission denied");
  });

  it("write_file permission denied suggests chmod", () => {
    const error = "Error: EACCES: permission denied, open '/etc/hosts'";
    const result = enhanceToolError("write_file", { path: "/etc/hosts" }, error, "/tmp");
    expect(result).toContain("chmod");
  });

  it("bash permission denied suggests chmod +x", () => {
    const error = "Error: permission denied: ./deploy.sh";
    const result = enhanceToolError("bash", { command: "./deploy.sh" }, error, "/tmp");
    expect(result).toContain("chmod");
  });
});

describe("enhanceToolError - port in use", () => {
  it("EADDRINUSE suggests lsof command", () => {
    const error = "Error: listen EADDRINUSE: address already in use :::3000";
    const result = enhanceToolError("bash", { command: "node server.js" }, error, "/tmp");
    expect(result).toContain("lsof");
    expect(result).toContain("3000");
  });

  it("address already in use without port still suggests lsof", () => {
    const error = "Error: address already in use";
    const result = enhanceToolError("bash", { command: "npm start" }, error, "/tmp");
    expect(result).toContain("lsof");
  });
});

describe("enhanceToolError - out of memory", () => {
  it("JavaScript heap out of memory suggests NODE_OPTIONS", () => {
    const error = "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory";
    const result = enhanceToolError("bash", { command: "node build.js" }, error, "/tmp");
    expect(result).toContain("NODE_OPTIONS");
    expect(result).toContain("memory");
  });

  it("ENOMEM error suggests reducing scope", () => {
    const error = "Error: ENOMEM: not enough memory";
    const result = enhanceToolError("bash", { command: "node process.js" }, error, "/tmp");
    expect(result).toContain("memory");
  });
});

describe("enhanceToolError - JSON syntax error", () => {
  it("SyntaxError JSON suggests trailing comma fix", () => {
    const error = "SyntaxError: Unexpected token } in JSON at position 42";
    const result = enhanceToolError("bash", { command: "node -e 'JSON.parse(data)'" }, error, "/tmp");
    expect(result).toContain("Trailing comma");
    expect(result).toContain("JSON");
  });

  it("Invalid JSON error suggests missing quotes", () => {
    const error = "Invalid JSON: parse error";
    const result = enhanceToolError("bash", { command: "cat config.json | jq ." }, error, "/tmp");
    expect(result).toContain("quotes");
  });
});

describe("enhanceToolError - module not found", () => {
  it("Cannot find module suggests npm install", () => {
    const error = "Error: Cannot find module 'lodash'";
    const result = enhanceToolError("bash", { command: "node index.js" }, error, "/tmp");
    expect(result).toContain("npm install");
    expect(result).toContain("lodash");
  });

  it("relative module not found suggests checking path and .js extension", () => {
    const error = "Error: Cannot find module './utils'";
    const result = enhanceToolError("bash", { command: "node index.js" }, error, "/tmp");
    expect(result).toContain(".js");
    expect(result).toContain("./utils");
  });

  it("ERR_MODULE_NOT_FOUND suggests npm install", () => {
    const error = "Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'express'";
    const result = enhanceToolError("bash", { command: "node app.js" }, error, "/tmp");
    expect(result).toContain("npm install");
    expect(result).toContain("express");
  });
});
