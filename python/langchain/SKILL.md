---
name: langchain
description: Use when building, debugging, refactoring, or modernizing LLM applications and agentic architectures in Python using LangChain, LangGraph, LangSmith, or LangServe. Triggers on tasks involving custom tool definition, Model Context Protocol (MCP) integrations, conversational chat history trimming, state checkpointers, cross-thread semantic memory stores, conversational or agentic RAG pipelines, modular hierarchical subgraphs, FastAPI serving, or LangSmith evaluation.
---

# LangChain & LangGraph Development

## Overview

Modern LangChain development decouples declarative execution flow, state persistence, and external service contracts:
- **LangChain Core (`langchain-core`)**: Base message schemas, prompt templates, and LangChain Expression Language (LCEL) runnables.
- **LangGraph (`langgraph`)**: Deterministic cyclic state machines, multi-agent orchestration, thread checkpointers, and long-term key-value memory stores.
- **LangChain Community & Partners**: Vendor-specific chat models (`langchain-openai`, `langchain-anthropic`), vector databases (`langchain-postgres`), and protocol adapters.
- **LangServe & LangSmith**: Production HTTP serving via FastAPI and end-to-end distributed tracing/evaluation.

## Architecture & Migration Standards

Legacy monolithic chains are deprecated in favor of modular LCEL runnables and LangGraph state machines:

| Component Domain | Deprecated Abstraction (Pre-0.3) | Modern Standard (0.3+ / 2026) | Reference Guide |
| :--- | :--- | :--- | :--- |
| **Q&A Retrieval** | `langchain.chains.RetrievalQA` | `create_retrieval_chain` + `create_stuff_documents_chain` | `references/rag-architectures.md` |
| **Conversational RAG** | `ConversationalRetrievalChain` | `create_history_aware_retriever` + `create_retrieval_chain` | `references/rag-architectures.md` |
| **Document Stuffing** | `StuffDocumentsChain` | `langchain.chains.combine_documents.create_stuff_documents_chain` | `references/rag-architectures.md` |
| **Execution Chains** | `langchain.chains.LLMChain` | LCEL: `prompt \| model \| StrOutputParser()` | `references/rag-architectures.md` |
| **Conversation Memory** | `ConversationBufferMemory` | `trim_messages` + LangGraph Checkpointer (`PostgresSaver`) | `references/memory-and-persistence.md` |
| **MCP Client** | `MultiServerMCPClient` (`langchain-mcp-adapters`) | `langchain.mcp.MCPAdapter` (native FastMCP) | `references/tools-and-mcp.md` |
| **MCP Transports** | HTTP + SSE | Streamable HTTP (`http://`) and local stdio (`Path`) | `references/tools-and-mcp.md` |
| **Vector DB (Postgres)** | `langchain_community.vectorstores.PGVector` | `langchain_postgres.vectorstores.PGVector` | `references/rag-architectures.md` |
| **Text Splitters** | `langchain.text_splitter.*` | `langchain_text_splitters.*` | `references/rag-architectures.md` |

## Decision Flowchart: Architecture Selection

```text
User Request / Application Scenario
  │
  ├─► Is the flow linear, single-turn, or strict input-to-output?
  │     └─► Use LCEL (Pipe syntax: prompt | model | parser)
  │
  ├─► Is the task a single agent with tools and simple memory?
  │     └─► Use `create_agent` with `ToolRuntime` and `InMemorySaver` / checkpointer
  │
  ├─► Does the task require cycles, conditional branching, human approval, or state recovery?
  │     └─► Use LangGraph `StateGraph` with explicit state schemas and reducers
  │
  ├─► Does context exceed token limits across multi-turn sessions?
  │     ├─► In-thread trimming: Apply `trim_messages(strategy="last", start_on="human")`
  │     ├─► In-thread compression: Use a running summarization node with `RemoveMessage`
  │     └─► Cross-thread recall: Use `AsyncPostgresStore` with semantic vector search (`asearch`)
  │
  └─► Does the architecture divide into complex sub-domains (e.g., research team + supervisor)?
        └─► Use Hierarchical Subgraphs with isolated state schemas and boundary adapter nodes

```

## Quick Reference Index

All deep reference manuals are located one level deep in `references/`:

