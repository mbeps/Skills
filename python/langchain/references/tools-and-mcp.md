# references/tools-and-mcp.md

## 1. Architectural Standards & Migration Overview

Modern LangChain architectures separate deterministic local tool execution from distributed Model Context Protocol (MCP) tool integration. Legacy tool implementations relied on untyped dictionaries, unstructured error strings, and monolithic wrappers. Modern systems enforce strict typing via Pydantic v2 `BaseModel` classes, runtime parameter injection, dual-channel artifact decoupling, and native FastMCP protocol adapters.

The `langchain.mcp` module replaces the legacy standalone `langchain-mcp-adapters` package. The unified `MCPAdapter` class replaces deprecated client constructs such as `MultiServerMCPClient`. In addition, the Model Context Protocol specification deprecates Server-Sent Events (HTTP+SSE) for network communication in favor of Streamable HTTP transports.

| Feature / Capability        | Legacy Architecture (`langchain-mcp-adapters`)      | Current Specification (`langchain.mcp` ≥ 1.4.0)        |
| :-------------------------- | :-------------------------------------------------- | :----------------------------------------------------- |
| **Namespace Location**      | `langchain_mcp_adapters.client`                     | `langchain.mcp`                                        |
| **Primary Client Class**    | `MultiServerMCPClient`                              | `MCPAdapter`                                           |
| **Tool Discovery API**      | `await client.get_tools()`                          | `await adapter.list_tools()`                           |
| **Tool Conversion API**     | `convert_mcp_tool_to_langchain_tool`                | `await as_langchain_tool(tool, client)`                |
| **Transport Specification** | Explicit transport string keys (`"stdio"`, `"sse"`) | Inferred targets (`Path`, `URL`, or `mcpServers` dict) |
| **Network Protocol**        | Persistent HTTP with SSE                            | Streamable HTTP (`http://`, `https://`)                |
| **Local Protocol**          | Direct child process management                     | Standard input/output (`stdio`) pipes                  |
| **Call Interception**       | `ToolCallInterceptor` protocol                      | `@wrap_tool_call` middleware                           |
| **User Elicitation**        | `Callbacks(on_elicitation=...)`                     | LangGraph `interrupt()` and `Command(resume=...)`      |
| **Structured Output**       | Unvalidated dictionary payloads                     | `MCPToolArtifact` TypedDict structure                  |

---

## 2. Custom Tool Authoring Patterns

A valid LangChain tool requires four components: a unique identifier, an unambiguous system description, an argument validation schema, and an execution callable. Tool identifiers must use lower `snake_case` characters with no spaces or special symbols.

### 2.1 The `@tool` Decorator Pattern

The `@tool` decorator converts standard Python functions into `StructuredTool` instances. Production implementations specify an explicit Pydantic `BaseModel` via `args_schema` or enable `parse_docstring=True` to guarantee that field descriptions propagate to the language model.

```python
from typing import Literal
from pydantic import BaseModel, Field
from langchain_core.tools import tool

class SystemMetricInput(BaseModel):
    """Schema for node telemetry lookup."""
    node_id: str = Field(
        description="The unique alphanumeric identifier of the target compute node."
    )
    metric_type: Literal["cpu", "memory", "disk_io", "network"] = Field(
        description="The performance dimension to measure."
    )
    window_seconds: int = Field(
        default=300,
        ge=60,
        le=3600,
        description="Aggregation window in seconds. Allowed range: 60 to 3600."
    )

@tool("query_node_telemetry", args_schema=SystemMetricInput, return_direct=False)
def query_node_telemetry(
    node_id: str,
    metric_type: Literal["cpu", "memory", "disk_io", "network"],
    window_seconds: int = 300,
) -> str:
    """Extract telemetry data for a designated compute node across a time window."""
    # Deterministic telemetry collection logic
    utilization_percentage: float = 42.8
    return (
        f"Node {node_id} reported {metric_type} utilization at "
        f"{utilization_percentage}% over the past {window_seconds} seconds."
    )

@tool(parse_docstring=True)
def calculate_network_throughput(
    interface: str,
    bytes_transferred: int,
    duration_seconds: float,
) -> float:
    """Calculate network throughput in megabits per second.

    Args:
        interface: Network interface name, such as eth0 or wlan0.
        bytes_transferred: Total bytes transferred during the period.
        duration_seconds: Sample period duration in seconds.
    """
    bits_transferred = bytes_transferred * 8
    megabits = bits_transferred / (1024 * 1024)
    return round(megabits / duration_seconds, 4)

```

