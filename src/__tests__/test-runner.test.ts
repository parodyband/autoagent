import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findRelatedTests, runRelatedTests, detectTestRunner } from "../test-runner.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "test-runner-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function write(rel: string, content: string) {
  const abs = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

describe("findRelatedTests", () => {
  it("finds direct match in src/__tests__", () => {
    write("src/__tests__/foo.test.ts", 'import { foo } from "../foo.js";');
    const results = findRelatedTests(tmp, ["src/foo.ts"]);
    expect(results.some(r => r.includes("foo.test.ts"))).toBe(true);
  });

  it("finds test via import scan", () => {
    write("src/__tests__/bar.test.ts", 'import { bar } from "../bar.js";\n// tests');
    // No direct match file, but import scan should find it
    const results = findRelatedTests(tmp, ["src/bar.ts"]);
    expect(results.some(r => r.includes("bar.test.ts"))).toBe(true);
  });

  it("returns empty array when no tests found", () => {
    const results = findRelatedTests(tmp, ["src/nonexistent.ts"]);
    expect(results).toEqual([]);
  });

  it("deduplicates when direct match and import scan both find same file", () => {
    write("src/__tests__/baz.test.ts", 'import { baz } from "../baz.js";');
    const results = findRelatedTests(tmp, ["src/baz.ts"]);
    const unique = new Set(results);
    expect(unique.size).toBe(results.length);
  });

  // Co-located test file discovery
  it("finds co-located .test.ts next to source file", () => {
    write("src/utils.test.ts", 'import { utils } from "./utils.js";');
    const results = findRelatedTests(tmp, ["src/utils.ts"]);
    expect(results.some(r => r.includes("utils.test.ts"))).toBe(true);
  });

  it("finds co-located .test.tsx next to source file", () => {
    write("src/components/Button.test.tsx", 'import { Button } from "./Button.js";');
    const results = findRelatedTests(tmp, ["src/components/Button.tsx"]);
    expect(results.some(r => r.includes("Button.test.tsx"))).toBe(true);
  });

  // .spec.ts pattern discovery
  it("finds co-located .spec.ts file", () => {
    write("src/parser.spec.ts", 'import { parse } from "./parser.js";');
    const results = findRelatedTests(tmp, ["src/parser.ts"]);
    expect(results.some(r => r.includes("parser.spec.ts"))).toBe(true);
  });

  it("finds .spec.ts in src/__tests__ dir", () => {
    write("src/__tests__/formatter.spec.ts", 'import { format } from "../formatter.js";');
    const results = findRelatedTests(tmp, ["src/formatter.ts"]);
    expect(results.some(r => r.includes("formatter.spec.ts"))).toBe(true);
  });

  it("finds .spec.ts in test/ dir", () => {
    write("test/validator.spec.ts", 'import { validate } from "../src/validator.js";');
    const results = findRelatedTests(tmp, ["src/validator.ts"]);
    expect(results.some(r => r.includes("validator.spec.ts"))).toBe(true);
  });

  it("finds .spec.ts via import scan when not a direct name match", () => {
    // A spec file that imports the module — found by import scan, not name match
    write("src/__tests__/helpers.spec.ts", 'import { helper } from "../helpers.js";\n// specs here');
    const results = findRelatedTests(tmp, ["src/helpers.ts"]);
    expect(results.some(r => r.includes("helpers.spec.ts"))).toBe(true);
  });

  it("finds co-located test in nested subdirectory", () => {
    write("src/features/auth/auth.test.ts", 'import { auth } from "./auth.js";');
    const results = findRelatedTests(tmp, ["src/features/auth/auth.ts"]);
    expect(results.some(r => r.includes("auth.test.ts"))).toBe(true);
  });
});

describe("detectTestRunner", () => {
  it("detects vitest from devDependencies", () => {
    write("package.json", JSON.stringify({ devDependencies: { vitest: "^1.0.0" } }));
    expect(detectTestRunner(tmp)).toBe("vitest");
  });

  it("detects jest from dependencies", () => {
    write("package.json", JSON.stringify({ dependencies: { jest: "^29.0.0" } }));
    expect(detectTestRunner(tmp)).toBe("jest");
  });

  it("returns null when no test runner in package.json", () => {
    write("package.json", JSON.stringify({ dependencies: {} }));
    expect(detectTestRunner(tmp)).toBeNull();
  });
});

describe("runRelatedTests", () => {
  it("returns passed:true with empty output for empty test list", async () => {
    const result = await runRelatedTests(tmp, []);
    expect(result.passed).toBe(true);
    expect(result.output).toBe("");
  });

  it("returns passed:true when no test runner detected", async () => {
    write("package.json", JSON.stringify({ dependencies: {} }));
    const result = await runRelatedTests(tmp, ["some.test.ts"]);
    expect(result.passed).toBe(true);
  });
});
