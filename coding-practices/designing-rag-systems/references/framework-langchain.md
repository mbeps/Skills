# Implementation: LangChain & LangGraph (Python & TypeScript)

This reference demonstrates how the exact same **Agentic Hybrid RAG** design is implemented using **LangChain** and **LangGraph**.

---

## 1. Document Chunking (`RecursiveCharacterTextSplitter`)

LangChain provides the standard `RecursiveCharacterTextSplitter` which matches our 1,600 char / 200 overlap specification:

### Python
```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1600,
    chunk_overlap=200,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len,
    is_separator_regex=False,
)

chunks = text_splitter.split_text(raw_document_text)
```

### TypeScript
```typescript
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1600,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

const chunks = await splitter.splitText(rawDocumentText);
```

---

## 2. Hybrid Retrieval with `EnsembleRetriever` (Reciprocal Rank Fusion)

LangChain's `EnsembleRetriever` natively implements Reciprocal Rank Fusion (RRF) with parameter $c = 60$:

### Python
```python
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_postgres import PGVector
from langchain_openai import OpenAIEmbeddings

# 1. Dense Semantic Retriever (pgvector)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = PGVector(
    embeddings=embeddings,
    collection_name=f"kb_{kb_id}",
    connection="postgresql+psycopg://...",
)
dense_retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 20, "filter": {"kb_id": kb_id}}
)

# 2. Sparse Lexical Retriever (BM25 or PostgreSQL FTS)
bm25_retriever = BM25Retriever.from_documents(documents)
bm25_retriever.k = 20

# 3. Reciprocal Rank Fusion Ensemble
ensemble_retriever = EnsembleRetriever(
    retrievers=[dense_retriever, bm25_retriever],
    weights=[0.5, 0.5],  # Equal weight for dense and sparse
    c=60,                # Cormack et al. smoothing constant
)
```

---

## 3. Exposing Retrieval as an Agent Tool

Package the `EnsembleRetriever` as a tool so the LLM invokes it autonomously (**Design 3: Agentic RAG**):

### Python (LangChain `@tool`)
```python
from langchain_core.tools import tool
from typing import List, Dict, Any

@tool
def search_knowledge_base(query: str) -> List[Dict[str, Any]]:
    """Search the attached knowledge base for relevant passages, technical documentation, or facts.
    Use this tool whenever the user asks questions that require domain knowledge or specific details
    from their uploaded files. Do NOT use for general conversational banter.
    """
    docs = ensemble_retriever.invoke(query)
    
    # Return top 5 formatted results with metadata for citations
    return [
        {
            "content": doc.page_content,
            "document_name": doc.metadata.get("document_name"),
            "document_id": doc.metadata.get("document_id"),
        }
        for doc in docs[:5]
    ]
```

### TypeScript (LangChain `tool()`)
```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const searchKnowledgeBaseTool = tool(
  async ({ query }) => {
    const docs = await ensembleRetriever.invoke(query);
    return JSON.stringify(
      docs.slice(0, 5).map((doc) => ({
        content: doc.pageContent,
        documentName: doc.metadata.documentName,
        documentId: doc.metadata.documentId,
      }))
    );
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the attached knowledge base for relevant passages, technical documentation, or facts.",
    schema: z.object({
      query: z.string().describe("Specific search keywords or phrase"),
    }),
  }
);
```

---

## 4. Multi-Step Agent Execution (LangGraph)

In LangGraph, bind the tool to an LLM and run within a `ToolNode` graph loop:

### Python
```python
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o", temperature=0)
tools = [search_knowledge_base]

system_prompt = (
    "You are a helpful assistant with access to a knowledge base search tool. "
    "Formulate focused queries and ground your answers in the retrieved excerpts."
)

agent_executor = create_react_agent(
    model=model,
    tools=tools,
    state_modifier=system_prompt,
)

# Run agent
response = agent_executor.invoke({
    "messages": [("user", "What are the configuration parameters for our chunking engine?")]
})
```