### 2.2 Dynamic Wrapping via `StructuredTool.from_function`

When wrapping dynamic functions or external third-party libraries, use `StructuredTool.from_function`. This factory allows separate configuration of synchronous (`func`) and asynchronous (`coroutine`) callables.

> **Critical Schema Warning**: You must supply an explicit `args_schema` when using `StructuredTool.from_function`. When wrapped functions contain a parameter named `args`, omitting an explicit schema triggers internal Pydantic compatibility sentinel fields, creating invalid schema entries that model providers reject.
> 
> 

```python
import asyncio
from typing import Literal
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

class StorageProvisionInput(BaseModel):
    volume_name: str = Field(description="Unique name for the persistent volume.")
    size_gib: int = Field(gt=0, description="Volume size in GiB. Must be greater than 0.")
    redundancy_level: Literal["standard", "high"] = Field(
        default="standard",
        description="Storage replication profile."
    )

def provision_volume_sync(
    volume_name: str,
    size_gib: int,
    redundancy_level: str = "standard"
) -> str:
    return f"Volume '{volume_name}' provisioned with capacity {size_gib} GiB ({redundancy_level})."

async def provision_volume_async(
    volume_name: str,
    size_gib: int,
    redundancy_level: str = "standard"
) -> str:
    await asyncio.sleep(0.05)
    return f"Volume '{volume_name}' provisioned asynchronously with capacity {size_gib} GiB ({redundancy_level})."

storage_tool = StructuredTool.from_function(
    func=provision_volume_sync,
    coroutine=provision_volume_async,
    name="provision_persistent_volume",
    description="Provisions a network storage volume according to specified resource limits.",
    args_schema=StorageProvisionInput,
)

```

### 2.3 Subclassing `BaseTool`

Subclassing `BaseTool` provides explicit control over internal state, connection pools, and lifecycle methods. Because `BaseTool` inherits from Pydantic `BaseModel`, declare private state fields using `PrivateAttr` or initialize them inside class initialization routines.

```python
from typing import Optional, Type
from pydantic import BaseModel, Field, PrivateAttr
from langchain_core.tools import BaseTool

class CacheLookupInput(BaseModel):
    key: str = Field(description="The primary key to look up in the key-value store.")

class FastCacheTool(BaseTool):
    name: str = "fast_cache_lookup"
    description: str = "Executes an internal key-value cache lookup."
    args_schema: Type[BaseModel] = CacheLookupInput
    return_direct: bool = False

    _store: dict[str, str] = PrivateAttr(default_factory=dict)

    def __init__(self, initial_data: Optional[dict[str, str]] = None, **kwargs):
        super().__init__(**kwargs)
        if initial_data:
            self._store.update(initial_data)

    def _run(self, key: str) -> str:
        """Execute synchronous cache retrieval."""
        return self._store.get(key, f"Key '{key}' not found in cache.")

    async def _arun(self, key: str) -> str:
        """Execute asynchronous cache retrieval."""
        return self._run(key)

```

---

## 3. Advanced Execution & Parameter Injection Contracts

### 3.1 Dual-Channel Execution (`response_format="content_and_artifact"`)

Large binary payloads, raw DataFrames, authentication tokens, and detailed JSON logs should not enter the model context window. Inserting heavy payloads wastes token budgets and degrades reasoning performance.

