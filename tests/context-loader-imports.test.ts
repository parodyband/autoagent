import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { resolveImportGraph } from "../src/context-loader.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cl-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveImportGraph", () => {
  it("returns empty array for file with no imports", () => {
    const file = join(tmpDir, "a.ts");
    writeFileSync(file, `export const x = 1;`);
    const result = resolveImportGraph(file, 2, tmpDir);
    expect(result).toEqual([]);
  });

  it("resolves a direct relative import (.ts extension)", () => {
    const a = join(tmpDir, "a.ts");
    const b = join(tmpDir, "b.ts");
    writeFileSync(b, `export const y = 2;`);
    writeFileSync(a, `import { y } from "./b.js";`);
    const result = resolveImportGraph(a, 2, tmpDir);
    expect(result).toContain(b);
  });

  it("resolves transitive imports at depth 2", () => {
    const a = join(tmpDir, "a.ts");
    const b = join(tmpDir, "b.ts");
    const c = join(tmpDir, "c.ts");
    writeFileSync(c, `export const z = 3;`);
    writeFileSync(b, `import { z } from "./c.js";`);
    writeFileSync(a, `import { y } from "./b.js";`);
    const result = resolveImportGraph(a, 2, tmpDir);
    expect(result).toContain(b);
    expect(result).toContain(c);
  });

  it("does not follow imports beyond specified depth", () => {
    const a = join(tmpDir, "a.ts");
    const b = join(tmpDir, "b.ts");
    const c = join(tmpDir, "c.ts");
    writeFileSync(c, `export const z = 3;`);
    writeFileSync(b, `import { z } from "./c.js";`);
    writeFileSync(a, `import { y } from "./b.js";`);
    const result = resolveImportGraph(a, 1, tmpDir);
    expect(result).toContain(b);
    expect(result).not.toContain(c);
  });

  it("deduplicates files imported from multiple places", () => {
    const a = join(tmpDir, "a.ts");
    const b = join(tmpDir, "b.ts");
    const shared = join(tmpDir, "shared.ts");
    writeFileSync(shared, `export const s = 0;`);
    writeFileSync(b, `import { s } from "./shared.js";`);
    writeFileSync(a, `import { s } from "./shared.js";\nimport { x } from "./b.js";`);
    const result = resolveImportGraph(a, 2, tmpDir);
    const count = result.filter(f => f === shared).length;
    expect(count).toBe(1);
  });

  it("skips non-existent imports gracefully", () => {
    const a = join(tmpDir, "a.ts");
    writeFileSync(a, `import { x } from "./nonexistent.js";`);
    expect(() => resolveImportGraph(a, 2, tmpDir)).not.toThrow();
  });

  it("does not follow node_modules (non-relative) imports", () => {
    const a = join(tmpDir, "a.ts");
    writeFileSync(a, `import React from "react";\nimport { x } from "lodash";`);
    const result = resolveImportGraph(a, 2, tmpDir);
    expect(result).toEqual([]);
  });
});
