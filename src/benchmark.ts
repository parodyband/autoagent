/**
 * Capability Benchmark — Measures what the agent system can actually DO.
 * 
 * Defines coding challenges with test cases, sends them to sub-agents,
 * executes the returned code, and grades pass/fail.
 */

export interface Challenge {
  id: string;
  description: string;
  prompt: string;
  testCases: Array<{ input: unknown[]; expected: unknown }>;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface BenchmarkResult {
  challengeId: string;
  passed: boolean;
  testsRun: number;
  testsPassed: number;
  error?: string;
}

// Shared prompt suffix to ensure clean JavaScript output
const JS_SUFFIX = `\n\nIMPORTANT: Write plain JavaScript only. No TypeScript, no type annotations, no imports. Return ONLY the function as a pure function. No console.log, no module.exports.`;

export const challenges: Challenge[] = [
  // --- EASY ---
  {
    id: 'reverse-words',
    description: 'Reverse words in a string',
    difficulty: 'easy',
    prompt: `Write a JavaScript function called \`reverseWords\` that takes a string and returns it with the words in reverse order. Words are separated by spaces. Trim extra spaces.${JS_SUFFIX}\n\nExample: reverseWords("hello world") => "world hello"`,
    testCases: [
      { input: ['hello world'], expected: 'world hello' },
      { input: ['the sky is blue'], expected: 'blue is sky the' },
      { input: ['  spaces  everywhere  '], expected: 'everywhere spaces' },
      { input: ['single'], expected: 'single' },
      { input: [''], expected: '' },
    ],
  },
  {
    id: 'fibonacci',
    description: 'Return the nth Fibonacci number',
    difficulty: 'easy',
    prompt: `Write a JavaScript function called \`fibonacci\` that takes a non-negative integer n and returns the nth Fibonacci number. fib(0)=0, fib(1)=1, fib(2)=1, fib(3)=2, etc.${JS_SUFFIX}\n\nExample: fibonacci(6) => 8`,
    testCases: [
      { input: [0], expected: 0 },
      { input: [1], expected: 1 },
      { input: [2], expected: 1 },
      { input: [6], expected: 8 },
      { input: [10], expected: 55 },
    ],
  },

  // --- MEDIUM ---
  {
    id: 'longest-common-prefix',
    description: 'Find longest common prefix of string array',
    difficulty: 'medium',
    prompt: `Write a JavaScript function called \`longestCommonPrefix\` that takes an array of strings and returns their longest common prefix. Return empty string if no common prefix.${JS_SUFFIX}\n\nExample: longestCommonPrefix(["flower","flow","flight"]) => "fl"`,
    testCases: [
      { input: [['flower', 'flow', 'flight']], expected: 'fl' },
      { input: [['dog', 'racecar', 'car']], expected: '' },
      { input: [['interspecies', 'interstellar', 'interstate']], expected: 'inters' },
      { input: [['alone']], expected: 'alone' },
      { input: [[]], expected: '' },
    ],
  },
  {
    id: 'group-anagrams',
    description: 'Group strings that are anagrams of each other',
    difficulty: 'medium',
    prompt: `Write a JavaScript function called \`groupAnagrams\` that takes an array of strings and returns an array of groups where each group contains strings that are anagrams of each other. Order within groups and order of groups does not matter.${JS_SUFFIX}\n\nExample: groupAnagrams(["eat","tea","tan","ate","nat","bat"]) => [["eat","tea","ate"],["tan","nat"],["bat"]]`,
    testCases: [
      // We'll use a custom comparator in grading for this one since order doesn't matter
      { input: [['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], expected: [['ate', 'eat', 'tea'], ['nat', 'tan'], ['bat']] },
      { input: [['a']], expected: [['a']] },
      { input: [['']], expected: [['']] },
    ],
  },

  // --- HARD ---
  {
    id: 'flatten-object',
    description: 'Flatten a nested object with dot notation keys',
    difficulty: 'hard',
    prompt: `Write a JavaScript function called \`flattenObject\` that takes a nested object and returns a flat object with dot-notation keys. Arrays should NOT be flattened — treat them as leaf values.${JS_SUFFIX}\n\nExample: flattenObject({a: {b: 1, c: {d: 2}}}) => {"a.b": 1, "a.c.d": 2}`,
    testCases: [
      { input: [{ a: 1, b: 2 }], expected: { a: 1, b: 2 } },
      { input: [{ a: { b: 1 } }], expected: { 'a.b': 1 } },
      { input: [{ a: { b: { c: 3 } }, d: 4 }], expected: { 'a.b.c': 3, d: 4 } },
      { input: [{}], expected: {} },
    ],
  },
  {
    id: 'cron-matches',
    description: 'Parse a simple cron expression and check if a time matches',
    difficulty: 'hard',
    prompt: `Write a JavaScript function called \`cronMatches\` that takes a simplified cron string and a Date object, and returns true if the date matches the cron pattern. The cron string has 5 fields: "minute hour dayOfMonth month dayOfWeek". Each field is either a number or "*" (wildcard, matches any). Months are 1-12, dayOfWeek is 0-6 (Sunday=0).${JS_SUFFIX}\n\nExample: cronMatches("30 9 * * 1", new Date("2024-01-08T09:30:00")) => true (Monday at 9:30)`,
    testCases: [
      { input: ['* * * * *', new Date('2024-01-01T00:00:00')], expected: true },
      { input: ['0 0 * * *', new Date('2024-01-01T00:00:00')], expected: true },
      { input: ['0 0 * * *', new Date('2024-01-01T12:30:00')], expected: false },
      { input: ['30 9 * * 1', new Date('2024-01-08T09:30:00')], expected: true }, // Monday
      { input: ['30 9 * * 1', new Date('2024-01-09T09:30:00')], expected: false }, // Tuesday
    ],
  },
];

/**
 * Extract a function from LLM response text.
 * Tries to find code between ``` blocks, falls back to raw text.
 */
export function extractCode(response: string): string {
  // Try fenced code block first
  const fenced = response.match(/```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)```/);
  if (fenced) return stripTypeAnnotations(fenced[1].trim());
  
  // Try to find function declaration directly
  const funcMatch = response.match(/((?:export\s+)?function\s+\w+[\s\S]*)/);
  if (funcMatch) return stripTypeAnnotations(funcMatch[1].trim());
  
  // Try arrow function
  const arrowMatch = response.match(/((?:export\s+)?(?:const|let)\s+\w+\s*=[\s\S]*)/);
  if (arrowMatch) return stripTypeAnnotations(arrowMatch[1].trim());
  
  return stripTypeAnnotations(response.trim());
}

/**
 * Strip TypeScript type annotations as a safety net (prompts request plain JS).
 * This is a best-effort fallback, not the primary mechanism.
 */
export function stripTypeAnnotations(code: string): string {
  let result = code;
  // Remove 'export ' prefix
  result = result.replace(/^export\s+/, '');
  // Remove interface/type declarations (whole lines)
  result = result.replace(/^\s*(?:interface|type)\s+\w+[\s\S]*?^}/gm, '');
  // Remove generic type params: function foo<T>(...) → function foo(...)
  result = result.replace(/function\s+(\w+)\s*<[^>]+>/g, 'function $1');
  // Remove parameter type annotations: (x: string, y: number) → (x, y)
  // Uses negative lookbehind to avoid matching object keys
  result = result.replace(/(\(|,\s*)(\w+)\s*:\s*\w+(?:<[^>]*>)?(?:\[\])?\s*(?=[,)=])/g, '$1$2');
  // Remove 'as Type' assertions
  result = result.replace(/\s+as\s+\w+(?:<[^>]*>)?/g, '');
  return result;
}

/**
 * Normalize for order-independent comparison (for challenges like group-anagrams).
 */
function normalizeForComparison(val: unknown): string {
  if (Array.isArray(val)) {
    // If it's an array of arrays, sort inner arrays then sort outer
    if (val.length > 0 && Array.isArray(val[0])) {
      const sorted = val.map((inner: unknown[]) => 
        [...inner].sort()
      ).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      return JSON.stringify(sorted);
    }
    return JSON.stringify([...val].sort());
  }
  return JSON.stringify(val);
}

/**
 * Run a single challenge's test cases against extracted code.
 */
export function gradeChallenge(challenge: Challenge, code: string): BenchmarkResult {
  const result: BenchmarkResult = {
    challengeId: challenge.id,
    passed: false,
    testsRun: 0,
    testsPassed: 0,
  };

  let fn: Function;
  try {
    const fnName = challenge.id.replace(/-./g, x => x[1].toUpperCase());
    const wrapped = `${code}\nreturn ${fnName};`;
    fn = new Function(wrapped)();
    if (typeof fn !== 'function') {
      result.error = `Code did not produce a callable function (got ${typeof fn})`;
      return result;
    }
  } catch (e) {
    result.error = `Code execution error: ${e instanceof Error ? e.message : String(e)}`;
    return result;
  }

  // Determine if this challenge needs order-independent comparison
  const orderIndependent = challenge.id === 'group-anagrams';

  for (const tc of challenge.testCases) {
    result.testsRun++;
    try {
      const actual = fn(...tc.input);
      const actualStr = orderIndependent ? normalizeForComparison(actual) : JSON.stringify(actual);
      const expectedStr = orderIndependent ? normalizeForComparison(tc.expected) : JSON.stringify(tc.expected);
      if (actualStr === expectedStr) {
        result.testsPassed++;
      }
    } catch (e) {
      // Test threw — counts as failure
    }
  }

  result.passed = result.testsPassed === result.testsRun;
  return result;
}

/**
 * Format benchmark results for display.
 */
export function formatResults(results: BenchmarkResult[]): string {
  const lines: string[] = ['## Capability Benchmark Results\n'];
  let totalPassed = 0;
  let totalRun = 0;

  for (const r of results) {
    const status = r.passed ? '✅' : '❌';
    lines.push(`${status} **${r.challengeId}**: ${r.testsPassed}/${r.testsRun} tests`);
    if (r.error) lines.push(`   Error: ${r.error}`);
    totalPassed += r.testsPassed;
    totalRun += r.testsRun;
  }

  const challengesPassed = results.filter(r => r.passed).length;
  lines.push(`\n**Overall: ${challengesPassed}/${results.length} challenges, ${totalPassed}/${totalRun} tests**`);
  return lines.join('\n');
}