Setting `response_format="content_and_artifact"` splits execution output into two channels:

* **Content**: A concise natural language summary assigned to `ToolMessage.content` for model inspection.


* **Artifact**: The uncompressed raw object assigned to `ToolMessage.artifact` for downstream graph nodes.



> **Contract Rule**: Functions configured with `response_format="content_and_artifact"` must return a two-element tuple: `(content: Any, artifact: Any)`. Returning a single value raises a runtime `ValueError`.
> 
> 

```python
from typing import Any, Tuple
from pydantic import BaseModel, Field
from langchain_core.tools import tool

class DataAnalysisInput(BaseModel):
    dataset_name: str = Field(description="Name of the analytical table to scan.")

@tool("analyze_dataset", args_schema=DataAnalysisInput, response_format="content_and_artifact")
def analyze_dataset(dataset_name: str) -> Tuple[str, dict[str, Any]]:
    """Generate statistical summaries for the given dataset."""
    raw_dataframe_payload: dict[str, Any] = {
        "dataset": dataset_name,
        "rows": 5_000_000,
        "features": ["id", "latency_ms", "status_code"],
        "p99_latency": 142.3,
        "error_rate": 0.0012,
        "raw_matrix": [[1, 20.1, 200], [2, 19.8, 200], [3, 142.3, 500]],
    }

    model_content: str = (
        f"Dataset '{dataset_name}' contains 5,000,000 rows. "
        f"P99 latency is 142.3ms, and error rate is 0.12%."
    )

    return model_content, raw_dataframe_payload

```

### 3.2 Runtime Parameter Injection Mechanics

System parameters (e.g., tenant IDs, database sessions, caller identities, graph state) must never be supplied by the LLM. LangChain provides four parameter injection annotations:

| Injection Marker      | Injection Source            | Model Visibility | Primary Purpose |
| --------------------- | --------------------------- | ---------------- | --------------- |
| `InjectedToolArg`<br> | Invocation payload or chain |

 | Hidden

 | Prevents model manipulation of trusted parameters.

 |
| `InjectedState`<br> | Active LangGraph State

 | Hidden

 | Reads state history or channel slices dynamically.

 |
| `InjectedStore`<br> | Persistent `BaseStore`<br> | Hidden

 | Reads/writes persistent memory across threads.

 |
| `ToolRuntime`<br> | Unified runtime container

 | Hidden

 | Accesses state, context, store, and config via one object.

 |

```python
from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.messages import BaseMessage
from langchain_core.tools import tool, InjectedToolArg
from langgraph.prebuilt import InjectedState, InjectedStore
from langgraph.store.base import BaseStore
from langchain.tools import ToolRuntime

# Pattern A: InjectedToolArg
class LedgerCommitInput(BaseModel):
    change_summary: str = Field(description="Summary of ledger updates.")
    operator_id: Annotated[str, InjectedToolArg]

@tool("commit_ledger", args_schema=LedgerCommitInput)
def commit_ledger(change_summary: str, operator_id: str) -> str:
    """Commit verified ledger transactions."""
    return f"Ledger update '{change_summary}' committed by operator '{operator_id}'."

# Pattern B: InjectedState and InjectedStore
@tool
def record_audit_event(
    event_label: str,
    messages: Annotated[list[BaseMessage], InjectedState("messages")],
    store: Annotated[BaseStore, InjectedStore],
) -> str:
    """Record an audit trail entry directly into long-term store."""
    history_depth = len(messages)
    store.put(
        namespace=("audit", "events"),
        key=event_label,
        value={"depth_at_call": history_depth, "status": "recorded"}
    )
    return f"Event '{event_label}' recorded with history depth {history_depth}."

# Pattern C: ToolRuntime Context Container
@tool
def read_tenant_settings(pref_key: str, runtime: ToolRuntime) -> str:
    """Read tenant configuration using runtime context."""
    tenant_id = getattr(runtime.context, "tenant_id", "default_tenant")
    store_record = runtime.store.get(namespace=(tenant_id, "settings"), key=pref_key)
    step_count = len(runtime.state.get("messages", []))
    value = store_record.value if store_record else "unset"
    return f"Tenant '{tenant_id}' (Step {step_count}) -> {pref_key}: {value}"

```

