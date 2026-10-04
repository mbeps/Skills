# references/rag-architectures.md

## 1. Architectural Standards & API Migration

Modern LangChain architectures discard monolithic, stateful execution chains in favor of declarative runnables orchestrated through the LangChain Expression Language (LCEL) and explicit factory constructors. Legacy primitives introduce hidden prompt templates, opaque internal control flows, and unmanaged memory states that fail under production constraints.

Monolithic classes such as `RetrievalQA` and `ConversationalRetrievalChain` couple vector store querying, prompt formatting, document combination, and memory tracking into single opaque objects. Modern implementations decouple these responsibilities into discrete, composable units:
- **Document Combination**: Executes through `create_stuff_documents_chain`.
- **Query Contextualization**: Executes through `create_history_aware_retriever`.
- **End-to-End Retrieval Pipelines**: Execute through `create_retrieval_chain`.
- **Dynamic Control Loops**: Execute through stateful `StateGraph` workflows within LangGraph.

| Component Domain                | Deprecated Abstraction (Pre-0.2 / 0.3 Removed)  | Modern Production Architecture (LangChain Core / 0.3+)                             |
| :------------------------------ | :---------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Q&A Retrieval**               | `langchain.chains.RetrievalQA`                  | `create_retrieval_chain` + `create_stuff_documents_chain`                          |
| **Conversational RAG**          | `langchain.chains.ConversationalRetrievalChain` | `create_history_aware_retriever` + `create_retrieval_chain`                        |
| **Document Stuffing**           | `langchain.chains.StuffDocumentsChain`          | `langchain.chains.combine_documents.create_stuff_documents_chain`                  |
| **Arbitrary Execution**         | `langchain.chains.LLMChain`                     | LCEL composition: `ChatPromptTemplate \| ChatModel \| OutputParser`                |
| **Conversation Memory**         | `langchain.memory.ConversationBufferMemory`     | LangGraph checkpointers (`MemorySaver`, `PostgresSaver`) or external session state |
| **Vector Storage (PostgreSQL)** | `langchain_community.vectorstores.PGVector`     | `langchain_postgres.vectorstores.PGVector`                                         |
| **Document Splitters**          | `langchain.text_splitter.*`                     | `langchain_text_splitters.*`                                                       |

Modern deployments enforce strict namespace separation across four functional tiers:
- `langchain-core`: Base abstractions (`BaseRetriever`, `Document`, `BaseChatModel`, `Runnable`, `RunnableConfig`) and core schemas with zero third-party platform dependencies.
- `langchain`: Higher-level orchestration logic, multi-component pipelines, and chain factory methods (`create_retrieval_chain`).
- `langchain-community`: Open community integrations maintained outside core release cycles.
- Partner Packages (`langchain-openai`, `langchain-postgres`, `langchain-chroma`): Dedicated, vendor-optimized modules with independent versioning.

---

## 2. Static Type Hinting & Ingestion Deduplication

Production systems must enforce type safety across data boundaries using Python type annotations and Pydantic validation schemas. LangChain runnables adhere to the `Runnable[Input, Output]` protocol, where generic inputs and outputs remain explicit throughout the data pipeline. The `RunnableConfig` dictionary passes runtime configuration keys into every runnable step to handle trace isolation, execution tags, concurrency limits, and metadata propagation without altering component call signatures.

```python
from typing import Optional, Sequence
from typing_extensions import TypedDict
from pydantic import BaseModel, Field
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import RunnableConfig

class DocumentMetadata(BaseModel):
    """Schema for validated document metadata."""
    source: str = Field(description="Original file path or URI.")
    page: int = Field(ge=0, description="Page index of the source document.")
    chunk_id: str = Field(description="Deterministic hash of chunk content.")

class RAGInput(TypedDict):
    """Input payload to a standard retrieval-augmented generation chain."""
    input: str
    chat_history: Optional[Sequence[dict[str, str]]]

class RAGOutput(TypedDict):
    """Output payload from a standard retrieval-augmented generation chain."""
    input: str
    context: Sequence[Document]
    answer: str

class GroundedAnswer(BaseModel):
    """Structured generation target with explicit citations."""
    answer: str = Field(description="Direct response to the question.")
    citations: list[int] = Field(
        default_factory=list,
        description="List of document context indices supporting the answer."
    )

def invoke_typed_retriever(
    retriever: BaseRetriever,
    query: str,
    *,
    config: Optional[RunnableConfig] = None
) -> list[Document]:
    """Retrieve documents using strict type boundaries."""
    return retriever.invoke(query, config=config)

```

### 2.1 LangChain Indexing API and `SQLRecordManager`

