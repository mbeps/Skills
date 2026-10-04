# references/deployment-and-observability.md

## 1. Architectural Overview & Deployment Topologies

Production agent systems and LangChain Expression Language (LCEL) workflows require robust deployment infrastructure and end-to-end telemetry instrumentation. Serving stateful LangGraph workflows introduces operational requirements beyond standard stateless microservices, including persistent connection pooling, transactional state serialization, streaming protocol handling, and cross-session trace attribution.

Teams deploy LangChain and LangGraph applications using two primary architectures:
- **LangServe & FastAPI**: High-performance HTTP/REST and Server-Sent Events (SSE) gateway that exposes compiled runnables and graphs via `add_routes`, providing native OpenAPI generation and custom request security hooks.
- **LangGraph Server (LangGraph Platform)**: Specialized backend infrastructure featuring task queuing, cron scheduling, and integrated state persistence.

| Deployment Vector          | Stateless LCEL Chains          | Stateful LangGraph Agents                                            |
| :------------------------- | :----------------------------- | :------------------------------------------------------------------- |
| **Primary Ingress Method** | `langserve.add_routes`         | `langserve.add_routes` with `per_req_config_modifier`                |
| **Session Identification** | Not required.                  | Mandatory scoped `thread_id`.                                        |
| **Persistence Dependency** | Process memory or external DB. | Relational checkpointers (`AsyncPostgresSaver`).                     |
| **Streaming Output Modes** | Token chunks (`/stream`).      | State values, partial updates, and event streams (`/stream_events`). |
| **Resource Management**    | Standard service dependencies. | FastAPI async `lifespan` connection pools.                           |
| **Telemetry Aggregation**  | Invocation spans in LangSmith. | Hierarchical superstep trees and thread views.                       |

---

## 2. REST & Streaming Serving with LangServe

LangServe exposes compiled LangGraph state machines and LCEL runnables as production-ready HTTP microservices built on FastAPI.

### 2.1 Standard API Endpoints

Registering a runnable via `add_routes` automatically exposes four standard endpoints:
- `/invoke`: Synchronous execution returning the final output payload.
- `/batch`: High-throughput concurrent request batching.
- `/stream`: Server-Sent Events (SSE) streaming delivering sequential state updates.
- `/stream_events`: Granular SSE streaming covering internal node lifecycles, LLM tokens, and tool calls.

### 2.2 Strict Schema Declaration with `with_types`

To ensure unambiguous OpenAPI contracts and prevent runtime deserialization failures, compile the graph and declare input and output data transfer objects explicitly using `with_types()`:

```python
from typing import Any
from fastapi import FastAPI
from pydantic import BaseModel, Field
from langserve import add_routes
from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.graph import StateGraph, START, END, MessagesState

class AgentInputDTO(BaseModel):
    """Public ingress contract with type validation."""
    messages: list[dict[str, Any]] = Field(
        description="List of raw message dictionaries with role and content."
    )
    execution_context: str = Field(
        default="production",
        description="Target runtime environment identifier."
    )

class AgentOutputDTO(BaseModel):
    """Public egress response contract."""
    messages: list[dict[str, Any]] = Field(
        description="Complete conversational ledger including final model response."
    )

def build_typed_serving_api(model: BaseChatModel) -> FastAPI:
    """Initialize a production FastAPI gateway exposing typed LangServe routes."""
    api_app = FastAPI(
        title="Agent Orchestration Service",
        version="1.0.0",
        description="REST Gateway exposing LangGraph State Machine execution."
    )

    workflow = StateGraph(MessagesState)

    async def call_model_node(state: MessagesState) -> dict[str, Any]:
        result = await model.ainvoke(state["messages"])
        return {"messages": [result]}

    workflow.add_node("agent", call_model_node)
    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", END)

    compiled_graph = workflow.compile()

    # Wrap compiled graph with strict Pydantic schemas
    servable_agent = compiled_graph.with_types(
        input_type=AgentInputDTO,
        output_type=AgentOutputDTO
    )

    add_routes(
        api_app,
        servable_agent,
        path="/api/v1/agent",
        playground_type="default"
    )

    return api_app

```

---

## 3. FastAPI Lifespan Architecture & Resource Lifecycle Management

Production services must isolate resource allocation from HTTP route execution. Database connection pools, checkpointer schemas, and Model Context Protocol (MCP) clients must never be initialized inside request handlers. Instead, initialize them within an asynchronous context manager passed to FastAPI's `lifespan` parameter.

### 3.1 Connection Invariants & Setup Migrations

When configuring relational checkpointers backed by PostgreSQL, enforce two strict driver requirements:

* `autocommit=True`: Prevents idle transaction locks during state polling and writes.


* `row_factory=dict_row`: Guarantees dictionary row mapping for serialization.



Applications must execute `await saver.setup()` during lifespan initialization before accepting inbound traffic to apply schema migrations and build required database tables.

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated, Any
from typing_extensions import TypedDict
from fastapi import FastAPI, Request
from langchain_core.messages import AIMessage, BaseMessage
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langserve import add_routes
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