> **Framework Reserved Parameters**: The parameter names `config` and `runtime` are reserved across all LangChain tools. Never define custom business arguments using these names.
> 
> 

---

## 4. Model Context Protocol (MCP) Integration

The `langchain.mcp` module integrates external FastMCP servers into LangChain and LangGraph workflows. The `MCPAdapter` infers the transport mode from the input target:

* `pathlib.Path`: Executes a local `stdio` subprocess pipe.


* `http://` or `https://`: Connects using Streamable HTTP transport.


* `dict` (`mcpServers`): Configures multi-server routing with automatic `{server}_{tool}` namespacing.



### 4.1 Client Configuration & Transport Management

```python
import os
from pathlib import Path
from typing import Any
from fastmcp.client import Client
from fastmcp.client.transports import StreamableHttpTransport
from langchain.mcp import MCPAdapter
from langchain_core.tools import BaseTool

async def get_stdio_tools(script_relative_path: str) -> list[BaseTool]:
    """Execute local MCP server in managed child process via stdio."""
    server_path: Path = Path(script_relative_path).resolve()
    async with MCPAdapter(server_path) as adapter:
        return await adapter.list_tools()

async def get_streamable_http_tools(endpoint_url: str) -> list[BaseTool]:
    """Connect to remote MCP server via Streamable HTTP."""
    async with MCPAdapter(endpoint_url) as adapter:
        return await adapter.list_tools()

async def get_authenticated_http_tools(endpoint_url: str, token: str) -> list[BaseTool]:
    """Connect to authenticated Streamable HTTP MCP server."""
    transport = StreamableHttpTransport(
        url=endpoint_url,
        headers={"Authorization": f"Bearer {token}"}
    )
    client = Client(transport=transport)
    async with MCPAdapter(client) as adapter:
        return await adapter.list_tools()

async def get_multi_server_tools() -> list[BaseTool]:
    """Connect to multiple MCP servers with automatic name prefixing."""
    configuration: dict[str, Any] = {
        "mcpServers": {
            "filesystem": {
                "command": "python",
                "args": ["-m", "mcp_server_fs", "--root", "/var/data"]
            },
            "analytics": {
                "url": "[https://analytics.internal.net/mcp](https://analytics.internal.net/mcp)",
                "headers": {
                    "X-Api-Key": os.environ["ANALYTICS_KEY"]
                }
            }
        }
    }
    async with MCPAdapter(configuration) as adapter:
        # Tools will be named 'filesystem_read_file', 'analytics_run_report', etc.
        return await adapter.list_tools()

```

---

## 5. Resilience, Error Boundaries & Middleware

Uncaught tool exceptions crash agent workflows. Robust systems isolate failures using component error formatters, graph-level fallback nodes, and execution middleware.

### 5.1 Protocol Errors vs. Network Transport Errors

* **Protocol Execution Errors (`CallToolResult.isError == True`)**: Do not throw Python exceptions. The adapter converts the result to a `ToolMessage` with `status="error"`. The model inspects the error text and attempts self-correction in the subsequent turn.


* **Transport & Network Failures**: Disconnects, HTTP timeouts, and process terminations throw runtime exceptions (e.g., `httpx.HTTPError`, `RuntimeError`). The state graph must isolate these using fallback handlers on the `ToolNode`.



### 5.2 Component-Level Error Handling (`ToolException`)