Re-indexing entire document corpora causes excessive embedding costs and database fragmentation. The LangChain Indexing API utilizes a `SQLRecordManager` to compute document hashes, track ingestion timestamps, and selectively reconcile vectors against the vector store.

The `cleanup` parameter governs vector store mutations during indexing:

* `full`: Purges any vector in the namespace whose source document is omitted from the current indexing payload.


* `incremental`: Replaces vectors whose hashes have changed and deletes older versions of updated sources, while retaining unmodified documents.


* `None`: Appends new documents and ignores deletions.



```python
from langchain.indexes import SQLRecordManager, index
from langchain_core.documents import Document
from langchain_postgres.vectorstores import PGVector
from langchain_text_splitters import RecursiveCharacterTextSplitter

def ingest_enterprise_corpus(
    raw_documents: list[Document],
    vector_store: PGVector,
    db_url: str,
    collection_name: str,
) -> dict[str, int]:
    """Ingest documents with chunking and incremental deduplication."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        add_start_index=True,
    )
    chunks = splitter.split_documents(raw_documents)

    record_manager = SQLRecordManager(
        namespace=f"postgres/{collection_name}",
        db_url=db_url,
    )
    record_manager.create_schema()

    sync_stats = index(
        docs_source=chunks,
        record_manager=record_manager,
        vector_store=vector_store,
        cleanup="incremental",
        source_id_key="source",
    )
    return sync_stats

```

---

## 3. Multi-Stage and Hybrid Retrieval Systems

Standard vector similarity search with bi-encoders degrades when confronted with vocabulary mismatches, specific entity queries, or complex reasoning requirements. Robust production pipelines resolve these issues using multi-stage retrieval architectures.

### 3.1 Multi-Representation and Hierarchical Retrieval

A fundamental trade-off exists in dense vector search: small chunks produce optimal embedding representations for vector similarity matching, but large chunks provide the comprehensive context that language models require to generate grounded answers. Engineers must configure systems to index child chunks in the vector store while mapping the content to parent documents in secondary key-value storage.

### 3.2 Hybrid Sparse-Dense Search with Reciprocal Rank Fusion

Dense bi-encoder retrieval often fails on keyword queries, specific identifiers, part numbers, and technical terminology. Sparse lexical search using BM25 guarantees deterministic keyword matching. `EnsembleRetriever` merges sparse and dense retrieval streams using the Reciprocal Rank Fusion (RRF) algorithm.

Reciprocal Rank Fusion calculates an integrated score for each document $d$ across retrieval rankings:

$$RRF(d) = \sum_{m \in M} \frac{w_m}{60 + r_m(d)}$$

where $M$ denotes the set of retrievers, $w_m$ represents the retriever weight, and $r_m(d)$ indicates the rank position of document $d$ in retriever $m$.

```python
from typing import Sequence
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever

def construct_hybrid_retriever(
    corpus: Sequence[Document],
    dense_retriever: VectorStoreRetriever,
    sparse_weight: float = 0.4,
    dense_weight: float = 0.6,
) -> EnsembleRetriever:
    """Combine sparse and dense retrieval streams with RRF."""
    sparse_retriever = BM25Retriever.from_documents(documents=list(corpus))
    sparse_retriever.k = 10

    ensemble = EnsembleRetriever(
        retrievers=[sparse_retriever, dense_retriever],
        weights=[sparse_weight, dense_weight],
    )
    return ensemble

```

### 3.3 Contextual Compression and Cross-Encoder Reranking

Bi-encoders calculate query and document embeddings independently, limiting relevance capture. Cross-encoders process query tokens and document tokens simultaneously through cross-attention layers, computing higher-accuracy relevance scores.

Raw bi-encoder retrieval results must not pass directly to the generation model. Systems must run two-stage retrieval: the dense vector retriever first gathers candidates ($k \ge 20$ or $k \ge 50$), and a cross-encoder then reranks and filters them to the top candidates ($n \le 5$). This two-stage pattern prevents token waste, isolates relevant information, and maximizes model answer accuracy.

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_core.retrievers import BaseRetriever

def attach_reranker(
    base_retriever: BaseRetriever,
    model_name: str = "BAAI/bge-reranker-base",
    top_n: int = 5,
) -> ContextualCompressionRetriever:
    """Attach cross-encoder reranker to compress retrieved candidates."""
    rerank_model = HuggingFaceCrossEncoder(model_name=model_name)
    compressor = CrossEncoderReranker(model=rerank_model, top_n=top_n)
    return ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=base_retriever,
    )

