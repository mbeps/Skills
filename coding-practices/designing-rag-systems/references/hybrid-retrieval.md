# Hybrid Retrieval & Reciprocal Rank Fusion (RRF)

This reference covers the mathematical foundation and database implementation of hybrid search combining dense semantic vectors and sparse lexical full-text search, fused via Reciprocal Rank Fusion (RRF).

---

## 1. Why Hybrid Retrieval?

Single-modality retrieval exhibits well-documented systemic failure modes:

| Modality                          | Strength                                               | Failure Mode                                                                              | Example                                                                                  |
| :-------------------------------- | :----------------------------------------------------- | :---------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Dense Vector (Bi-Encoder)**     | High semantic recall, handles synonyms, cross-lingual. | **Vocabulary Mismatch**: Fails on specific alphanumeric IDs, exact error codes, acronyms. | Query `"ERR-40301"` retrieves general auth docs instead of the exact error code snippet. |
| **Sparse Full-Text (BM25 / FTS)** | Exact keyword matching, rare term precision.           | **Semantic Blindness**: Fails when queries use synonyms without lexical overlap.          | Query `"automobile repair"` misses chunks describing `"car maintenance"`.                |
| **Hybrid (Vector + FTS)**         | Captures both conceptual similarity and exact tokens.  | None of the above; complementary signals.                                                 | Both documents surface and are boosted by Rank Fusion.                                   |

---

## 2. Reciprocal Rank Fusion (RRF)

### Mathematical Formulation
Introduced by Cormack, Clarke, and Büttcher (SIGIR 2009), **Reciprocal Rank Fusion** merges multiple ranked retrieval lists without requiring score normalization:

$$\text{RRFScore}(d) = \sum_{r \in R} \frac{1}{k + \text{rank}_r(d)}$$

Where:
- $R$: Set of retrieval systems (e.g. $R = \{\text{vector}, \text{fts}\}$).
- $\text{rank}_r(d)$: 1-based ordinal position of document $d$ in the results of ranker $r$.
- $k$: Smoothing constant (default: **$60$**).

### Why $k = 60$?
- **Prevents Top-Rank Domination**: Without $k$, rank #1 would receive a score of $1.0$, while rank #2 receives $0.5$ (a massive 50% drop). With $k = 60$, rank #1 gets $\frac{1}{61} \approx 0.01639$ and rank #2 gets $\frac{1}{62} \approx 0.01613$. The drop is smooth, allowing items that appear at modest ranks in *both* systems to surpass an item that only appeared in one.
- **Empirical Rigor**: Cormack et al. evaluated values of $k$ from $1$ to $1000$ across TREC datasets; $k = 60$ consistently maximized Mean Average Precision (MAP).

### TypeScript RRF Implementation

```typescript
export interface RawChunkCandidate {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
}

export interface FusedChunkResult extends RawChunkCandidate {
  score: number;
}

export function applyRRF(
  vectorCandidates: RawChunkCandidate[],
  ftsCandidates: RawChunkCandidate[],
  topK: number = 5,
  k: number = 60,
): FusedChunkResult[] {
  const scoreMap = new Map<string, { candidate: RawChunkCandidate; score: number }>();

  // Process Vector Ranks (0-indexed converted to 1-based rank)
  vectorCandidates.forEach((cand, idx) => {
    const rank = idx + 1;
    scoreMap.set(cand.id, {
      candidate: cand,
      score: 1 / (k + rank),
    });
  });

  // Process Full-Text Search Ranks
  ftsCandidates.forEach((cand, idx) => {
    const rank = idx + 1;
    const rrfContribution = 1 / (k + rank);
    const existing = scoreMap.get(cand.id);

    if (existing) {
      existing.score += rrfContribution;
    } else {
      scoreMap.set(cand.id, {
        candidate: cand,
        score: rrfContribution,
      });
    }
  });

  // Sort descending by combined RRF score and return top K
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ candidate, score }) => ({
      ...candidate,
      score,
    }));
}
```

---

