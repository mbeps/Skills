# references/memory-and-persistence.md

## 1. Architectural Separation: Thread Memory vs. Cross-Thread Memory

Production AI applications require two separate storage systems: thread-scoped execution memory and cross-thread long-term memory. Thread-scoped memory maintains state across iterative steps within a single execution run or user session. Cross-thread long-term memory persists user profiles, operational knowledge, and domain facts across independent execution boundaries and separate sessions.

LangGraph establishes an architectural boundary between these two storage models:

- **Checkpointers (`BaseCheckpointSaver`)**: Capture the complete execution state snapshot automatically at each superstep boundary. They govern session continuity, step rollback, execution pausing for human validation, error recovery, and time-travel debugging.
- **Stores (`BaseStore`)**: Provide a hierarchical, document-oriented key-value repository that operates outside graph state boundaries. Nodes access the store to read or write cross-session context, persistent user attributes, and semantic knowledge vectors.

| System Attribute        | Checkpointer Layer (`BaseCheckpointSaver`)                      | Store Layer (`BaseStore`)                                            |
| :---------------------- | :-------------------------------------------------------------- | :------------------------------------------------------------------- |
| **Storage Scope**       | Thread-scoped via `thread_id`.                                  | Namespace-scoped via string tuple (`tuple[str, ...]`).               |
| **Write Boundary**      | Automatic at every graph superstep boundary.                    | Explicit programmatic mutation (`put`, `aput`, `delete`).            |
| **Primary Function**    | Thread continuity, step rollback, and execution suspension.     | Long-term user memory, global facts, and profile retrieval.          |
| **Production Drivers**  | `AsyncPostgresSaver`, `PostgresSaver`, `RedisSaver`.            | `AsyncPostgresStore`, `PostgresStore`, `InMemoryStore`.              |
| **Search Capabilities** | Primary key lookup using `thread_id` and `checkpoint_id`.       | Structured filtering, prefix matching, and vector similarity search. |
| **Schema Contract**     | Strict schema definition (`TypedDict` or Pydantic `BaseModel`). | Unstructured JSON documents (`dict[str, Any]`).                      |

Binary deserialization of checkpoint payloads poses an operational security hazard when unverified objects are loaded. Production environments must set the environment variable `LANGGRAPH_STRICT_MSGPACK=true` or configure the checkpointer with `allowed_msgpack_modules`. This restricts unpacking to safe primitive types and protects against remote code execution if underlying storage is modified.

---

## 2. Short-Term Context Management & Token Trimming

Unconstrained message histories lead to context window overflow, elevated inference latency, and runaway token costs. Systems must decouple persistent storage from prompt assembly by applying functional context manipulation utilities directly before model execution.

### 2.1 Message Abstractions & Structural Typing

Conversational states inherit from the abstract `BaseMessage` class:
- `SystemMessage`: Establishes runtime behavioral instructions and systemic boundaries; models require this at index zero.
- `HumanMessage`: Encapsulates user requests coming from client runtimes.
- `AIMessage`: Contains model responses, execution metrics in `usage_metadata`, and tool invocations in `tool_calls`.
- `ToolMessage`: Returns tool execution payloads and must contain a matching `tool_call_id` from the preceding `AIMessage`.
- `RemoveMessage`: Deletes a targeted message from persistent state by identifier when processed by the `add_messages` reducer.

> **Structural Pairing Invariant**: Tool calls and their corresponding responses must never be separated. An `AIMessage` containing a `tool_calls` payload must remain paired with its downstream `ToolMessage` instances. Discarding a `ToolMessage` while retaining the calling `AIMessage` causes API protocol rejections from downstream inference providers.

### 2.2 Token Trimming with `trim_messages`

The `trim_messages` function reduces message lists to satisfy token budget limits prior to inference without modifying historical checkpoint records.

```python
from collections.abc import Callable
from langchain_core.messages import BaseMessage, trim_messages

def approximate_token_counter(messages: list[BaseMessage]) -> int:
    """Calculate approximate token counts across text contents."""
    return sum(len(str(msg.content).split()) for msg in messages)

def prepare_bounded_context(
    messages: list[BaseMessage],
    max_tokens: int = 2000,
    counter: Callable[[list[BaseMessage]], int] = approximate_token_counter,
) -> list[BaseMessage]:
    """Trim conversational turns to fit within a strict token ceiling."""
    return trim_messages(
        messages,
        max_tokens=max_tokens,
        token_counter=counter,
        strategy="last",        # Preserves the newest dialogue turns
        start_on="human",       # Avoids orphan AI/tool turns that models reject
        include_system=True,    # Retains SystemMessage instructions at index 0
        allow_partial=False,    # Prevents message strings from splitting
    )

```

