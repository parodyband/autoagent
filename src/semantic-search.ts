/**
 * BM25-based semantic code search engine.
 * No external dependencies — pure TypeScript.
 */

// BM25 parameters
const K1 = 1.5;
const B = 0.75;
const CHUNK_SIZE = 20; // lines per chunk

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to',
  'of', 'it', 'its', 'for', 'with', 'as', 'be', 'by', 'this', 'that',
  'are', 'was', 'were', 'not', 'but', 'if', 'do', 'we', 'he', 'she',
  'they', 'you', 'your', 'our', 'can', 'will', 'all', 'from', 'has',
  'have', 'had', 'so', 'no', 'up', 'out', 'about', 'than', 'into',
  'return', 'returns', 'const', 'let', 'var', 'new', 'function', 'class', 'import',
  'export', 'default', 'type', 'interface', 'extends', 'implements',
  'public', 'private', 'protected', 'static', 'async', 'await', 'void',
  'true', 'false', 'null', 'undefined', 'typeof', 'instanceof',
]);

/** Split a code token on camelCase and snake_case boundaries */
function splitIdentifier(token: string): string[] {
  // Split camelCase: handleAuthUser -> handle, Auth, User
  const camelSplit = token.replace(/([a-z])([A-Z])/g, '$1 $2')
                          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  // Split snake_case and kebab-case
  return camelSplit.split(/[_\-\s]+/).filter(t => t.length > 0);
}

/**
 * Tokenize a piece of code into searchable terms.
 * Exported so agent tools can reuse it when building queries.
 */
export function tokenize(text: string): string[] {
  const raw = text
    .replace(/\/\/[^\n]*/g, ' ')     // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // strip block comments (non-greedy)
    .split(/[^\w]+/);                   // split on non-word chars

  const tokens: string[] = [];
  for (const raw_token of raw) {
    if (!raw_token) continue;
    for (const part of splitIdentifier(raw_token)) {
      const lower = part.toLowerCase();
      if (lower.length >= 2 && !STOP_WORDS.has(lower)) {
        tokens.push(lower);
      }
    }
  }
  return tokens;
}

// ── Internal data structures ─────────────────────────────────────────────────

interface Chunk {
  id: number;
  file: string;
  lineStart: number;  // 1-indexed
  lineEnd: number;    // 1-indexed inclusive
  snippet: string;    // first 200 chars of chunk text
  termFreq: Map<string, number>;
  length: number;     // total token count
}

interface PostingEntry {
  chunkId: number;
  tf: number;
}

export interface SearchResult {
  file: string;
  lineStart: number;
  lineEnd: number;
  snippet: string;
  score: number;
}

// ── Main class ────────────────────────────────────────────────────────────────

export class CodeSearchIndex {
  private chunks: Chunk[] = [];
  private invertedIndex: Map<string, PostingEntry[]> = new Map();
  private totalLength = 0;
  private nextId = 0;

  /** Add a file's contents to the index */
  addFile(filePath: string, content: string): void {
    const lines = content.split('\n');
    const numChunks = Math.ceil(lines.length / CHUNK_SIZE);

    for (let ci = 0; ci < numChunks; ci++) {
      const lineStart = ci * CHUNK_SIZE + 1; // 1-indexed
      const lineEnd = Math.min((ci + 1) * CHUNK_SIZE, lines.length);
      const chunkLines = lines.slice(ci * CHUNK_SIZE, (ci + 1) * CHUNK_SIZE);
      const chunkText = chunkLines.join('\n');

      const tokens = tokenize(chunkText);
      const termFreq = new Map<string, number>();
      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
      }

      const chunk: Chunk = {
        id: this.nextId++,
        file: filePath,
        lineStart,
        lineEnd,
        snippet: chunkText.slice(0, 200),
        termFreq,
        length: tokens.length,
      };

      this.chunks.push(chunk);
      this.totalLength += chunk.length;

      // Update inverted index
      for (const [term, tf] of termFreq) {
        let postings = this.invertedIndex.get(term);
        if (!postings) {
          postings = [];
          this.invertedIndex.set(term, postings);
        }
        postings.push({ chunkId: chunk.id, tf });
      }
    }
  }

  /** Number of indexed files */
  get fileCount(): number {
    const files = new Set(this.chunks.map(c => c.file));
    return files.size;
  }

  /** Search for a natural language query, return ranked results */
  search(query: string, maxResults = 10): SearchResult[] {
    const N = this.chunks.length;
    if (N === 0) return [];

    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const avgdl = this.totalLength / N;
    const scores = new Map<number, number>(); // chunkId → BM25 score

    for (const term of queryTerms) {
      const postings = this.invertedIndex.get(term);
      if (!postings || postings.length === 0) continue;

      const n = postings.length; // docs containing term
      // IDF: log((N - n + 0.5) / (n + 0.5) + 1)
      const idf = Math.log((N - n + 0.5) / (n + 0.5) + 1);

      for (const { chunkId, tf } of postings) {
        const chunk = this.chunks[chunkId];
        const dl = chunk.length;
        const tfNorm = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (dl / avgdl)));
        const termScore = idf * tfNorm;
        scores.set(chunkId, (scores.get(chunkId) ?? 0) + termScore);
      }
    }

    if (scores.size === 0) return [];

    // Sort by score descending
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);

    return sorted.slice(0, maxResults).map(([chunkId, score]) => {
      const chunk = this.chunks[chunkId];
      return {
        file: chunk.file,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        snippet: chunk.snippet,
        score,
      };
    });
  }
}
