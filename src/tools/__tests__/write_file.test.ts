import { describe, it, expect } from "vitest";
import { fuzzyFindReplace } from "../write_file.js";

describe("fuzzyFindReplace", () => {
  it("returns null when exact match is not needed (caller handles exact)", () => {
    // fuzzyFindReplace is only called when exact match fails
    const content = "hello world\nfoo bar\n";
    const result = fuzzyFindReplace(content, "DOES NOT EXIST", "replacement");
    expect(result).toBeNull();
  });

  it("matches when old_string has trailing whitespace differences", () => {
    const content = "function foo() {\n  return 1;\n}\n";
    // old_string has trailing spaces that don't exist in content
    const oldStr = "function foo() {  \n  return 1;  \n}  \n";
    const newStr = "function foo() {\n  return 2;\n}\n";
    const result = fuzzyFindReplace(content, oldStr, newStr);
    expect(result).not.toBeNull();
    expect(result!.result).toBe("function foo() {\n  return 2;\n}\n");
    expect(result!.warning).toContain("fuzzy match");
  });

  it("matches when content has trailing whitespace but old_string does not", () => {
    const content = "function foo() {  \n  return 1;  \n}  \n";
    const oldStr = "function foo() {\n  return 1;\n}\n";
    const newStr = "function bar() {\n  return 2;\n}\n";
    const result = fuzzyFindReplace(content, oldStr, newStr);
    expect(result).not.toBeNull();
    expect(result!.result).toContain("function bar()");
  });

  it("returns null for completely wrong old_string", () => {
    const content = "line one\nline two\nline three\n";
    const result = fuzzyFindReplace(content, "totally different content\nxyz\n", "replacement");
    expect(result).toBeNull();
  });

  it("matches with collapsed whitespace differences", () => {
    const content = "const x  =  1;\nconst y = 2;\n";
    const oldStr = "const x = 1;\nconst y = 2;\n";
    const newStr = "const x = 99;\nconst y = 2;\n";
    const result = fuzzyFindReplace(content, oldStr, newStr);
    expect(result).not.toBeNull();
    expect(result!.result).toContain("99");
  });

  it("replaces only the matched region, leaving surrounding content intact", () => {
    const content = "before\nfoo  \nbar  \nafter\n";
    const oldStr = "foo\nbar\n";
    const newStr = "baz\n";
    const result = fuzzyFindReplace(content, oldStr, newStr);
    expect(result).not.toBeNull();
    expect(result!.result).toBe("before\nbaz\nafter\n");
  });
});