### 2.3 Context Eviction Comparison Matrix

| Context Eviction Strategy                | State Storage Impact                               | Token Optimization Mechanism | Primary Production Application |
| ---------------------------------------- | -------------------------------------------------- | ---------------------------- | ------------------------------ |
| **Window Slicing (`trim_messages`)**<br> | Unmodified: Full history preserved in checkpoints. |

 | Drops older turns from LLM context payload on each run.

 | Systems requiring an immutable audit trail with predictable inference costs.

 |
| **Permanent Pruning (`RemoveMessage`)**<br> | Direct Mutation: Permanently deletes state records.

 | Keeps total message count bounded across turns.

 | Privacy-sensitive flows or bounded state storage budgets.

 |
| **Rolling Summarization**<br> | State Compaction: Stores a summary string and drops old messages.

 | Replaces historical message tokens with a compact summary.

 | Long sessions that must preserve high-level context over many turns.

 |

### 2.4 Progressive Summarization and History Deletion Node

When interaction histories grow extensively, rolling summarization nodes condense older exchanges into a narrative summary, update `state["summary"]`, and prune compressed turns from state using `RemoveMessage`.

```python
from typing import Annotated, Any
from typing_extensions import TypedDict
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, RemoveMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

class ConversationSummaryState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    summary: str

async def manage_conversation_summary(
    state: ConversationSummaryState,
    model: BaseChatModel,
) -> dict[str, Any]:
    """Compress older conversation turns into a progressive summary."""
    messages = state["messages"]
    current_summary = state.get("summary", "")

    # Trigger summarization only when uncompressed turns exceed threshold
    if len(messages) <= 6:
        return {}

    # Preserve recent exchanges; compress the older messages
    messages_to_compress = messages[:-4]

    prompt = (
        f"Current summary:\n{current_summary}\n\n"
        "Extend the summary to incorporate the following new turns:\n"
    )
    for msg in messages_to_compress:
        prompt += f"{msg.type}: {msg.content}\n"

    response = await model.ainvoke([HumanMessage(content=prompt)])
    new_summary = str(response.content)

    # Issue tombstones to remove compressed messages from persistent graph state
    prune_ops = [RemoveMessage(id=str(msg.id)) for msg in messages_to_compress if msg.id]

    return {
        "summary": new_summary,
        "messages": prune_ops,
    }

```

---

## 3. Database-Backed Checkpointers (PostgreSQL)

Checkpointers write graph state snapshots to a database backend when every scheduled node in a superstep finishes execution. `AsyncPostgresSaver` handles high-throughput asynchronous workloads using pooled connections.

### 3.1 Relational Schema Architecture

The `langgraph-checkpoint-postgres` engine distributes state across relational tables:

* `checkpoints`: Stores execution snapshot metadata, including `thread_id`, `checkpoint_ns`, `checkpoint_id`, and `parent_checkpoint_id`.


* `checkpoint_blobs`: Stores serialized channel values, message arrays, and nested structures.


* `checkpoint_writes`: Buffers intermediate task outputs and channel write actions prior to superstep consolidation.


* `checkpoint_migrations`: Tracks database schema versions and migration status across updates.



> **Integrity Rule**: Never manually delete or alter rows inside `checkpoint_writes` or clear subgraph namespaces while parent threads remain active. Removing intermediate writes corrupts lineage tracking and breaks resumption workflows.
> 
> 

### 3.2 Asynchronous Checkpoint Setup & Execution

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

class PersistentThreadState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    session_metadata: dict[str, str]

async def agent_execution_node(state: PersistentThreadState) -> dict[str, list[BaseMessage]]:
    latest_input = str(state["messages"][-1].content)
    output_text = f"Synthesized response for: {latest_input}"
    return {"messages": [AIMessage(content=output_text)]}

@asynccontextmanager
async def init_postgres_saver(
    database_uri: str,
) -> AsyncIterator[AsyncPostgresSaver]:
    """Initialize connection pool and run table migrations."""
    connection_pool = AsyncConnectionPool(
        conninfo=database_uri,
        min_size=5,
        max_size=20,
        kwargs={"autocommit": True, "row_factory": dict_row},  # Invariant configuration
    )
    async with connection_pool:
        checkpointer = AsyncPostgresSaver(connection_pool)
        # Apply database tables and indexes on initial startup
        await checkpointer.setup()
        yield checkpointer

async def execute_session_turn(
    saver: AsyncPostgresSaver,
    thread_id: str,
    user_prompt: str,
) -> PersistentThreadState:
    """Execute a persistent graph turn under a specific thread identifier."""
    workflow = StateGraph(PersistentThreadState)
    workflow.add_node("agent", agent_execution_node)
    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", END)

    app = workflow.compile(checkpointer=saver)

    config = {"configurable": {"thread_id": thread_id}}
    payload = {"messages": [HumanMessage(content=user_prompt)]}

    return await app.ainvoke(payload, config=config)