```python
from langchain_core.tools import tool, ToolException

def format_migration_error(error: ToolException) -> str:
    """Format diagnostic message returned to the model."""
    return f"Migration halted: {error.args[0]}. Revise parameters and retry."

@tool(handle_tool_error=format_migration_error)
def execute_database_migration(target_version: int) -> str:
    """Execute schema migration to the requested schema version."""
    if target_version < 100:
        raise ToolException("Versions below 100 are deprecated and locked.")
    return f"Schema successfully updated to version {target_version}."

```

### 5.3 Global Middleware Interception via `@wrap_tool_call`

The `@wrap_tool_call` decorator replaces legacy `ToolCallInterceptor` classes. It intercepts invocations across all configured tools to enforce authorization, inject headers, redact sensitive artifacts, and implement circuit breaking.

```python
from collections.abc import Callable
from typing import Any
from langchain.agents.middleware import wrap_tool_call
from langchain.mcp import MCPToolArtifact
from langchain_core.messages import ToolMessage
from langgraph.prebuilt.tool_node import ToolCallRequest

@wrap_tool_call
def production_tool_middleware(
    request: ToolCallRequest,
    handler: Callable[[ToolCallRequest], ToolMessage]
) -> ToolMessage:
    """Intercept tool execution to inject tokens, handle errors, and sanitize artifacts."""
    # 1. Inject runtime authorization tokens into remote headers
    mcp_meta: dict[str, Any] | None = request.tool.metadata.get("mcp")
    if mcp_meta:
        runtime_context: dict[str, Any] = getattr(request, "runtime", {}) or {}
        user_token: str | None = runtime_context.get("auth_token")
        if user_token and hasattr(request, "headers"):
            request.headers["Authorization"] = f"Bearer {user_token}"
            request.headers["X-MCP-Server"] = mcp_meta.get("server_name", "unknown")

    # 2. Execute tool callable with circuit-breaking error boundaries
    try:
        result_message: ToolMessage = handler(request)
    except TimeoutError as ex:
        return ToolMessage(
            content=f"Upstream provider timed out: {str(ex)}. Reduce scope and retry.",
            tool_call_id=request.tool_call["id"],
            status="error"
        )
    except Exception as ex:
        return ToolMessage(
            content=f"Fatal tool failure: {str(ex)}. Verify parameters.",
            tool_call_id=request.tool_call["id"],
            status="error"
        )

    # 3. Sanitize sensitive fields from structured MCP artifacts
    if isinstance(result_message.artifact, dict) and "structured_content" in result_message.artifact:
        artifact: MCPToolArtifact = result_message.artifact
        content: dict[str, Any] = artifact["structured_content"]
        content.pop("session_secret", None)

    return result_message

```

---

## 6. Production LangGraph MCP Orchestration Pattern

The complete implementation below demonstrates an enterprise agent graph that connects to remote MCP servers, configures transport fallback boundaries, and handles human-in-the-loop elicitation via `interrupt()` and `Command(resume=...)`.

