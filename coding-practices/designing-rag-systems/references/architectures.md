# RAG Architectural Designs & Trade-Off Analysis

This reference provides an exhaustive evaluation of the 4 primary RAG architectures, detailing their internal dataflows, trade-offs, token budget implications, and migration paths.

---

## Design 1: Naive RAG (Pure Vector Search)

### Architecture Overview
The baseline implementation. Every user message is embedded using a dense embedding model, a similarity search against stored vectors retrieves the top-$K$ chunks, and the chunks are formatted and prepended directly to the system prompt or injected into the message context.

```
[User Message] ──> Embed Query ──> pgvector Cosine Search ──> Top-K Chunks ──> System Prompt ──> LLM Response
```

### Flow Breakdown
1. **Trigger**: Every turn unconditionally triggers retrieval.
2. **Query Execution**: Query embedded with single vector model. Fast KNN search (HNSW or exact cosine).
3. **Context Assembly**:
   ```
   [Retrieved Knowledge Base Context]
   ---
   {chunk_1}
   ---
   {chunk_2}
   ```
4. **Synthesis**: Full conversation history + retrieved context fed to LLM.

### Trade-Offs
- **Pros**:
  - Lowest implementation barrier (1 table, 1 embedding call, 1 query).
  - Minimal latency overhead (+5–15 ms).