```

---

## 4. Cross-Thread Semantic Memory via `BaseStore`

When information must persist beyond a single thread, storing it inside the graph state causes context isolation. The `BaseStore` interface decouples user preferences, entity knowledge, and cross-session memory from individual thread lifecycles.

### 4.1 Hierarchical Namespaces

Stores organize documents under hierarchical string tuple namespaces:

* Tenant-user profile: `("tenants", tenant_id, "users", user_id)`

* Global system policy: `("global_knowledge", "compliance")`


Core operations include:

* `aput(namespace, key, value)`: Stores a JSON document under the target namespace and key.


* `aget(namespace, key)`: Retrieves a single document by its exact namespace and key.


* `asearch(namespace_prefix, query=..., filter=..., limit=...)`: Runs vector similarity or structured attribute searches across a namespace subtree.


* `alist_namespaces(prefix=...)`: Discovers namespaces matching a specific root hierarchy.



### 4.2 Semantic Memory Graph with `AsyncPostgresStore`

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Annotated, Any
from typing_extensions import TypedDict
from langchain_core.embeddings import Embeddings
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.runtime import Runtime
from langgraph.store.base import BaseStore
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    user_id: str

class MemoryAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

async def query_memory_node(
    state: MemoryAgentState,
    runtime: Runtime[RequestContext],
) -> dict[str, list[BaseMessage]]:
    """Retrieve long-term facts using vector search over store namespaces."""
    store: BaseStore = runtime.store
    context: RequestContext = runtime.context
    namespace = ("tenants", context.tenant_id, context.user_id)

    user_query = str(state["messages"][-1].content)
    search_hits = await store.asearch(namespace, query=user_query, limit=2)

    extracted_facts = [str(hit.value.get("text", "")) for hit in search_hits]
    memory_context = "; ".join(extracted_facts)

    return {
        "messages": [
            AIMessage(content=f"Context fetched: [{memory_context}]. Generating output.")
        ]
    }

async def write_memory_node(
    state: MemoryAgentState,
    runtime: Runtime[RequestContext],
) -> dict[str, Any]:
    """Persist extracted user preference documents into long-term store."""
    store: BaseStore = runtime.store
    context: RequestContext = runtime.context
    last_user_input = str(state["messages"][-1].content)

    if "save preference:" in last_user_input.lower():
        cleaned_fact = last_user_input.split("save preference:", 1)[-1].strip()
        namespace = ("tenants", context.tenant_id, context.user_id)
        await store.aput(
            namespace=namespace,
            key="ui_language",
            value={"text": cleaned_fact, "domain": "preferences"},
        )
    return {}

@asynccontextmanager
async def build_storage_subsystem(
    database_url: str,
    embedding_service: Embeddings,
) -> AsyncIterator[tuple[AsyncPostgresSaver, AsyncPostgresStore]]:
    """Provision unified connection pool for checkpointer and semantic store."""
    pool = AsyncConnectionPool(
        conninfo=database_url,
        min_size=5,
        max_size=20,
        kwargs={"autocommit": True, "row_factory": dict_row},
    )
    async with pool:
        checkpointer = AsyncPostgresSaver(pool)
        store = AsyncPostgresStore(
            pool,
            index={
                "dims": 1536,
                "embed": embedding_service,
                "fields": ["text"],
            },
        )
        await checkpointer.setup()
        await store.setup()
        yield checkpointer, store

```

---

## 5. Human-in-the-Loop, Resumption & Time Travel

Persistent checkpointers allow workflows to suspend execution, inspect internal state, fork execution trajectories, and resume without loss of context.

### 5.1 Dynamic Interrupt & Resumption Pattern

Human-in-the-loop governance uses dynamic `interrupt()` calls from `langgraph.types`:

* Calling `interrupt(payload)` halts execution, serializes current state to the checkpointer, and surfaces the interrupt payload to the caller under the `__interrupt__` key.


* Resuming with `Command(resume=value)` restarts execution from the beginning of the interrupted node, where `interrupt(...)` evaluates directly to the provided resume value.



> **Idempotency Rule**: When execution resumes, the engine restarts the interrupted node from its first line. Any non-idempotent operations placed before `interrupt()` will execute again.
> 
> 

### 5.2 Time-Travel Inspection & State Forking

* **State Inspection**: `graph.get_state(config)` / `aget_state(config)` returns the latest `StateSnapshot` for a given thread.


