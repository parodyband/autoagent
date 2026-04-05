import { describe, it, expect } from 'vitest';
import { extractCode, stripTypeAnnotations, gradeChallenge, challenges, formatResults, type BenchmarkResult } from '../benchmark.js';

describe('benchmark', () => {
  describe('extractCode', () => {
    it('extracts from fenced code blocks', () => {
      const input = 'Here is the solution:\n```javascript\nfunction foo() { return 1; }\n```\nHope that helps!';
      expect(extractCode(input)).toBe('function foo() { return 1; }');
    });

    it('extracts function declaration without fences', () => {
      const input = 'function bar(x) { return x * 2; }';
      expect(extractCode(input)).toBe('function bar(x) { return x * 2; }');
    });

    it('strips export prefix', () => {
      const input = '```js\nexport function baz() {}\n```';
      expect(extractCode(input)).toBe('function baz() {}');
    });
  });

  describe('stripTypeAnnotations', () => {
    it('removes parameter types', () => {
      expect(stripTypeAnnotations('function foo(x: string, y: number) {}')).toBe('function foo(x, y) {}');
    });

    it('removes generic type params', () => {
      expect(stripTypeAnnotations('function foo<T>(x: T) {}')).toBe('function foo(x) {}');
    });

    it('removes export prefix', () => {
      expect(stripTypeAnnotations('export function foo() {}')).toBe('function foo() {}');
    });
  });

  describe('gradeChallenge', () => {
    it('grades correct reverseWords', () => {
      const challenge = challenges.find(c => c.id === 'reverse-words')!;
      const code = `function reverseWords(s) { return s.trim().split(/\\s+/).reverse().join(' '); }`;
      const result = gradeChallenge(challenge, code);
      expect(result.passed).toBe(true);
      expect(result.testsPassed).toBe(5);
    });

    it('grades correct fibonacci', () => {
      const challenge = challenges.find(c => c.id === 'fibonacci')!;
      const code = `function fibonacci(n) { if (n <= 1) return n; let a = 0, b = 1; for (let i = 2; i <= n; i++) { [a, b] = [b, a + b]; } return b; }`;
      const result = gradeChallenge(challenge, code);
      expect(result.passed).toBe(true);
      expect(result.testsPassed).toBe(5);
    });

    it('grades correct longestCommonPrefix', () => {
      const challenge = challenges.find(c => c.id === 'longest-common-prefix')!;
      const code = `function longestCommonPrefix(strs) { if (!strs.length) return ''; let prefix = strs[0]; for (let i = 1; i < strs.length; i++) { while (strs[i].indexOf(prefix) !== 0) prefix = prefix.slice(0, -1); } return prefix; }`;
      const result = gradeChallenge(challenge, code);
      expect(result.passed).toBe(true);
      expect(result.testsPassed).toBe(5);
    });

    it('grades correct groupAnagrams', () => {
      const challenge = challenges.find(c => c.id === 'group-anagrams')!;
      const code = `function groupAnagrams(strs) { const map = {}; for (const s of strs) { const key = s.split('').sort().join(''); if (!map[key]) map[key] = []; map[key].push(s); } return Object.values(map); }`;
      const result = gradeChallenge(challenge, code);
      expect(result.passed).toBe(true);
      expect(result.testsPassed).toBe(3);
    });

    it('grades correct flattenObject', () => {
      const challenge = challenges.find(c => c.id === 'flatten-object')!;
      const code = `function flattenObject(obj, prefix) { prefix = prefix || ''; const result = {}; for (const key in obj) { const newKey = prefix ? prefix + '.' + key : key; if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) { Object.assign(result, flattenObject(obj[key], newKey)); } else { result[newKey] = obj[key]; } } return result; }`;
      const result = gradeChallenge(challenge, code);
      expect(result.passed).toBe(true);
      expect(result.testsPassed).toBe(4);
    });

    it('grades correct cronMatches', () => {
      const challenge = challenges.find(c => c.id === 'cron-matches')!
      const code = `function cronMatches(cron, date) { const [min, hr, dom, mon, dow] = cron.split(' '); const checks = [[min, date.getMinutes()], [hr, date.getHours()], [dom, date.getDate()], [mon, date.getMonth() + 1], [dow, date.getDay()]]; return checks.every(([field, val]) => field === '*' || Number(field) === val); }`;
      const result = gradeChallenge(challenge, code);
      expect(result.passed).toBe(true);
      expect(result.testsPassed).toBe(5);
    });

    it('handles broken code gracefully', () => {
      const challenge = challenges.find(c => c.id === 'reverse-words')!;
      const result = gradeChallenge(challenge, 'this is not valid code {{{');
      expect(result.passed).toBe(false);
      expect(result.error).toContain('Code execution error');
    });
  });

  describe('formatResults', () => {
    it('formats results with pass/fail', () => {
      const results: BenchmarkResult[] = [
        { challengeId: 'test-a', passed: true, testsRun: 3, testsPassed: 3 },
        { challengeId: 'test-b', passed: false, testsRun: 2, testsPassed: 1, error: 'oops' },
      ];
      const formatted = formatResults(results);
      expect(formatted).toContain('✅');
      expect(formatted).toContain('❌');
      expect(formatted).toContain('1/2 challenges');
      expect(formatted).toContain('4/5 tests');
    });
  });

  describe('challenges', () => {
    it('has at least 6 challenges', () => {
      expect(challenges.length).toBeGreaterThanOrEqual(6);
    });

    it('all challenges have required fields', () => {
      for (const c of challenges) {
        expect(c.id).toBeTruthy();
        expect(c.prompt).toBeTruthy();
        expect(c.testCases.length).toBeGreaterThan(0);
        expect(c.difficulty).toMatch(/easy|medium|hard/);
      }
    });
  });
});