```

---

## 4. Conversational RAG with LangChain Expression Language (LCEL)

Enterprise conversational RAG requires decoupling query reformulation from document synthesis. A conversational system cannot query vector storage directly using conversational inputs such as "What did it do next?" because the query lacks standalone semantic context. Multi-turn conversations often introduce ambiguous follow-up questions that depend on prior context.

The `create_history_aware_retriever` solves this issue using a two-stage approach:

1. An LLM reformulates the user's latest query and the prior conversation history into a standalone search query.


2. The system passes this rephrased query to the retriever, and `create_retrieval_chain` combines retrieved documents with history to generate the final response using `create_stuff_documents_chain`.



```python
from typing import Any
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.retrievers import BaseRetriever
from langchain_core.runnables import RunnableSerializable
from langchain_openai import ChatOpenAI

def construct_conversational_rag_pipeline(
    retriever: BaseRetriever,
    model_name: str = "gpt-4o",
) -> RunnableSerializable[dict[str, Any], dict[str, Any]]:
    """Build a conversational RAG chain with query reformulation."""
    llm = ChatOpenAI(model=model_name, temperature=0.0)

    # Sub-chain 1: Query Reformulation
    contextualize_q_system_prompt = (
        "Given a chat history and the latest user question "
        "which might reference context in the chat history, "
        "formulate a standalone question which can be understood "
        "without the chat history. Do NOT answer the question, "
        "just reformulate it if needed and otherwise return it as is."
    )
    contextualize_q_prompt = ChatPromptTemplate.from_messages([
        ("system", contextualize_q_system_prompt),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])
    history_aware_retriever = create_history_aware_retriever(
        llm=llm,
        retriever=retriever,
        prompt=contextualize_q_prompt,
    )

    # Sub-chain 2: Answer Generation over Retrieved Documents
    qa_system_prompt = (
        "You are an assistant for question-answering tasks. "
        "Use the following pieces of retrieved context to answer "
        "the question. If you do not know the answer, say that you "
        "do not know. Use three sentences maximum and keep the "
        "answer concise.\n\n"
        "{context}"
    )
    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", qa_system_prompt),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])
    question_answer_chain = create_stuff_documents_chain(
        llm=llm,
        prompt=qa_prompt,
    )

    # Master Chain Orchestration
    rag_chain: RunnableSerializable[dict[str, Any], dict[str, Any]] = create_retrieval_chain(
        retriever=history_aware_retriever,
        combine_docs_chain=question_answer_chain,
    )
    return rag_chain

```

---

## 5. Agentic & Corrective RAG (CRAG) with LangGraph

Standard static chains fail when a retriever returns low-relevance or empty document sets. Corrective RAG (CRAG) and Self-RAG use programmatic control loops to evaluate retrieved context, run fallback queries when local data is insufficient, and refine generations to eliminate hallucinations.

LangGraph models these control loops as state machines where application state moves through nodes (isolated units of compute) and conditional edges (deterministic branch points).

```python
from typing import Any, Literal
from typing_extensions import TypedDict
from pydantic import BaseModel, Field
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.retrievers import BaseRetriever
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END

class AgenticRAGState(TypedDict):
    """The central state structure for a Corrective RAG pipeline."""
    question: str
    generation: str
    documents: list[Document]
    retry_count: int

class RelevanceGrade(BaseModel):
    """Binary score indicating document relevance to the query."""
    binary_score: Literal["yes", "no"] = Field(
        description="Documents are relevant to the question, 'yes' or 'no'"
    )

class GroundednessGrade(BaseModel):
    """Binary score indicating answer adherence to the context."""
    binary_score: Literal["yes", "no"] = Field(
        description="Answer is grounded in the provided facts, 'yes' or 'no'"
    )

