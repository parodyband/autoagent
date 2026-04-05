import { challenges, extractCode, gradeChallenge } from '../src/benchmark.js';

// Haiku responses
const haikuResponses = [
  `function reverseWords(str: string): string {
  return str
    .trim()
    .split(/\\s+/)
    .reverse()
    .join(' ');
}`,
  `function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return "";
  let prefix = "";
  const minLength = Math.min(...strs.map(s => s.length));
  for (let i = 0; i < minLength; i++) {
    const char = strs[0][i];
    if (strs.every(str => str[i] === char)) {
      prefix += char;
    } else {
      break;
    }
  }
  return prefix;
}`,
  `function flattenObject(obj: any, prefix: string = ""): { [key: string]: any } {
  const result: { [key: string]: any } = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const newKey = prefix ? \`\${prefix}.\${key}\` : key;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
  }
  return result;
}`,
];

// Sonnet responses
const sonnetResponses = [
  `function reverseWords(str: string): string {
  return str.trim().split(/\\s+/).reverse().join(' ');
}`,
  `function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return "";
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (strs[i].indexOf(prefix) !== 0) {
      prefix = prefix.slice(0, prefix.length - 1);
      if (prefix === "") return "";
    }
  }
  return prefix;
}`,
  `function flattenObject(obj: Record<string, any>, prefix: string = '', result: Record<string, any> = {}): Record<string, any> {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? \`\${prefix}.\${key}\` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flattenObject(obj[key], newKey, result);
      } else {
        result[newKey] = obj[key];
      }
    }
  }
  return result;
}`,
];

console.log('=== HAIKU (fast) ===');
for (let i = 0; i < 3; i++) {
  const code = extractCode(haikuResponses[i]);
  const result = gradeChallenge(challenges[i], code);
  console.log(`${result.passed ? '✅' : '❌'} ${result.challengeId}: ${result.testsPassed}/${result.testsRun}${result.error ? ' — ' + result.error : ''}`);
}

console.log('\n=== SONNET (balanced) ===');
for (let i = 0; i < 3; i++) {
  const code = extractCode(sonnetResponses[i]);
  const result = gradeChallenge(challenges[i], code);
  console.log(`${result.passed ? '✅' : '❌'} ${result.challengeId}: ${result.testsPassed}/${result.testsRun}${result.error ? ' — ' + result.error : ''}`);
}