- **Cons**:
  - **Vocabulary mismatch**: Semantic vectors fail on exact keywords, part numbers, version numbers, or code symbols.
  - **Context window waste**: Injects thousands of tokens into every turn (e.g. casual greetings or follow-ups that don't need docs).
  - **Single point of failure**: Top results depend entirely on the bi-encoder model's similarity score.

---

## Design 2: Advanced RAG (Hybrid Search + Reranking)

### Architecture Overview
Combines dense semantic vector search with sparse full-text search (BM25 or PostgreSQL `tsvector`). Results from both pipelines are merged using **Reciprocal Rank Fusion (RRF)** and optionally re-scored using a **cross-encoder reranker** (such as Cohere Rerank or BGE Reranker v2). Chunks can also be enriched during ingestion via Anthropic's **Contextual Retrieval** method.

```
                    ┌─> Vector Search (Top 20) ─┐
[User Query] ───────┤                           ├─> RRF Fusion (k=60) ─> Cross-Encoder Rerank ─> Top 5 Chunks ─> System Prompt
                    └─> BM25/FTS (Top 20) ──────┘
```

### Contextual Retrieval Enrichment (Ingestion Phase)
Before embedding, each chunk is passed to a fast/cheap LLM alongside the parent document:
```
<document>
{full_document_text}
</document>
Here is the chunk we want to sit within the overall document:
<chunk>
{chunk_content}
</chunk>
Provide a brief 2-3 sentence context explaining what this chunk describes in relation to the document.
```
Anthropic benchmarks show this technique reduces retrieval failures by **49%** alone, and **67%** when combined with reranking.

### Trade-Offs
- **Pros**:
  - Eliminates vocabulary mismatch by combining semantic and lexical signals.
  - High recall across technical documentation, code, and conversational queries.
  - Cross-encoders provide superior pair-wise relevance scoring compared to bi-encoders.
- **Cons**:
  - **Context window waste**: Still always-on; injects retrieved text into every message turn.
  - **Query latency**: Adds +100–300 ms per turn (RRF fusion + external cross-encoder API call).
  - Ingestion enrichment adds cost and latency per document.

---

## Design 3: Agentic RAG (Tool-Based Retrieval) — Recommended Baseline

### Architecture Overview
The retrieval pipeline of Design 2 (Hybrid Search + RRF) is packaged as an **AI-callable tool** (`search_knowledge_base`) rather than executing automatically. The LLM autonomously inspects the conversation, determines whether external grounding is needed, generates a targeted search query (reformulating the user's raw prompt), and invokes the tool.

```
[User Message] ──> LLM Evaluates Intent
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[Search Needed]                [No Search Needed]
       │                               │
       ▼                               ▼
Tool Call: search_knowledge_base    Generate direct answer
       │                            (0 extra latency/tokens)
       ▼
Hybrid Search (Vector + FTS)
       │
       ▼
RRF Fusion (Top 5 chunks)
       │
       ▼
Tool Result back to LLM
       │
       ▼
Synthesize grounded response
```

### Core Mechanisms
1. **Dynamic Query Reformulation**: If a user says: *"Does it support the database we discussed earlier?"*, the LLM reformulates the tool query to *"PostgreSQL vector extension pgvector compatibility"* instead of passing the raw ambiguous prompt.
2. **Iterative Multi-Step Retrieval**: If initial search results are ambiguous or miss a detail, the LLM can execute a second, refined search tool call before finalizing its response (enabled by `maxSteps: 10`).
3. **Context Window Efficiency**: Non-retrieval turns consume **zero** extra context window tokens. In long multi-turn sessions (10+ turns), this saves tens of thousands of tokens.
4. **Transparency & Citations**: Tool invocations produce structured `tool-call` and `tool-result` events, rendering as inspection panels in the UI and enabling citation mapping.

### Trade-Offs
- **Pros**:
  - Drastic context token savings on multi-turn conversations.
  - Enables query reformulation and multi-step investigation.
  - Natural fit with existing tool-calling architectures (MCP / OpenAI function calling).
- **Cons**:
  - Model dependency: Weaker LLMs (e.g. sub-8B parameters) may fail to invoke the tool when they should (8–15% miss rate).
  - Sequential latency: When triggered, introduces an extra LLM round-trip (+200–500 ms).

---

## Design 4: Hybrid Agentic RAG (Passive Baseline + Active Tool)

### Architecture Overview
Combines automatic injection with tool-based retrieval. Before the chat turn, a **lightweight passive vector search** retrieves top-3 chunks and injects them as baseline context into the system prompt. Concurrently, the `search_knowledge_base` tool remains registered for deeper or multi-faceted queries.

```
[User Message] ──────┬──> Fast Passive Vector Search (Top 3) ──> System Prompt
                     │
                     └──> LLM Receives Prompt + Tools
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
      [Baseline Sufficient]             [Deeper Search Needed]
               │                               │
               ▼                               ▼
       Generate Response            Tool Call: Full Hybrid Search (RRF)
                                               │
                                               ▼
                                    Tool Result ──> Generate Response
```

### Trade-Offs
- **Pros**:
  - Best retrieval coverage: Guaranteed baseline grounding even if the LLM forgets to call the tool.
  - LLM can escalate to deep hybrid search when the question is complex.
- **Cons**:
  - Redundancy: The tool may retrieve chunks already present in the passive injection.
  - Baseline latency hit on every message (+10–15 ms for vector search).
  - Higher prompt complexity to instruct the LLM on distinguishing passive context from active search.

---

## Comparison Matrix

| Metric                    | Design 1: Naive | Design 2: Advanced Hybrid | Design 3: Agentic (Chosen)     | Design 4: Hybrid Agentic         |
| :------------------------ | :-------------- | :------------------------ | :----------------------------- | :------------------------------- |
| **Retrieval Accuracy**    | Low–Medium      | High                      | High                           | Highest                          |
| **Per-Message Latency**   | +5–15 ms        | +100–300 ms               | 0 ms (idle) / +250 ms (active) | +15 ms (idle) / +300 ms (active) |
| **Token Efficiency**      | Poor            | Poor                      | Excellent                      | Good                             |
| **Query Rewriting**       | No              | No                        | Yes (native)                   | Yes (for tool call)              |
| **Iterative Search**      | No              | No                        | Yes                            | Yes                              |
| **Implementation Effort** | Low (~1 day)    | Medium (~3 days)          | Medium (~3 days)               | High (~5 days)                   |

---

## Token Budgeting for 128k Context Windows

When designing context limits in multi-turn chat applications:

```
Total Context (128,000 tokens)
├── System Prompt & Tool Schemas:   ~2,000 - 4,000 tokens (Fixed)
├── Conversation History:           ~80,000 tokens (Sliding window truncation)
├── RAG Retrieved Context:          ~2,000 - 4,000 tokens (5 chunks @ ~400 tokens)
└── Generation & Reasoning Buffer:  ~30,000 - 40,000 tokens (Output reserve)
```

In Design 3, the RAG retrieved context only consumes tokens when the tool fires, preserving the full conversation history during intermediate discussion turns.

---

## Migration Paths

The 4 designs form an incremental progression:

1. **Design 1 &rarr; Design 2**:
   - Add PostgreSQL `GENERATED ALWAYS` `tsvector` column and GIN index.
   - Implement `applyRRF()` utility.
   - Query both vector and FTS in parallel, merging with RRF ($k=60$).
2. **Design 2 &rarr; Design 3**:
   - Wrap the hybrid search function in a tool schema (`search_knowledge_base`).
   - Remove automatic system prompt injection.
   - Pass tool into `streamText` with `maxSteps: 10`.
3. **Design 3 &rarr; Design 4**:
   - Re-introduce a top-3 vector query before `streamText` and inject as system prompt.
   - Keep the tool registered for deep queries.