def build_crag_graph(retriever: BaseRetriever) -> StateGraph:
    """Build a Corrective RAG state machine with query mutation and hallucination checks."""
    llm = ChatOpenAI(model="gpt-4o", temperature=0.0)

    def retrieve_node(state: AgenticRAGState) -> dict[str, Any]:
        """Fetch documents from vector storage."""
        docs = retriever.invoke(state["question"])
        return {"documents": docs, "retry_count": state.get("retry_count", 0)}

    def grade_documents_node(state: AgenticRAGState) -> dict[str, Any]:
        """Filter out irrelevant retrieved context chunks."""
        grader = llm.with_structured_output(RelevanceGrade)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an evaluator assessing document relevance to a question. "
                       "Provide a binary score: 'yes' if relevant, 'no' if irrelevant."),
            ("human", "Question: {question}\n\nContext:\n{context}"),
        ])
        eval_chain = prompt | grader

        valid_docs: list[Document] = []
        for doc in state["documents"]:
            grade: RelevanceGrade = eval_chain.invoke(
                {"question": state["question"], "context": doc.page_content}
            )
            if grade.binary_score == "yes":
                valid_docs.append(doc)

        return {"documents": valid_docs}

    def transform_query_node(state: AgenticRAGState) -> dict[str, Any]:
        """Reformulate search query upon retrieval failure."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an AI optimizer that rewrites user questions "
                       "for improved semantic search retrieval. Provide only the updated text."),
            ("human", "Original Question: {question}"),
        ])
        chain = prompt | llm
        rewritten = chain.invoke({"question": state["question"]})
        current_retries = state.get("retry_count", 0) + 1

        return {
            "question": str(rewritten.content),
            "retry_count": current_retries,
        }

    def generate_node(state: AgenticRAGState) -> dict[str, Any]:
        """Synthesize answer using the validated context."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Answer the question strictly using the provided context. "
                       "If context is missing, declare lack of evidence.\n\nContext:\n{context}"),
            ("human", "{question}"),
        ])
        rag_chain = prompt | llm
        context_str = "\n\n".join(doc.page_content for doc in state["documents"])
        response = rag_chain.invoke({"context": context_str, "question": state["question"]})

        return {"generation": str(response.content)}

    def decide_retrieval_adequacy(
        state: AgenticRAGState
    ) -> Literal["generate", "transform_query"]:
        """Evaluate if enough context remains after relevance grading."""
        if not state["documents"] and state.get("retry_count", 0) < 2:
            return "transform_query"
        return "generate"

    def check_groundedness(
        state: AgenticRAGState
    ) -> Literal["grounded", "unsupported"]:
        """Verify the generated answer does not introduce hallucinations."""
        evaluator = llm.with_structured_output(GroundednessGrade)
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Assess if the generation is strictly supported by the context documents. "
                       "Answer 'yes' for grounded, 'no' for unsupported."),
            ("human", "Context:\n{context}\n\nGeneration:\n{generation}"),
        ])
        context_str = "\n\n".join(doc.page_content for doc in state["documents"])
        result: GroundednessGrade = (prompt | evaluator).invoke({
            "context": context_str,
            "generation": state["generation"],
        })

        if result.binary_score == "yes":
            return "grounded"
        return "unsupported"

    workflow = StateGraph(AgenticRAGState)

    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("grade_documents", grade_documents_node)
    workflow.add_node("transform_query", transform_query_node)
    workflow.add_node("generate", generate_node)

    workflow.add_edge(START, "retrieve")
    workflow.add_edge("retrieve", "grade_documents")

    workflow.add_conditional_edges(
        "grade_documents",
        decide_retrieval_adequacy,
        {
            "transform_query": "transform_query",
            "generate": "generate",
        }
    )

    workflow.add_edge("transform_query", "retrieve")

    workflow.add_conditional_edges(
        "generate",
        check_groundedness,
        {
            "grounded": END,
            "unsupported": "generate",
        }
    )

    return workflow.compile()

```

---

## 6. End-to-End Production Reference Pipeline

The complete application below connects a persistent PGVector database, synchronizes chunks via `SQLRecordManager`, builds a hybrid `EnsembleRetriever` with a `CrossEncoderReranker`, constructs an LCEL conversational pipeline, and serves the pipeline via FastAPI and LangServe.

```python
import os
from typing import Any
from fastapi import FastAPI
from pydantic import BaseModel, Field
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableSerializable
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.indexes import SQLRecordManager, index
from langchain.retrievers import ContextualCompressionRetriever, EnsembleRetriever
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langserve import add_routes

# Database URIs and Collection Name
DB_URI = os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:secret@localhost:5432/rag_db")
RECORD_MGR_URI = os.getenv("RECORD_MGR_URL", "sqlite:////tmp/record_manager.db")
COLLECTION_NAME = "enterprise_knowledge_base"

