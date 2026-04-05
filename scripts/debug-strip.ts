import { extractCode, stripTypeAnnotations } from '../src/benchmark.ts';

const haiku_flat_raw = `function flattenObject(obj: any, prefix: string = ""): { [key: string]: any } {
  const result: { [key: string]: any } = {};
  for (const key in obj) {
    const newKey = prefix ? \`\${prefix}.\${key}\` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }
  return result;
}`;

const stripped = stripTypeAnnotations(haiku_flat_raw);
console.log('=== STRIPPED ===');
console.log(stripped);
console.log('=== EVAL TEST ===');
try {
  const fn = new Function(stripped + '\nreturn flattenObject;')();
  console.log('fn type:', typeof fn);
  console.log('result:', fn({a: {b: 1, c: {d: 2}}}));
} catch (e: any) {
  console.log('ERROR:', e.message);
  // Find which line fails
  const lines = stripped.split('\n');
  lines.forEach((l, i) => console.log(`  ${i}: ${l}`));
}