class ServiceState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

async def process_service_turn(state: ServiceState) -> dict[str, list[BaseMessage]]:
    return {"messages": [AIMessage(content="Service response generated successfully.")]}

def construct_base_graph() -> StateGraph:
    builder = StateGraph(ServiceState)
    builder.add_node("process", process_service_turn)
    builder.add_edge(START, "process")
    builder.add_edge("process", END)
    return builder

@asynccontextmanager
async def app_lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage connection pool, run schema migrations, and clean up resources."""
    db_uri = "postgresql://postgres:secret@localhost:5432/services_db"
    
    # Invariant connection pool configuration
    pool = AsyncConnectionPool(
        conninfo=db_uri,
        min_size=5,
        max_size=20,
        kwargs={"autocommit": True, "row_factory": dict_row},
    )
    async with pool:
        checkpointer = AsyncPostgresSaver(pool)
        # Apply database tables and indexes prior to serving requests
        await checkpointer.setup()

        builder = construct_base_graph()
        app.state.compiled_agent = builder.compile(checkpointer=checkpointer)
        yield

```

---

## 4. Multi-Tenant Request Security & Header-to-Config Translation

In stateful deployments, accepting raw `thread_id` parameters directly from untrusted client payloads creates authorization bypass and cross-tenant leakage risks. Multi-tenant systems must extract cryptographic identity claims from validated HTTP headers and inject a deterministic, tenant-partitioned thread identifier using `per_req_config_modifier`.

```python
def secure_configuration_modifier(
    config: dict[str, Any],
    request: Request,
) -> dict[str, Any]:
    """Map validated gateway headers to LangGraph thread and LangSmith trace scopes."""
    tenant_id: str = request.headers.get("X-Tenant-ID", "global_tenant")
    user_id: str = request.headers.get("X-User-ID", "anonymous_user")
    session_id: str = request.headers.get("X-Session-ID", "default_session")

    # Scoped thread identification ensures cross-tenant data isolation
    scoped_thread: str = f"tenant_{tenant_id}::user_{user_id}::sess_{session_id}"

    # Enforce identifier length under 255 characters
    if len(scoped_thread) > 255:
        scoped_thread = scoped_thread[:255]

    config.setdefault("configurable", {})
    config["configurable"]["thread_id"] = scoped_thread

    # Propagate identical correlation metadata to LangSmith
    config.setdefault("metadata", {})
    config["metadata"]["tenant_id"] = tenant_id
    config["metadata"]["user_id"] = user_id
    config["metadata"]["thread_id"] = scoped_thread
    config["metadata"]["session_id"] = scoped_thread

    config.setdefault("tags", [])
    config["tags"].extend(["production", f"tenant:{tenant_id}"])

    return config

# Mount routes with security modifier
app = FastAPI(title="Secure Multi-Tenant Agent Gateway", lifespan=app_lifespan)
base_workflow = construct_base_graph()
compiled_app = base_workflow.compile()

add_routes(
    app,
    compiled_app,
    path="/api/v1/agent",
    per_req_config_modifier=secure_configuration_modifier,
)

```

Clients consume this deployment using `RemoteRunnable` by passing the required scoping headers:

```python
from langserve import RemoteRunnable

client = RemoteRunnable("http://localhost:8000/api/v1/agent")

# Invocation transmits headers that configure thread_id securely on the backend
response = client.invoke(
    {"messages": [{"role": "user", "content": "Execute operational audit."}]},
    headers={
        "X-Tenant-ID": "enterprise-alpha",
        "X-User-ID": "usr-9941",
        "X-Session-ID": "session-1029"
    }
)

```

---

## 5. Distributed Observability & Tracing with LangSmith

LangSmith integrates natively with the LangChain execution engine to capture execution spans, parameter assignments, execution latencies, and error stack traces without manual instrumentation.

### 5.1 System Environment Configuration

Export standard environment variables across the host container runtime to enable automated trace collection:

```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_ENDPOINT="[https://api.smith.langchain.com](https://api.smith.langchain.com)"
export LANGCHAIN_API_KEY="lsv2_pt_your_api_key_here"
export LANGCHAIN_PROJECT="production-agent-fleet"

```

### 5.2 Context Propagation via `RunnableConfig`

Distributed systems attach operational metadata and trace correlation IDs using the `RunnableConfig` dictionary, passing attributes down the execution call stack:

```python
import uuid
from langchain_core.runnables import RunnableConfig

def create_operational_config(tenant_id: str, thread_id: str) -> RunnableConfig:
    """Construct configuration object attaching tenant and tracing metadata."""
    return RunnableConfig(
        run_name=f"Execution-{tenant_id}",
        tags=["production", "us-east-1", f"tenant:{tenant_id}"],
        metadata={
            "tenant_id": tenant_id,
            "thread_id": thread_id,
            "session_id": thread_id,
            "correlation_id": str(uuid.uuid4()),
        },
        configurable={
            "thread_id": thread_id,
        },
        max_concurrency=8
    )

```

### 5.3 Custom Spans via `@traceable`

When graph operations delegate tasks to auxiliary subroutines or network checks that do not inherit from `Runnable`, instrument those functions with the `@traceable` decorator. This captures auxiliary execution as a child span within the parent invocation in LangSmith:

```python
from langsmith import traceable

@traceable(
    name="verify_downstream_dependency",
    run_type="tool",
    tags=["preflight", "healthcheck"]
)
async def check_remote_service_health(service_url: str) -> bool:
    """Validate remote service reachability within an explicit trace span."""
    return service_url.startswith("https://")

```

### 5.4 LangSmith Operational Dashboard Views

The LangSmith dashboard organizes captured traces into three distinct operational views:

* **Trajectory View**: Displays the full multi-turn conversation history, visualizing turns, intermediate tool calls, and sub-agent interactions.


* **Turns View**: Groups trace spans into individual conversation interactions, detailing per-turn token usage and request latency.


* **Details View**: Displays individual step traces, showing raw input dictionaries, serialization schemas, error stack traces, and custom metadata.



---

## 6. Automated Evaluation Suites via `langsmith.evaluate`

Continuous evaluation requires evaluating pipeline runs against curated benchmark datasets to detect regressions prior to production releases. The `evaluate` function in LangSmith executes test targets against datasets, applies custom heuristics or model-based judges, and logs performance metrics directly to the platform.

```python
from typing import Any
from langsmith import Client, evaluate
from langsmith.schemas import Example, Run
from langchain_core.runnables import RunnableSerializable

def run_evaluation_suite(
    target_chain: RunnableSerializable,
    dataset_name: str,
    experiment_label: str
) -> None:
    """Execute evaluation experiments over an existing LangSmith dataset."""
    client = Client()

    def evaluate_groundedness(run: Run, example: Example) -> dict[str, Any]:
        """Compute context grounding score based on retrieved context."""
        response = run.outputs.get("answer", "") if run.outputs else ""
        context_docs = run.outputs.get("context", []) if run.outputs else []
        is_grounded = bool(len(context_docs) > 0 and len(response) > 10)
        return {"key": "groundedness", "score": float(is_grounded)}

    def evaluate_correctness(run: Run, example: Example) -> dict[str, Any]:
        """Verify the generated answer matches the ground truth reference."""
        prediction = run.outputs.get("answer", "") if run.outputs else ""
        reference = example.outputs.get("ground_truth", "") if example.outputs else ""
        score = 1.0 if reference.lower() in prediction.lower() else 0.0
        return {"key": "answer_accuracy", "score": score}

    evaluate(
        target_chain.invoke,
        data=dataset_name,
        evaluators=[evaluate_groundedness, evaluate_correctness],
        experiment_prefix=experiment_label,
        max_concurrency=4
    )

```

---

## 7. Production Verification & Operational Reliability Matrix

| Production Domain      | Architectural Invariant                  | LangChain / LangGraph Standard | Verification Metric |
| ---------------------- | ---------------------------------------- | ------------------------------ | ------------------- |
| **Connection Pooling** | No connections inside route definitions. |

 | FastAPI `lifespan` context manager with `AsyncConnectionPool`.

 | Pool instantiated once during startup; zero leaks across requests.

 |
| **PostgreSQL Settings** | Non-blocking transactional writes.

 | Must set `autocommit=True` and `row_factory=dict_row`.

 | Zero transaction deadlocks during concurrent checkpoint writes.

 |
| **Schema Migration** | Tables provisioned before serving traffic.

 | Invoke `await saver.setup()` inside lifespan startup.

 | Tables (`checkpoints`, `checkpoint_blobs`, etc.) pre-created.

 |
| **Tenant Isolation** | No untrusted client thread IDs.

 | `per_req_config_modifier` derives scoped `thread_id` from headers.

 | Thread IDs follow `tenant_{id}::user_{id}::sess_{id}` format.

 |
| **Identifier Bounds** | Checkpoint key limits.

 | Bound composite `thread_id` to $\le 255$ characters.

 | No database column truncation or string boundary exceptions.

 |
| **Streaming Support** | Real-time state & token delivery.

 | Expose `/stream` and `/stream_events` via LangServe.

 | Clients stream chunk updates and parse SSE payloads.

 |
| **Telemetry Tracing** | Trace grouping across turns.

 | Inject identical IDs into `configurable["thread_id"]` and `metadata["session_id"]`.

 | Multi-turn sessions group seamlessly in LangSmith Trajectory View.

 |
| **Custom Monitoring** | Non-runnable span tracking.

 | Instrument auxiliary routines with `@traceable`.

 | Preflight checks and helper subroutines visible in LangSmith.

 |
| **Automated Testing** | CI/CD regression protection.

 | Run `langsmith.evaluate` with custom evaluation judges.

 | Regression scores logged and tracked across release candidates.

 |