* **Tool & MCP Implementations**: See [`references/tools-and-mcp.md`](https://www.google.com/search?q=references/tools-and-mcp.md)
* Covers `@tool` with Pydantic `args_schema`, `BaseTool` subclassing with `PrivateAttr`, `ToolRuntime`, `response_format="content_and_artifact"`, `MCPAdapter` setup, and `ToolNode.with_fallbacks`.




* **Context, Memory & Persistence**: See [`references/memory-and-persistence.md`](https://www.google.com/search?q=references/memory-and-persistence.md)
* Covers token-bounded `trim_messages`, `filter_messages`, running summarization with `RemoveMessage`, `AsyncPostgresSaver` connection pooling, cross-thread `AsyncPostgresStore` semantic indexing, and `interrupt()` / `Command(resume=...)` human-in-the-loop workflows.




* **RAG & Retrieval Systems**: See [`references/rag-architectures.md`](https://www.google.com/search?q=references/rag-architectures.md)
* Covers `SQLRecordManager` deduplication indexing, hybrid `EnsembleRetriever` with `CrossEncoderReranker`, conversational query contextualization, Corrective RAG (`CRAG`) control loops, and `langsmith.evaluate` validation.




* **Subgraphs & Orchestration**: See [`references/subgraphs-and-orchestration.md`](https://www.google.com/search?q=references/subgraphs-and-orchestration.md)
* Covers pure reducers (`append_unique_identifiers`, `merge_telemetry_records`), child worker subgraphs, parent director orchestration, and boundary mapping nodes.




* **Serving & Observability**: See [`references/deployment-and-observability.md`](https://www.google.com/search?q=references/deployment-and-observability.md)
* Covers FastAPI async lifespan management, mounting graphs via `langserve.add_routes`, typed request schemas via `app.with_types()`, and LangSmith distributed tracing.

## Core Implementation Pattern: Resilient ReAct Agent

Below is the standard, production-grade ReAct pattern using modern LangGraph, type annotations, tool error boundaries, and thread checkpointing:

```python
from typing import Annotated, Literal, Sequence
from typing_extensions import TypedDict
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool, ToolException
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

# 1. State Schema with message append reducer
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    execution_context: str

# 2. Tool Definition with type safety and error boundary
@tool
def execute_system_query(query: str) -> str:
    """Execute search query against internal records."""
    if not query.strip():
        raise ToolException("Empty queries are rejected.")
    return f"Query '{query}' resolved successfully."

tools = [execute_system_query]

# 3. Model initialization and tool binding
model = ChatOpenAI(model="gpt-4o", temperature=0.0).bind_tools(tools)

def agent_node(state: AgentState) -> dict[str, list[AIMessage]]:
    """Generate model predictions over current message history."""
    response = model.invoke(state["messages"])
    return {"messages": [response]}

# 4. Graph Construction with prebuilt ToolNode error handling
workflow = StateGraph(AgentState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", ToolNode(tools=tools, handle_tool_errors=True))

workflow.add_edge(START, "agent")
workflow.add_conditional_edges(
    "agent",
    tools_condition,
    {"tools": "tools", END: END}
)
workflow.add_edge("tools", "agent")

# 5. Compilation with thread persistence checkpointer
checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)

```

## Common Anti-Patterns & Critical Pitfalls

### 1. Using Deprecated Monolithic Chains

* ❌ **Anti-Pattern**: Instantiating `RetrievalQA.from_chain_type(...)` or `ConversationalRetrievalChain.from_llm(...)`. These obscure prompts, mishandle streaming, and prevent fine-grained retrieval debugging.


* ✅ **Correction**: Compose modern LCEL runnables using `create_history_aware_retriever`, `create_stuff_documents_chain`, and `create_retrieval_chain`.



### 2. Naive Vector Retrieval Without Deduplication or Reranking

* ❌ **Anti-Pattern**: Re-indexing entire collections unconditionally and feeding top-k vector distances directly into context. Causes database bloat, token wastage, and hallucinated answers.
* ✅ **Correction**: Use `SQLRecordManager` with `index(cleanup="incremental")`. Retrieve an expanded set ($k \ge 20$) via `EnsembleRetriever` and compress to top-$n \le 5$ with `CrossEncoderReranker`.
### 3. In-Place State Mutation in LangGraph Nodes
* ❌ **Anti-Pattern**: Modifying incoming state collections directly (e.g. `state["messages"].append(new_msg)` or `state["data"]["key"] = val`). Breaks checkpoint serialization and prevents time-travel recovery.
* ✅ **Correction**: Return fresh state delta dictionaries (e.g., `return {"messages": [new_msg]}`) and define pure reducer functions using `operator.add` or custom reducer wrappers.

### 4. Unhandled Tool and Remote Protocol Exceptions

* ❌ **Anti-Pattern**: Allowing remote MCP failures, timeouts, or invalid model arguments to throw raw exceptions out of nodes, crashing the workflow.


* ✅ **Correction**: Set `handle_tool_errors=True` on `ToolNode` or attach fallback handlers via `ToolNode.with_fallbacks([handle_transport_error], exception_key="error")` to return actionable `ToolMessage(status="error")` payloads back to the model.



### 5. Unbounded Message History

* ❌ **Anti-Pattern**: Passing entire raw conversation histories to LLMs on every turn until hitting context length errors.


* ✅ **Correction**: Apply `trim_messages(max_tokens=..., strategy="last", start_on="human", include_system=True)` right before model invocation, or implement a summarization node with `RemoveMessage`.

---

The root manifest and `SKILL.md` are established. Whenever you are ready, specify which reference file you would like to generate next:
1. `references/tools-and-mcp.md`
2. `references/memory-and-persistence.md`
3. `references/rag-architectures.md`
4. `references/subgraphs-and-orchestration.md`
5. `references/deployment-and-observability.md`