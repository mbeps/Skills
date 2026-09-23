# Security, Multitenancy & Isolation in RAG Systems

This reference details the security constraints, tenant isolation patterns, and defensive safeguards required when deploying production RAG pipelines.

---

## 1. The Vector Search Multitenancy Vulnerability

Vector databases and similarity indices (including pgvector, FAISS, and Milvus) search for geometric proximity in vector space. **By default, vector searches operate globally across the entire table.**

### Anti-Pattern: In-Memory Post-Filtering
```typescript
// ❌ CRITICAL SECURITY FLAW: Retrieves across all users, then filters in code
const candidates = await db.query.kbChunk.findMany({
  orderBy: cosineDistance(kbChunk.embedding, queryVector),
  limit: 50,
});
// If another user's documents are closer in vector space, the current user gets 0 results!
const userDocs = candidates.filter(c => userKbIds.includes(c.kbId));
```
**Why this fails:**
1. **Denial of Service / Starvation**: If another tenant has dense clusters of text near the query vector, the global top-50 will be filled with unauthorized chunks, leaving 0 valid chunks for the active user after post-filtering.
2. **Side-channel leakage**: Distance calculations or query latency can leak information about other users' data.

### Correct Pattern: Pre-Filtered Query-Level Isolation
Always constrain the vector search inside the database query before ordering:

```sql
-- ✅ SECURE: Vector distance calculated ONLY within tenant-owned chunks
SELECT c.id, c.content, d.name as document_name
FROM kb_chunk c
JOIN kb_document d ON c.document_id = d.id
WHERE c.kb_id = $1                     -- Hard tenant boundary
  AND c.embedding IS NOT NULL
ORDER BY c.embedding <=> $2::vector
LIMIT 20;
```

---

## 2. Ownership Verification Guard

Never trust a `kbId` passed directly from client payloads without validating ownership against the authenticated session.

### Implementation Pattern (Server Actions / APIs)

```typescript
export async function assertKnowledgebaseOwnership(
  kbId: string,
  userId: string,
): Promise<{ id: string; name: string }> {
  const [kb] = await db
    .select({ id: knowledgebase.id, name: knowledgebase.name })
    .from(knowledgebase)
    .where(
      and(
        eq(knowledgebase.id, kbId),
        eq(knowledgebase.userId, userId), // Enforce user ownership
      ),
    )
    .limit(1);

  if (!kb) {
    throw new ForbiddenError("Access denied: Knowledge base does not exist or is not owned by user.");
  }

  return kb;
}
```

---

## 3. Storage Hierarchy & S3 Key Isolation

Store raw uploaded files in object storage using deterministic, isolated key paths:

```
Bucket: user-storage
└── kb/
    └── {knowledgeBaseId}/
        └── {documentId}/
            └── {sanitizedFilename}
```

### Path Sanitization
Never use raw client filenames in object keys:
- Strip non-alphanumeric characters (allow only `[a-zA-Z0-9._-]`).
- Enforce a 200-character length limit.
- Strip path traversal tokens (`../`, `..\\`).

---

## 4. File Validation Safeguards

| Check                  | Production Requirement                           | Rationale                                                             |
| :--------------------- | :----------------------------------------------- | :-------------------------------------------------------------------- |
| **MIME Whitelist**     | `application/pdf`, `text/plain`, `text/markdown` | Rejects executable binaries, scripts, or unsupported media formats.   |
| **Size Ceiling**       | Max 50 MB per file                               | Prevents denial-of-service via huge file processing in memory.        |
| **Extraction Ceiling** | Max 500,000 characters (~125k tokens)            | Prevents Node.js V8 memory crashes on massive files.                  |
| **Empty File Guard**   | Throw error if extracted text is 0 chars         | Prevents inserting blank or corrupt records into the vector database. |

---

## 5. Rate-Limit Normalization

Embedding and LLM APIs enforce strict rate limits (HTTP 429). When rate limits occur during search or ingestion, normalize provider error responses into actionable client errors rather than crashing the request loop:

```typescript
export function normalizeRateLimitMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/rate limit/i.test(message) || /429/i.test(message)) {
    return "Search service is currently experiencing high demand. Please retry in a few seconds.";
  }
  return "An unexpected error occurred during search.";
}
```

