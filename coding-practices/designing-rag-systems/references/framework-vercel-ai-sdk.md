# Implementation: Vercel AI SDK (TypeScript & Next.js)

This reference provides a complete, production-ready implementation of **Design 3: Agentic RAG** using the **Vercel AI SDK** in a Next.js App Router application.

---

## 1. Tool Definition: `search_knowledge_base`

Define the tool using the Vercel AI SDK `tool` helper and `zod` for input validation:

```typescript
import { tool } from "ai";
import { z } from "zod";
import { hybridSearch } from "@/lib/rag/hybrid-search";

export const searchKnowledgeBaseSchema = z.object({
  query: z
    .string()
    .min(1, "Search requires a specific keyword or phrase")
    .max(500, "Query cannot exceed 500 characters")
    .describe("Specific search keywords or conceptual phrase to look up in the user's documents."),
});

export function createSearchKnowledgeBaseTool(activeKbId: string, userId: string) {
  return tool({
    description:
      "Search the attached knowledge base for relevant passages, technical documentation, or facts. " +
      "Use this tool whenever the user asks questions that require domain knowledge or specific details from their uploaded files. " +
      "Do NOT use for general conversational banter or basic programming syntax.",
    parameters: searchKnowledgeBaseSchema,
    execute: async ({ query }) => {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return {
          success: false,
          error: "Missing search query parameter.",
        };
      }

      const results = await hybridSearch(activeKbId, normalizedQuery, userId, 5);

      if (results.length === 0) {
        return {
          success: true,
          results: [],
          resultCount: 0,
          message: `No documents matched '${normalizedQuery}'. Try broader keywords.`,
        };
      }

      return {
        success: true,
        results: results.map((r) => ({
          content: r.content,
          relevanceScore: Number(r.score.toFixed(4)),
          documentId: r.documentId,
          documentName: r.documentName,
        })),
        resultCount: results.length,
      };
    },
  });
}
```

---

## 2. Ingestion Embeddings (`embedMany`)

Batch embedding chunks during document ingestion:

```typescript
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const BATCH_SIZE = 100;

export async function embedDocumentChunks(
  chunks: string[],
  modelIdentifier: string = "text-embedding-3-small",
): Promise<number[][]> {
  if (chunks.length === 0) return [];

  // Prefix passages if using an asymmetric model (e.g. E5, BGE, Nemotron)
  const isAsymmetric = modelIdentifier.includes("bge") || modelIdentifier.includes("e5");
  const values = isAsymmetric ? chunks.map((c) => `passage: ${c}`) : chunks;

  const embeddings: number[][] = [];

  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const { embeddings: batchEmbeddings } = await embedMany({
      model: openai.embedding(modelIdentifier),
      values: batch,
    });
    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}
```

---

## 3. Query Embedding (`embed`)

Embedding search queries at retrieval time:

```typescript
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";

export async function embedSearchQuery(
  query: string,
  modelIdentifier: string = "text-embedding-3-small",
): Promise<number[]> {
  const isAsymmetric = modelIdentifier.includes("bge") || modelIdentifier.includes("e5");
  const value = isAsymmetric ? `query: ${query}` : query;

  const { embedding } = await embed({
    model: openai.embedding(modelIdentifier),
    value,
  });

  return embedding;
}
```

---

## 4. Chat Route Integration (`streamText` with Multi-Step Agentic Loop)

In Next.js Route Handlers (`app/api/chat/route.ts`), register the tool and enable multi-step execution with `maxSteps`:

```typescript
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createSearchKnowledgeBaseTool } from "@/lib/rag/tools/search-kb-tool";

export async function POST(req: Request) {
  const { messages, activeKbId, userId } = await req.json();

  const tools: Record<string, any> = {};

  if (activeKbId) {
    tools.search_knowledge_base = createSearchKnowledgeBaseTool(activeKbId, userId);
  }

  const result = streamText({
    model: openai("gpt-4o"),
    system:
      "You are a helpful assistant. You have access to a knowledge base search tool. " +
      "If the user asks questions about their uploaded documents, search the knowledge base " +
      "before answering. Formulate focused, specific search queries. Ground your answers strictly in the retrieved facts.",
    messages,
    tools,
    // Enable multi-step agentic loop so LLM can search, inspect results, and synthesize
    maxSteps: 10,
  });

  return result.toDataStreamResponse();
}
```

---

## 5. UI Citation Extraction

Extract citations from the streaming tool results on the client or server:

```typescript
export interface Citation {
  documentId: string;
  documentName: string;
  relevanceScore: number;
}

export function extractCitations(toolResults: any[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const tr of toolResults) {
    if (tr.toolName === "search_knowledge_base" && tr.result?.results) {
      for (const item of tr.result.results) {
        if (!seen.has(item.documentId)) {
          seen.add(item.documentId);
          citations.push({
            documentId: item.documentId,
            documentName: item.documentName,
            relevanceScore: item.relevanceScore,
          });
        }
      }
    }
  }

  return citations.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
```

