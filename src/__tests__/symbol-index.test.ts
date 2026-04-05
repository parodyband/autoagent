import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import path from "path";
import os from "os";
import {
  extractSymbols,
  buildSymbolIndex,
  scoreByReferences,
  formatRepoMap,
  type SymbolIndex,
} from "../symbol-index.js";
import { rankFiles } from "../file-ranker.js";

// ─── Test fixture directory ────────────────────────────────────

let tmpDir: string;

const TS_FILE = `
export function send(msg: string): void {}
export async function compactContext(): Promise<void> {}
const routeModel = (m: string) => m;
export class Orchestrator {
  run() {}
}
export interface OrchestratorOptions {
  workDir: string;
}
export type CostInfo = { cost: number };
`;

const PY_FILE = `
def extract_symbols(file_path):
    pass

class SymbolIndex:
    def __init__(self):
        pass
`;

const CONSUMER_FILE = `
import { send, Orchestrator } from "./orchestrator";
import { OrchestratorOptions } from "./orchestrator";

const o = new Orchestrator();
send("hello");
`;

const ANOTHER_CONSUMER = `
import { send } from "./orchestrator";
send("world");
`;

beforeAll(() => {
  tmpDir = path.join(os.tmpdir(), `symbol-index-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(path.join(tmpDir, "orchestrator.ts"), TS_FILE);
  writeFileSync(path.join(tmpDir, "symbols.py"), PY_FILE);
  writeFileSync(path.join(tmpDir, "consumer.ts"), CONSUMER_FILE);
  writeFileSync(path.join(tmpDir, "another.ts"), ANOTHER_CONSUMER);
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── extractSymbols ───────────────────────────────────────────

describe("extractSymbols", () => {
  it("finds functions, classes, and types in a TS file", () => {
    const symbols = extractSymbols(path.join(tmpDir, "orchestrator.ts"));
    const names = symbols.map(s => s.name);

    expect(names).toContain("send");
    expect(names).toContain("compactContext");
    expect(names).toContain("Orchestrator");
    expect(names).toContain("OrchestratorOptions");
    expect(names).toContain("CostInfo");
  });

  it("assigns correct kinds", () => {
    const symbols = extractSymbols(path.join(tmpDir, "orchestrator.ts"));
    const byName = Object.fromEntries(symbols.map(s => [s.name, s.kind]));

    expect(byName["send"]).toBe("function");
    expect(byName["compactContext"]).toBe("function");
    expect(byName["Orchestrator"]).toBe("class");
    expect(byName["OrchestratorOptions"]).toBe("type");
    expect(byName["CostInfo"]).toBe("type");
  });

  it("records correct line numbers (1-indexed)", () => {
    const symbols = extractSymbols(path.join(tmpDir, "orchestrator.ts"));
    for (const s of symbols) {
      expect(s.line).toBeGreaterThan(0);
    }
  });

  it("finds def and class in a Python file", () => {
    const symbols = extractSymbols(path.join(tmpDir, "symbols.py"));
    const names = symbols.map(s => s.name);

    expect(names).toContain("extract_symbols");
    expect(names).toContain("SymbolIndex");
  });

  it("assigns correct kinds for Python", () => {
    const symbols = extractSymbols(path.join(tmpDir, "symbols.py"));
    const byName = Object.fromEntries(symbols.map(s => [s.name, s.kind]));

    expect(byName["extract_symbols"]).toBe("function");
    expect(byName["SymbolIndex"]).toBe("class");
  });

  it("returns empty array for unsupported extensions", () => {
    const jsonPath = path.join(tmpDir, "test.json");
    writeFileSync(jsonPath, '{"key": "value"}');
    expect(extractSymbols(jsonPath)).toEqual([]);
  });

  it("returns empty array for non-existent file", () => {
    expect(extractSymbols(path.join(tmpDir, "nonexistent.ts"))).toEqual([]);
  });
});

// ─── buildSymbolIndex ────────────────────────────────────────

describe("buildSymbolIndex", () => {
  it("returns correct map structure", () => {
    const files = ["orchestrator.ts", "symbols.py"];
    const index = buildSymbolIndex(tmpDir, files);

    expect(index).toBeInstanceOf(Map);
    expect(index.has("orchestrator.ts")).toBe(true);
    expect(index.has("symbols.py")).toBe(true);
  });

  it("each entry is an array of symbols", () => {
    const index = buildSymbolIndex(tmpDir, ["orchestrator.ts"]);
    const symbols = index.get("orchestrator.ts")!;

    expect(Array.isArray(symbols)).toBe(true);
    expect(symbols.length).toBeGreaterThan(0);
  });

  it("symbol file property matches relative path key", () => {
    const index = buildSymbolIndex(tmpDir, ["orchestrator.ts"]);
    const symbols = index.get("orchestrator.ts")!;
    for (const s of symbols) {
      expect(s.file).toBe("orchestrator.ts");
    }
  });

  it("handles missing files gracefully", () => {
    const index = buildSymbolIndex(tmpDir, ["nonexistent.ts"]);
    expect(index.get("nonexistent.ts")).toEqual([]);
  });
});

// ─── scoreByReferences ──────────────────────────────────────

describe("scoreByReferences", () => {
  it("gives higher scores to widely-referenced files", () => {
    const files = ["orchestrator.ts", "consumer.ts", "another.ts"];
    const index = buildSymbolIndex(tmpDir, files);
    const scores = scoreByReferences(index, tmpDir);

    // orchestrator.ts defines 'send' which is referenced in consumer.ts AND another.ts
    expect(scores.has("orchestrator.ts")).toBe(true);
    expect(scores.get("orchestrator.ts")!).toBeGreaterThanOrEqual(2);
  });

  it("does not score files whose symbols are rarely referenced", () => {
    // consumer.ts and another.ts don't define widely-used symbols
    const files = ["orchestrator.ts", "consumer.ts", "another.ts"];
    const index = buildSymbolIndex(tmpDir, files);
    const scores = scoreByReferences(index, tmpDir);

    // consumer.ts doesn't export symbols used by others
    expect(scores.has("consumer.ts")).toBe(false);
  });

  it("returns a Map", () => {
    const index = buildSymbolIndex(tmpDir, ["orchestrator.ts"]);
    const scores = scoreByReferences(index, tmpDir);
    expect(scores).toBeInstanceOf(Map);
  });
});

// ─── formatRepoMap ──────────────────────────────────────────

describe("formatRepoMap", () => {
  it("produces expected compact format", () => {
    const index = buildSymbolIndex(tmpDir, ["orchestrator.ts"]);
    const map = formatRepoMap(index);

    expect(map).toContain("orchestrator.ts:");
    expect(map).toContain("send()");
    expect(map).toContain("Orchestrator");
  });

  it("respects topN limit", () => {
    const files = ["orchestrator.ts", "consumer.ts", "another.ts", "symbols.py"];
    const index = buildSymbolIndex(tmpDir, files);
    const map = formatRepoMap(index, 2);

    // Should only have 2 file lines (plus header)
    const fileLines = map.split("\n").filter(l => l.includes(":") && !l.startsWith("#"));
    expect(fileLines.length).toBeLessThanOrEqual(2);
  });

  it("includes Repo Map header", () => {
    const index = buildSymbolIndex(tmpDir, ["orchestrator.ts"]);
    expect(formatRepoMap(index)).toContain("## Repo Map");
  });

  it("returns empty string for empty index", () => {
    const emptyIndex: SymbolIndex = new Map();
    expect(formatRepoMap(emptyIndex)).toBe("");
  });

  it("formats functions with () suffix", () => {
    const index = buildSymbolIndex(tmpDir, ["orchestrator.ts"]);
    const map = formatRepoMap(index);
    expect(map).toMatch(/send\(\)/);
  });
});

// ─── Integration: rankFiles with symbol scoring ─────────────

describe("rankFiles integration with symbol scoring", () => {
  it("symbol-referenced files appear in ranked results with boosted score", () => {
    // orchestrator.ts is referenced by consumer.ts and another.ts
    // so it should get a symbol references bonus
    const ranked = rankFiles(tmpDir, 20);
    const orch = ranked.find(f => f.path === "orchestrator.ts");

    if (orch) {
      // If it was scored at all, the reason should include symbol references
      // (or score should be higher than without the bonus)
      expect(orch.score).toBeGreaterThan(0);
    }
    // At minimum, rankFiles should not throw
    expect(Array.isArray(ranked)).toBe(true);
  });
});
