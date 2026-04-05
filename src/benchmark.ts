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

export const challenges: Challenge[] = [
  {
    id: 'reverse-words',
    description: 'Reverse words in a string',
    difficulty: 'easy',
    prompt: 'Write a TypeScript function called `reverseWords` that takes a string and returns it with the words in reverse order. Words are separated by spaces. Trim extra spaces. Return ONLY the function, no explanation.\n\nExample: reverseWords("hello world") => "world hello"',
    testCases: [
      { input: ['hello world'], expected: 'world hello' },
      { input: ['the sky is blue'], expected: 'blue is sky the' },
      { input: ['  spaces  everywhere  '], expected: 'everywhere spaces' },
      { input: ['single'], expected: 'single' },
      { input: [''], expected: '' },
    ],
  },
  {
    id: 'longest-common-prefix',
    description: 'Find longest common prefix of string array',
    difficulty: 'medium',
    prompt: 'Write a TypeScript function called `longestCommonPrefix` that takes an array of strings and returns their longest common prefix. Return ONLY the function, no explanation.\n\nExample: longestCommonPrefix(["flower","flow","flight"]) => "fl"',
    testCases: [
      { input: [['flower', 'flow', 'flight']], expected: 'fl' },
      { input: [['dog', 'racecar', 'car']], expected: '' },
      { input: [['interspecies', 'interstellar', 'interstate']], expected: 'inters' },
      { input: [['alone']], expected: 'alone' },
      { input: [[]], expected: '' },
    ],
  },
  {
    id: 'flatten-object',
    description: 'Flatten a nested object with dot notation keys',
    difficulty: 'hard',
    prompt: 'Write a TypeScript function called `flattenObject` that takes a nested object and returns a flat object with dot-notation keys. Return ONLY the function, no explanation.\n\nExample: flattenObject({a: {b: 1, c: {d: 2}}}) => {"a.b": 1, "a.c.d": 2}',
    testCases: [
      { input: [{ a: 1, b: 2 }], expected: { a: 1, b: 2 } },
      { input: [{ a: { b: 1 } }], expected: { 'a.b': 1 } },
      { input: [{ a: { b: { c: 3 } }, d: 4 }], expected: { 'a.b.c': 3, d: 4 } },
      { input: [{}], expected: {} },
    ],
  },
];

/**
 * Extract a function from LLM response text.
 * Tries to find code between ```typescript or ``` blocks, falls back to raw text.
 */
export function extractCode(response: string): string {
  // Try fenced code block first
  const fenced = response.match(/```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  
  // Try to find function declaration directly
  const funcMatch = response.match(/((?:export\s+)?function\s+\w+[\s\S]*)/);
  if (funcMatch) return funcMatch[1].trim();
  
  // Try arrow function
  const arrowMatch = response.match(/((?:export\s+)?(?:const|let)\s+\w+\s*=[\s\S]*)/);
  if (arrowMatch) return arrowMatch[1].trim();
  
  return response.trim();
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
    // Create the function from code string
    // We wrap it to extract the named function
    const fnName = challenge.testCases.length > 0 ? challenge.id.replace(/-./g, x => x[1].toUpperCase()) : '';
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

  for (const tc of challenge.testCases) {
    result.testsRun++;
    try {
      const actual = fn(...tc.input);
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(tc.expected);
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
