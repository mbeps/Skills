# Document Ingestion & Chunking Strategy

This reference specifies the complete ingestion pipeline: document extraction, recursive text splitting, asymmetric embedding generation, and atomic database lifecycle management.

---

## 1. Document Extraction & Guardrails

Supported formats must be parsed into clean UTF-8 text before chunking:

| MIME Type                                                           | Handler / Tool         | Extraction Strategy                                                           |
| :------------------------------------------------------------------ | :--------------------- | :---------------------------------------------------------------------------- |
| `application/pdf`                                                   | `unpdf` or `pdf-parse` | Page-by-page text extraction. Strip standalone page numbers and header noise. |
| `text/plain`                                                        | UTF-8 buffer decoding  | Direct string conversion.                                                     |
| `text/markdown`                                                     | UTF-8 buffer decoding  | Direct read; preserve `#` headers to aid semantic boundary splitting.         |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `xlsx` / `exceljs`     | Sheet-by-sheet extraction; format rows as key-value lines or markdown tables. |

### Safety Safeguard: Truncation Ceiling
Large documents (e.g. 500+ page manuals or corrupt PDFs) can exhaust Node.js heap memory or exceed embedding API limits.
- Enforce an upper ceiling (e.g., **500,000 characters** ~ 125,000 tokens).
- When text exceeds this limit, truncate to the ceiling and flag the document record with `truncated = true` and `statusMessage = "Content truncated during extraction."`.

---

## 2. Recursive Separator Chunking

Splitting text strictly by token or character count cuts sentences in half, causing severe context fragmentation. **Recursive separator splitting** attempts to break text along structural semantic units, falling back to smaller boundaries only when a unit exceeds the target size.

### Splitting Configuration

```typescript
export const CHUNK_CONFIG = {
  CHUNK_SIZE: 1600,       // ~400 tokens (assuming ~4 characters per token)
  CHUNK_OVERLAP: 200,     // ~50 tokens (preserves context across splits)
  SEPARATORS: [
    "\n\n",               // 1. Paragraph breaks
    "\n",                 // 2. Line breaks
    ". ",                 // 3. Sentence boundaries
    " ",                  // 4. Word boundaries
    "",                   // 5. Character-level fallback
  ],
};
```

### Recursive Algorithm Implementation

```typescript
export function splitRecursive(
  text: string,
  separators: readonly string[],
  chunkSize: number,
  chunkOverlap: number,
): string[] {
  const result: string[] = [];
  const separator = separators[0] ?? "";
  const nextSeparators = separators.slice(1);

  // Split text by current separator
  const splits = separator ? text.split(separator) : Array.from(text);
  let currentDoc = "";

  for (const piece of splits) {
    const candidate = currentDoc
      ? `${currentDoc}${separator}${piece}`
      : piece;

    if (candidate.length <= chunkSize) {
      currentDoc = candidate;
    } else {
      if (currentDoc.length > 0) {
        result.push(currentDoc);
        // Retain trailing characters for overlap
        const overlapStart = Math.max(0, currentDoc.length - chunkOverlap);
        currentDoc = currentDoc.slice(overlapStart);
      }

      if (piece.length > chunkSize && nextSeparators.length > 0) {
        // Piece itself exceeds chunkSize; recurse with finer separators
        const subChunks = splitRecursive(
          piece,
          nextSeparators,
          chunkSize,
          chunkOverlap,
        );
        result.push(...subChunks);
        currentDoc = "";
      } else {
        currentDoc = piece;
      }
    }
  }

  if (currentDoc.trim().length > 0) {
    result.push(currentDoc);
  }

  return result.map((c) => c.trim()).filter((c) => c.length > 0);
}
```

---

## 3. Asymmetric Embedding Prefixes

Many state-of-the-art embedding models (such as **E5**, **BGE**, and **NVIDIA NeMoTron Embed**) are trained asymmetrically. They require explicit instruction prefixes to distinguish between indexable passages and retrieval queries:

| Context                | Prefix Pattern | Example                                                    |
| :--------------------- | :------------- | :--------------------------------------------------------- |
| **Document Ingestion** | `"passage: "`  | `"passage: PostgreSQL 17 supports pgvector extensions..."` |
| **Search Query**       | `"query: "`    | `"query: PostgreSQL vector database support"`              |

### Models Requiring Prefixes
- `intfloat/multilingual-e5-large`
- `BAAI/bge-large-en-v1.5`
- `nvidia/llama-nemotron-embed-vl-1b-v2:free`

### Implementation Pattern

```typescript
const PREFIXED_MODELS = new Set([
  "intfloat/multilingual-e5-large",
  "BAAI/bge-large-en-v1.5",
  "nvidia/llama-nemotron-embed-vl-1b-v2:free",
]);

export function formatForEmbedding(text: string, modelId: string, isQuery: boolean): string {
  if (!PREFIXED_MODELS.has(modelId)) {
    return text;
  }
  return isQuery ? `query: ${text}` : `passage: ${text}`;
}
```

### Batching Embedding Requests
Provider APIs restrict request batch sizes (e.g. max 64 or 100 texts per request). Batch embedding calls into chunks to prevent HTTP 413 or 400 errors:

```typescript
const BATCH_SIZE = 100;
const allEmbeddings: number[][] = [];

for (let i = 0; i < texts.length; i += BATCH_SIZE) {
  const batch = texts.slice(i, i + BATCH_SIZE);
  const res = await embedMany({ model: embeddingModel, values: batch });
  allEmbeddings.push(...res.embeddings);
}
```

---

## 4. Idempotent Ingestion & Database Lifecycle

Document ingestion must be **atomic** and **idempotent**. Re-ingesting an updated file must replace all its previous chunks without leaving partial states if an embedding call fails.

### Document Status State Machine

```
[Upload] ──> pending ──> processing ──> ready
                             │
                             └──(error)──> failed
```

### Atomic Database Transaction (Drizzle / SQL Example)

```typescript
export async function persistIngestedChunks(
  documentId: string,
  kbId: string,
  chunks: string[],
  embeddings: number[][],
): Promise<void> {
  // Wrap in a single transaction so deletion + insertion is all-or-nothing
  await db.transaction(async (tx) => {
    // 1. Delete old chunks
    await tx.delete(kbChunk).where(eq(kbChunk.documentId, documentId));

    // 2. Insert new chunks (tsvector is GENERATED ALWAYS in DB, omitted here)
    await tx.insert(kbChunk).values(
      chunks.map((content, idx) => ({
        id: crypto.randomUUID(),
        documentId,
        kbId,
        content,
        embedding: embeddings[idx],
        chunkIndex: idx,
        tokenCount: Math.round(content.length / 4),
      }))
    );

    // 3. Mark document ready
    await tx.update(kbDocument)
      .set({
        status: "ready",
        chunkCount: chunks.length,
        tokenCount: chunks.reduce((acc, c) => acc + Math.round(c.length / 4), 0),
        updatedAt: new Date(),
      })
      .where(eq(kbDocument.id, documentId));
  });
}
```

---

## 5. Knowledge Base Aggregate Maintenance

Whenever documents are ingested or deleted, update the parent `knowledgebase` metadata:
- `documentCount`: Count of documents in `ready` state.
- `sizeBytes`: Sum of raw file bytes in object storage.
- `indexStatus`: If any document is `processing`, status is `processing`; if any failed, `failed`; when all ready, `ready`.
- **Embedding Model Mismatch**: If a user switches their default embedding model in settings, previously embedded vectors cannot be compared with new query embeddings. Flag existing knowledge bases as `stale` or require manual re-indexing.

