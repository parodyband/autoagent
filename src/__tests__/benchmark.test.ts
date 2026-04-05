import { describe, it, expect } from 'vitest';
import { extractCode, gradeChallenge, challenges, formatResults, type BenchmarkResult } from '../benchmark.js';

describe('extractCode', () => {
  it('extracts from fenced typescript block', () => {
    const input = 'Here is the code:\n```typescript\nfunction foo() { return 1; }\n```\nDone.';
    expect(extractCode(input)).toBe('function foo() { return 1; }');
  });

  it('extracts from fenced js block', () => {
    const input = '```js\nconst x = 1;\n```';
    expect(extractCode(input)).toBe('const x = 1;');
  });

  it('extracts bare function declaration', () => {
    const input = 'function reverseWords(s: string): string { return s; }';
    expect(extractCode(input)).toBe(input.trim());
  });

  it('extracts arrow function', () => {
    const input = 'const foo = (x: number) => x + 1;';
    expect(extractCode(input)).toBe(input.trim());
  });

  it('handles empty string', () => {
    expect(extractCode('')).toBe('');
  });
});

describe('gradeChallenge', () => {
  it('passes correct reverseWords implementation', () => {
    const code = `function reverseWords(s) {
      return s.trim().split(/\\s+/).filter(Boolean).reverse().join(' ');
    }`;
    const result = gradeChallenge(challenges[0], code);
    expect(result.passed).toBe(true);
    expect(result.testsPassed).toBe(result.testsRun);
    expect(result.testsRun).toBe(5);
  });

  it('fails incorrect reverseWords implementation', () => {
    const code = 'function reverseWords(s) { return s; }';
    const result = gradeChallenge(challenges[0], code);
    expect(result.passed).toBe(false);
    expect(result.testsPassed).toBeLessThan(result.testsRun);
  });

  it('passes correct longestCommonPrefix implementation', () => {
    const code = `function longestCommonPrefix(strs) {
      if (strs.length === 0) return '';
      let prefix = strs[0];
      for (let i = 1; i < strs.length; i++) {
        while (strs[i].indexOf(prefix) !== 0) {
          prefix = prefix.slice(0, -1);
          if (prefix === '') return '';
        }
      }
      return prefix;
    }`;
    const result = gradeChallenge(challenges[1], code);
    expect(result.passed).toBe(true);
    expect(result.testsRun).toBe(5);
  });

  it('passes correct flattenObject implementation', () => {
    const code = `function flattenObject(obj, prefix = '') {
      const result = {};
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? prefix + '.' + key : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, flattenObject(obj[key], fullKey));
        } else {
          result[fullKey] = obj[key];
        }
      }
      return result;
    }`;
    const result = gradeChallenge(challenges[2], code);
    expect(result.passed).toBe(true);
    expect(result.testsRun).toBe(4);
  });

  it('handles code that throws', () => {
    const code = 'function reverseWords() { throw new Error("boom"); }';
    const result = gradeChallenge(challenges[0], code);
    expect(result.passed).toBe(false);
    expect(result.testsPassed).toBe(0);
  });

  it('handles syntactically invalid code', () => {
    const result = gradeChallenge(challenges[0], 'not valid javascript {{{');
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Code execution error');
  });
});

describe('formatResults', () => {
  it('formats passing results', () => {
    const results: BenchmarkResult[] = [
      { challengeId: 'test-1', passed: true, testsRun: 3, testsPassed: 3 },
      { challengeId: 'test-2', passed: false, testsRun: 2, testsPassed: 1, error: 'oops' },
    ];
    const output = formatResults(results);
    expect(output).toContain('✅ **test-1**');
    expect(output).toContain('❌ **test-2**');
    expect(output).toContain('1/2 challenges');
    expect(output).toContain('4/5 tests');
    expect(output).toContain('Error: oops');
  });
});