```python
from typing import Annotated, Any, Literal
from typing_extensions import TypedDict
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langchain.chat_models import init_chat_model
from langchain.mcp import MCPAdapter
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import Command, interrupt

class AgentState(TypedDict):
    """Execution state schema with an append reducer for messages."""
    messages: Annotated[list[BaseMessage], add_messages]
    tenant_id: str
    retry_count: int

def handle_transport_error(state: AgentState) -> dict[str, list[ToolMessage]]:
    """Generate fallback ToolMessages when network or transport failures occur."""
    last_message: BaseMessage = state["messages"][-1]
    tool_calls: list[dict[str, Any]] = getattr(last_message, "tool_calls", [])

    fallback_messages: list[ToolMessage] = []
    for call in tool_calls:
        fallback_messages.append(
            ToolMessage(
                content="Transport failure: The remote server did not respond. "
                        "Do not retry this call immediately.",
                name=call["name"],
                tool_call_id=call["id"],
                status="error"
            )
        )
    return {"messages": fallback_messages}

async def build_production_mcp_agent(adapter_target: str | dict[str, Any]):
    """Construct a resilient LangGraph agent backed by MCP tools and transport fallbacks."""
    model = init_chat_model("anthropic:claude-sonnet-5", temperature=0.0)

    # Discover and convert remote MCP tools
    async with MCPAdapter(adapter_target) as adapter:
        tools = await adapter.list_tools()

    bound_model = model.bind_tools(tools)

    async def call_model_node(
        state: AgentState,
        config: RunnableConfig
    ) -> dict[str, list[AIMessage]]:
        """Execute model inference with runtime telemetry config."""
        response: AIMessage = await bound_model.ainvoke(
            state["messages"],
            config=config
        )
        return {"messages": [response]}

    # Configure tool node with isolated transport fallbacks
    tool_node: ToolNode = ToolNode(tools).with_fallbacks(
        [handle_transport_error],
        exception_key="error"
    )

    def route_after_tools(state: AgentState) -> Literal["call_model", "__end__"]:
        """Inspect last message and determine workflow continuation."""
        last_message: BaseMessage = state["messages"][-1]
        if isinstance(last_message, ToolMessage) and last_message.status == "error":
            # Return to model to allow self-correction
            return "call_model"
        return "call_model"

    workflow = StateGraph(AgentState)
    workflow.add_node("call_model", call_model_node)
    workflow.add_node("tools", tool_node)

    workflow.add_edge(START, "call_model")
    workflow.add_conditional_edges(
        "call_model",
        tools_condition,
        {"tools": "tools", "__end__": END}
    )
    workflow.add_conditional_edges(
        "tools",
        route_after_tools,
        {"call_model": "call_model", "__end__": END}
    )

    checkpointer = MemorySaver()
    return workflow.compile(checkpointer=checkpointer)

```

---

## 7. Production Conventions, Failure Modes & Recovery Matrix

| Operational Failure Mode          | System Impact                                                    | Root Cause | Resolution Procedure |
| --------------------------------- | ---------------------------------------------------------------- | ---------- | -------------------- |
| **Tool Namespace Collisions**<br> | Multiple servers register identical tool names, failing startup. |

 | Multiple MCP servers export identical functions.

 | Configure `mcpServers` dict inside `MCPAdapter` to automatically prefix names as `{server}_{tool}`.

 |
| **Subprocess Leaks**<br> | Host server runs out of file descriptors and processes.

 | Stdio MCP child processes are not closed on error.

 | Run `MCPAdapter` inside an explicit `async with` context or a FastAPI `lifespan` handler.

 |
| **Network Disconnects & Timeouts**<br> | State machine halts abruptly with `httpx.HTTPError`.

 | Remote server drops socket or network times out.

 | Attach `.with_fallbacks([handle_transport_error])` to the `ToolNode`.

 |
| **Tool Execution Rejections**<br> | Tool parameters fail validation or throw application errors.

 | Invalid input arguments supplied by LLM.

 | Use default `status="error"` behavior to return error diagnostic text back to the model for self-correction.

 |
| **Context Window Overflow**<br> | LLM context window exceeded, terminating session.

 | Large JSON outputs or DataFrames sent directly to model.

 | Use `response_format="content_and_artifact"` or `@wrap_tool_call` to store raw data in `artifact` and return brief summaries.

 |
| **Expired Auth Tokens**<br> | Remote MCP HTTP requests fail with HTTP 401.

 | Long-running runs retain stale authorization headers.

 | Dynamically inject fresh tokens into `request.headers` via `@wrap_tool_call` using `runtime.context`.

 |
| **Reserved Name Collisions**<br> | Graph compilation or execution fails during validation.

 | Tool parameters named `config` or `runtime` declared in model schema.

 | Reserve `config` for `RunnableConfig` and `runtime` for `ToolRuntime`; never expose them in Pydantic schema fields.

 |