* **Trajectory Traversal**: `graph.get_state_history(config)` / `aget_state_history(config)` yields historical `StateSnapshot` instances in reverse-chronological order.


* **State Forking**: `graph.update_state(config, values, as_node="...")` applies state updates to an earlier checkpoint, creating a new execution branch without mutating historical records.



```python
from typing import Any
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command

async def resume_interrupted_run(
    compiled_app: CompiledStateGraph,
    thread_id: str,
    approved: bool,
) -> dict[str, Any]:
    """Resume a pending interrupted graph execution."""
    config = {"configurable": {"thread_id": thread_id}}
    state_snapshot = await compiled_app.aget_state(config)

    if not state_snapshot.next:
        raise RuntimeError(f"Thread {thread_id} has no pending interruptions.")

    return await compiled_app.ainvoke(Command(resume=approved), config=config)

async def fork_state_history(
    compiled_app: CompiledStateGraph,
    thread_id: str,
    target_node_name: str,
    modified_data: dict[str, Any],
) -> dict[str, Any]:
    """Fork execution from a historical checkpoint prior to a specific node run."""
    config = {"configurable": {"thread_id": thread_id}}

    history = [snapshot async for snapshot in compiled_app.aget_state_history(config)]
    target_snapshot = next(
        (snap for snap in history if snap.next == (target_node_name,)),
        None,
    )
    if target_snapshot is None:
        raise ValueError(f"No checkpoint found prior to node '{target_node_name}'.")

    # Fork new checkpoint off the historical state snapshot
    forked_config = await compiled_app.aupdate_state(
        config=target_snapshot.config,
        values=modified_data,
        as_node=target_node_name,
    )

    # Resume along the newly created execution branch
    return await compiled_app.ainvoke(None, config=forked_config)

```

---

## 6. Checkpoint Retention & Schema Evolution

Unmanaged checkpoint generation causes database bloat, increased query latency, and connection pool exhaustion. Production services must enforce automated pruning schedules and handle schema drift.

### 6.1 Pruning Implementations

* **TTL Expiration**: Supported natively in `RedisSaver` by assigning key Time-To-Live parameters during initialization.


* **Relational Batch Retention**: PostgreSQL checkpointer data should be purged using scheduled batch jobs that remove completed threads exceeding retention SLAs:



```sql
-- Scheduled cleanup job: Delete threads inactive for more than 30 days
WITH target_threads AS (
    SELECT thread_id
    FROM checkpoints
    GROUP BY thread_id
    HAVING MAX(created_at) < NOW() - INTERVAL '30 days'
)
DELETE FROM checkpoints
WHERE thread_id IN (SELECT thread_id FROM target_threads);

```

### 6.2 Schema Drift Management

When adding fields to state schemas (`TypedDict` or Pydantic models), provide fallback defaults and read attributes defensively to avoid deserialization failures on older checkpoints:

```python
# Safe read from possibly older checkpoint states
attribute_value: str = state.get("new_attribute", "default_fallback")

```

For major schema revisions that break backward compatibility, isolate runs using an updated version namespace or a dedicated `checkpoint_ns`. Existing threads can finish against the old schema while newly initialized sessions run on the updated definition.

---

## 7. Production Reliability & Migration Matrix

| Production Domain      | Deprecated Pre-0.3 Primitive | Modern Production Standard | Prevented Operational Failure Mode |
| ---------------------- | ---------------------------- | -------------------------- | ---------------------------------- |
| **Short-Term Context** | Unbounded message lists      |

 | `trim_messages` with `start_on="human"`<br> | Context overflow, elevated latency, runaway API costs.

 |
| **History Compaction** | `ConversationSummaryMemory`<br> | Dedicated summarization node with `RemoveMessage`<br> | Hidden synchronous API calls, unmanaged memory bloat.

 |
| **Thread Persistence** | In-memory global dictionaries

 | `AsyncPostgresSaver` with connection pooling

 | State loss across process restarts, multi-worker failures.

 |
| **Cross-Thread Memory** | Storing profile facts in graph state

 | `AsyncPostgresStore` with semantic vector indexing

 | Thread isolation, inability to share knowledge across sessions.

 |
| **Human Governance** | Polling database flags

 | `interrupt()` and `Command(resume=...)`<br> | Race conditions, state desynchronization upon resumption.

 |
| **Serialization Security** | Default binary pickle/msgpack unpacking

 | Set `LANGGRAPH_STRICT_MSGPACK=true`<br> | Remote code execution via untrusted checkpoint payload mutations.

 |
| **Trace Correlation** | Console stdout logging

 | Inject identical `thread_id` into configurable and metadata

 | Disconnected traces, missing multi-turn evaluation metrics in LangSmith.

 |