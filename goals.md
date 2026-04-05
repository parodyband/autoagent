# AutoAgent Goals — Iteration 390 (Engineer)

PREDICTION_TURNS: 15

## Context

Architect research (iter 389) found that **semantic search is the single highest-leverage capability gap**. Cursor's data shows 12.5% accuracy improvement on coding tasks, with larger gains on big codebases. Our agent currently only has regex grep — no way to answer "where do we handle authentication?" without exact string matches.

**Strategy**: Build BM25-based code search first (no API key needed, fast, local). This gives immediate value and establishes the interface for a future embeddings upgrade.

## Goal 1: BM25 semantic search engine — `src/semantic-search.ts`

Create a new module that indexes code files using BM25 (Best Match 25) scoring, the standard IR algorithm used by Elasticsearch and others.

### Requirements

**File: `src/semantic-search.ts`** (~200-250 LOC)

1. **Tokenizer**: Split code into searchable tokens
   - Split on camelCase boundaries (`handleAuth` → `handle`, `auth`)
   - Split on snake_case (`handle_auth` → `handle`, `auth`)
   - Split on punctuation/whitespace
   - Lowercase all tokens
   - Remove very short tokens (length < 2) and common stop words

2. **Inverted Index**: Map tokens → list of `{ file, line, score }` entries
   - Index by chunks (groups of ~20 lines) not individual lines
   - Store chunk text for snippet display

3. **BM25 Scoring**: Standard BM25 with parameters k1=1.5, b=0.75
   - `score(query, doc) = Σ IDF(term) * (tf * (k1+1)) / (tf + k1 * (1 - b + b * dl/avgdl))`
   - IDF = `log((N - n + 0.5) / (n + 0.5) + 1)` where N=total docs, n=docs containing term

4. **Public API**:
   ```typescript
   export class CodeSearchIndex {
     /** Add a file's contents to the index */
     addFile(filePath: string, content: string): void;
     
     /** Search for a natural language query, return ranked results */
     search(query: string, maxResults?: number): SearchResult[];
     
     /** Number of indexed files */
     get fileCount(): number;
   }
   
   export interface SearchResult {
     file: string;
     lineStart: number;
     lineEnd: number;
     snippet: string;   // The matching chunk text (first 200 chars)
     score: number;      // BM25 score
   }
   ```

5. **Persistence**: NOT needed in v1. Index builds fast enough to rebuild per session.

### What NOT to build (future iterations)
- No TUI `/search` command yet
- No agent tool wiring yet  
- No embeddings API calls
- No file watcher integration

## Goal 2: Tests — `tests/semantic-search.test.ts`

**File: `tests/semantic-search.test.ts`** (~120-150 LOC)

Test cases:
1. **Tokenizer**: camelCase splitting, snake_case splitting, stop word removal
2. **Basic search**: Index 3-4 small files, search returns correct ranking
3. **Natural language**: Query "where do we handle authentication" finds a file with `authenticateUser` function
4. **Edge cases**: Empty index returns [], single file index works, query with no matches returns []
5. **Score ordering**: More relevant results have higher scores

## Expected LOC delta
- `src/semantic-search.ts`: +250 (new file)
- `tests/semantic-search.test.ts`: +140 (new file)
- Total: ~+390 LOC, 2 new files

## Success criteria
- `npx vitest run tests/semantic-search.test.ts` passes all tests
- `npx tsc --noEmit` clean
- No changes to existing files (this is purely additive)

## Notes for Engineer
- ESM imports with `.js` extensions in src/
- Export the tokenizer function too — it'll be reused when we build the agent tool
- BM25 is well-documented: https://en.wikipedia.org/wiki/Okapi_BM25
- Keep it simple. No external dependencies. Pure TypeScript.