def ingest_enterprise_corpus(
    raw_documents: list[Document],
    vector_store: PGVector,
    db_url: str,
) -> dict[str, int]:
    """Ingest documents with chunking and deduplication."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        add_start_index=True,
    )
    chunks = splitter.split_documents(raw_documents)

    record_manager = SQLRecordManager(
        namespace=f"postgres/{COLLECTION_NAME}",
        db_url=db_url,
    )
    record_manager.create_schema()

    sync_stats = index(
        docs_source=chunks,
        record_manager=record_manager,
        vector_store=vector_store,
        cleanup="incremental",
        source_id_key="source",
    )
    return sync_stats

def construct_hybrid_rerank_retriever(
    vector_store: PGVector,
    documents_seed: list[Document],
) -> ContextualCompressionRetriever:
    """Build a multi-stage retriever with hybrid search and cross-encoder reranking."""
    dense_retriever = vector_store.as_retriever(search_kwargs={"k": 20})

    sparse_retriever = BM25Retriever.from_documents(documents=documents_seed)
    sparse_retriever.k = 20

    ensemble = EnsembleRetriever(
        retrievers=[sparse_retriever, dense_retriever],
        weights=[0.3, 0.7],
    )

    rerank_model = HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-base")
    compressor = CrossEncoderReranker(model=rerank_model, top_n=5)

    final_retriever = ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=ensemble,
    )
    return final_retriever

def initialize_production_pipeline(
    retriever: ContextualCompressionRetriever,
) -> RunnableSerializable[dict[str, Any], dict[str, Any]]:
    """Assemble conversational RAG pipeline using LCEL factory methods."""
    llm = ChatOpenAI(model="gpt-4o", temperature=0.0)

    history_prompt = ChatPromptTemplate.from_messages([
        ("system", "Rewrite the user query as a standalone search input using the chat history."),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])
    history_retriever = create_history_aware_retriever(
        llm=llm,
        retriever=retriever,
        prompt=history_prompt,
    )

    qa_prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an enterprise AI assistant. Answer using the context below:\n\n{context}"),
        MessagesPlaceholder("chat_history"),
        ("human", "{input}"),
    ])
    document_chain = create_stuff_documents_chain(
        llm=llm,
        prompt=qa_prompt,
    )

    pipeline = create_retrieval_chain(
        retriever=history_retriever,
        combine_docs_chain=document_chain,
    )
    return pipeline

seed_documents = [
    Document(
        page_content="Kubernetes pods run on nodes. Workloads are scheduled using deployments.",
        metadata={"source": "infra_guide.md", "page": 1},
    ),
    Document(
        page_content="PostgreSQL utilizes WAL files to guarantee data persistence during power outages.",
        metadata={"source": "db_manual.md", "page": 1},
    ),
]

embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
pg_vectorstore = PGVector(
    embeddings=embeddings_model,
    collection_name=COLLECTION_NAME,
    connection=DB_URI,
    use_jsonb=True,
)

ingest_enterprise_corpus(seed_documents, pg_vectorstore, RECORD_MGR_URI)

production_retriever = construct_hybrid_rerank_retriever(pg_vectorstore, seed_documents)
complete_chain = initialize_production_pipeline(production_retriever)

app = FastAPI(title="Production RAG Gateway", version="1.0.0")

class APIRequest(BaseModel):
    input: str = Field(description="Query to execute.")
    chat_history: list[dict[str, str]] = Field(default_factory=list, description="Message sequence.")

add_routes(
    app,
    complete_chain,
    path="/api/v1/rag",
    input_type=APIRequest,
)

```

---

## 7. Production Verification & Operational Matrix

| Architectural Vector         | Production Requirement               | LangChain Technical Standard | Verification Metric |
| ---------------------------- | ------------------------------------ | ---------------------------- | ------------------- |
| **Framework Versioning**<br> | Remove deprecated monolithic chains. |

 | Replace with `create_retrieval_chain` and `create_stuff_documents_chain`.

 | Zero calls to `RetrievalQA` or `ConversationalRetrievalChain` in the codebase.

 |
| **Data Synchronization**<br> | Prevent vector store bloat and redundant writes.

 | LangChain Indexing API with `SQLRecordManager` (`cleanup="incremental"`).

 | Document hash deduplication active across re-indexing runs.

 |
| **Retrieval Precision**<br> | Balance keyword matching and semantic similarity.

 | Hybrid `EnsembleRetriever` combined with Cross-Encoder reranking.

 | Exact terms match via BM25; candidates compressed to top $n \le 5$.

 |
| **State Type Safety**<br> | Prevent runtime serialization and schema errors.

 | Explicit typing via Pydantic, `TypedDict`, and `RunnableConfig`.

 | Clean static type checking across all pipeline boundaries.

 |
| **Reliability Control**<br> | Mitigate retrieval failure and model hallucination.

 | LangGraph Corrective RAG with query rewriting and evaluation loops.

 | Automated fallback routing executed on zero context.

 |
| **Observability**<br> | Full trace tracking and automated quality testing.

 | LangSmith distributed tracing and automated dataset evaluations.

 | Active trace IDs and regression test runs on evaluation datasets.

 |
| **Serving Layer**<br> | Support streaming responses and standard API contracts.

 | LangServe integration mounted on FastAPI.

 | SSE endpoints operational (`/stream` and `/stream_events`).

 |

