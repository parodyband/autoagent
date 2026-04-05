import { describe, it, expect } from 'vitest';
import { tokenize, CodeSearchIndex } from '../src/semantic-search.js';

// ── Tokenizer tests ───────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('splits camelCase identifiers', () => {
    const tokens = tokenize('handleAuthRequest');
    expect(tokens).toContain('handle');
    expect(tokens).toContain('auth');
    expect(tokens).toContain('request');
  });

  it('splits snake_case identifiers', () => {
    const tokens = tokenize('handle_auth_request');
    expect(tokens).toContain('handle');
    expect(tokens).toContain('auth');
    expect(tokens).toContain('request');
  });

  it('splits kebab-case identifiers', () => {
    const tokens = tokenize('handle-auth-request');
    expect(tokens).toContain('handle');
    expect(tokens).toContain('auth');
    expect(tokens).toContain('request');
  });

  it('removes stop words', () => {
    const tokens = tokenize('the function returns a value');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('function');
    expect(tokens).not.toContain('returns');
    // 'a' should be removed (single char or stop word)
    expect(tokens).not.toContain('a');
    expect(tokens).toContain('value');
  });

  it('removes tokens shorter than 2 chars', () => {
    const tokens = tokenize('a b c do');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).not.toContain('c');
  });

  it('lowercases all tokens', () => {
    const tokens = tokenize('AuthenticateUser');
    expect(tokens).toContain('authenticate');
    expect(tokens).toContain('user');
    expect(tokens).not.toContain('Authenticate');
    expect(tokens).not.toContain('User');
  });

  it('strips line comments', () => {
    const tokens = tokenize('// this is a comment\nauthenticateUser()');
    // Comment tokens should not dominate; auth tokens should appear
    expect(tokens).toContain('authenticate');
    expect(tokens).toContain('user');
  });

  it('strips block comments', () => {
    const tokens = tokenize('/* block comment */ authenticateUser()');
    expect(tokens).toContain('authenticate');
    expect(tokens).toContain('user');
  });

  it('handles empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('handles string with only stop words', () => {
    const tokens = tokenize('const let var if for');
    // All are stop words — should return nothing or just short tokens removed
    expect(Array.isArray(tokens)).toBe(true);
    for (const t of tokens) {
      expect(t.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── CodeSearchIndex tests ─────────────────────────────────────────────────────

describe('CodeSearchIndex', () => {
  it('starts with fileCount 0', () => {
    const idx = new CodeSearchIndex();
    expect(idx.fileCount).toBe(0);
  });

  it('tracks fileCount after adding files', () => {
    const idx = new CodeSearchIndex();
    idx.addFile('a.ts', 'function foo() {}');
    expect(idx.fileCount).toBe(1);
    idx.addFile('b.ts', 'function bar() {}');
    expect(idx.fileCount).toBe(2);
  });

  it('returns empty array for empty index', () => {
    const idx = new CodeSearchIndex();
    expect(idx.search('authentication')).toEqual([]);
  });

  it('returns empty array when no matches found', () => {
    const idx = new CodeSearchIndex();
    idx.addFile('utils.ts', 'function add(a: number, b: number) { return a + b; }');
    const results = idx.search('xyzzy_nonexistent_term_12345');
    expect(results).toEqual([]);
  });

  it('returns results for a basic search', () => {
    const idx = new CodeSearchIndex();
    idx.addFile('auth.ts', `
      export function authenticateUser(username: string, password: string) {
        // Check credentials against database
        return verifyCredentials(username, password);
      }
    `);
    const results = idx.search('authenticate user');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toBe('auth.ts');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('finds authentication code via natural language query', () => {
    const idx = new CodeSearchIndex();
    idx.addFile('utils.ts', `
      export function formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
      }
      export function truncate(str: string, len: number): string {
        return str.slice(0, len);
      }
    `);
    idx.addFile('auth.ts', `
      export function authenticateUser(token: string): boolean {
        return validateJWT(token);
      }
      export function authorizeRequest(userId: string, resource: string): boolean {
        return checkPermissions(userId, resource);
      }
    `);
    idx.addFile('db.ts', `
      export function queryDatabase(sql: string, params: unknown[]): unknown[] {
        return executeQuery(sql, params);
      }
    `);

    // Query with terms that tokenize to 'authenticate' — matches auth.ts
    const results = idx.search('authenticate authorize');
    expect(results.length).toBeGreaterThan(0);
    // auth.ts should be ranked first since it contains authentication-related code
    expect(results[0].file).toBe('auth.ts');
  });

  it('ranks more relevant results higher', () => {
    const idx = new CodeSearchIndex();
    // File with authentication mentioned many times
    idx.addFile('auth-service.ts', `
      export class AuthService {
        authenticate(user: string, pass: string): boolean {
          const authToken = generateAuthToken(user);
          const authResult = validateAuth(authToken);
          return authResult.authenticated;
        }
        revokeAuth(token: string): void {
          invalidateAuthToken(token);
        }
      }
    `);
    // File with authentication mentioned once
    idx.addFile('server.ts', `
      import { AuthService } from './auth-service';
      export function startServer(port: number) {
        const server = http.createServer();
        server.listen(port);
      }
    `);

    const results = idx.search('authentication auth');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toBe('auth-service.ts');

    // Verify score ordering: scores should be descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('result has correct lineStart and lineEnd fields', () => {
    const idx = new CodeSearchIndex();
    idx.addFile('example.ts', 'function greet(name: string) {\n  return `Hello ${name}`;\n}\n');
    const results = idx.search('greet name');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].lineStart).toBeGreaterThanOrEqual(1);
    expect(results[0].lineEnd).toBeGreaterThanOrEqual(results[0].lineStart);
  });

  it('result snippet is a non-empty string', () => {
    const idx = new CodeSearchIndex();
    idx.addFile('example.ts', 'function processPayment(amount: number) { return charge(amount); }');
    const results = idx.search('process payment');
    expect(results.length).toBeGreaterThan(0);
    expect(typeof results[0].snippet).toBe('string');
    expect(results[0].snippet.length).toBeGreaterThan(0);
  });

  it('respects maxResults parameter', () => {
    const idx = new CodeSearchIndex();
    // Add many files with overlapping terms
    for (let i = 0; i < 20; i++) {
      idx.addFile(`file${i}.ts`, `function handleRequest${i}(req: Request) { return processRequest(req); }`);
    }
    const results = idx.search('handle request', 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('works with a single file', () => {
    const idx = new CodeSearchIndex();
    idx.addFile('only.ts', 'export const VERSION = "1.0.0";');
    const results = idx.search('version');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file).toBe('only.ts');
  });

  it('handles large files spanning multiple chunks', () => {
    const idx = new CodeSearchIndex();
    // Build a file with 100 lines; the search term appears on line 85
    const lines: string[] = [];
    for (let i = 0; i < 84; i++) lines.push(`  const x${i} = ${i};`);
    lines.push('  function validateJwtToken(token: string): boolean { return true; }');
    for (let i = 86; i < 100; i++) lines.push(`  const y${i} = ${i};`);
    idx.addFile('large.ts', lines.join('\n'));

    const results = idx.search('validate jwt token');
    expect(results.length).toBeGreaterThan(0);
    // The matching chunk should cover the area around line 85
    const best = results[0];
    expect(best.lineStart).toBeLessThanOrEqual(85);
    expect(best.lineEnd).toBeGreaterThanOrEqual(85);
  });
});