## 3. PostgreSQL Database Engine Implementation

### Schema Definition (Drizzle / PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_chunk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES kb_document(id) ON DELETE CASCADE,
  kb_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- Or model dimension
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  -- PostgreSQL automatically maintains tsvector tokens
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for tenant filtering
CREATE INDEX kb_chunk_kb_id_idx ON kb_chunk(kb_id);

-- GIN index for full-text search
CREATE INDEX kb_chunk_search_vector_idx ON kb_chunk USING gin (search_vector);
```

### The 2,000-Dimension pgvector Indexing Limit
> [!IMPORTANT]
> PostgreSQL pgvector restricts HNSW and IVFFlat indexes to a maximum of **2,000 dimensions**:
> - Models with $\le 2000$ dimensions (e.g. OpenAI `text-embedding-3-small` at 1536 dim): Use **HNSW index** (`USING hnsw (embedding vector_cosine_ops)`).
> - Models with $> 2000$ dimensions (e.g. NVIDIA NeMoTron Embed at 2048 dim): **Do NOT create an HNSW index**. Run **exact brute-force cosine distance** (`ORDER BY embedding <=> $1::vector`). For personal/small-team collections (<100,000 chunks), exact search completes in under 15 ms with perfect recall.

---

## 4. Production Hybrid Search Query

Execute both searches in parallel against the active knowledge base, applying user isolation and graceful fallback:

```typescript
export async function executeHybridSearch(
  kbId: string,
  query: string,
  queryEmbedding: number[],
  topK: number = 5,
): Promise<FusedChunkResult[]> {
  const normalizedQuery = query.trim();
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;

  // 1. Vector Search (Exact cosine distance or HNSW)
  const vectorQuery = db.execute(sql`
    SELECT 
      c.id, 
      c.content, 
      c.document_id, 
      d.name as document_name
    FROM kb_chunk c
    JOIN kb_document d ON c.document_id = d.id
    WHERE c.kb_id = ${kbId}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${embeddingLiteral}::vector
    LIMIT 20
  `);

  // 2. Full-Text Search (plainto_tsquery with cover density ranking)
  const ftsQuery = db.execute(sql`
    SELECT 
      c.id, 
      c.content, 
      c.document_id, 
      d.name as document_name
    FROM kb_chunk c
    JOIN kb_document d ON c.document_id = d.id
    WHERE c.kb_id = ${kbId}
      AND c.search_vector @@ plainto_tsquery('english', ${normalizedQuery})
    ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', ${normalizedQuery})) DESC
    LIMIT 20
  `);

  // Execute both concurrently with non-fatal FTS handling
  const [vectorRes, ftsRes] = await Promise.allSettled([vectorQuery, ftsQuery]);

  const vectorRows = vectorRes.status === "fulfilled"
    ? (vectorRes.value.rows as unknown as RawChunkCandidate[])
    : [];

  let ftsRows: RawChunkCandidate[] = [];
  if (ftsRes.status === "fulfilled") {
    ftsRows = ftsRes.value.rows as unknown as RawChunkCandidate[];
  } else {
    // Non-fatal fallback: log warning and continue with vector-only
    console.warn("FTS search failed; falling back to vector-only results", ftsRes.reason);
  }

  return applyRRF(vectorRows, ftsRows, topK, 60);
}
```

---

## 5. Post-Retrieval Cross-Encoder Reranking (Optional)

In Design 2, the top 10 fused candidates from RRF can be passed to a cross-encoder:

```
RRF Top 10 Chunks ──> Cross-Encoder (Query + Chunk jointly) ──> Re-score ──> Top 5
```

- **Options**: Cohere Rerank API (`rerank-v3.5`), BGE-Reranker-v2 (self-hosted via Ollama).
- **Benefit**: Evaluates cross-attention between every query word and chunk word; boosts precision by 10–18%.
- **Cost**: Adds 100–300 ms latency and external API reliance. For small personal knowledge bases, RRF alone delivers 90%+ of the practical benefit with zero added latency or cost.

