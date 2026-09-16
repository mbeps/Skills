# Core Server Architecture & Setup

MCP v2 servers follow the 2026-07-28 Model Context Protocol specification: a stateless, request/response JSON-RPC architecture where every request carries its own context metadata inside `_meta`.

---

## 1. Server Instantiation

The primary server class in the Python SDK is `MCPServer` (from `mcp.server.mcpserver` or `mcp.server`):

```python
from mcp.server.mcpserver import MCPServer

mcp = MCPServer(
    name="System-Automations",
    version="1.0.0",
    description="System automation and diagnostics server",
    instructions="Provides tools to query system resources and manage desktop services.",
)
```

### Constructor Parameters
- `name` (`str`): Identifier for the server shown to clients and agents.
- `version` (`str`): Semantic version string of your server implementation.
- `description` (`str | None`): High-level description of server functionality.
- `instructions` (`str | None`): System-level guidance or instructions for LLMs interacting with the server.
- `log_level` (`'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'`): Server logging threshold (default: `'INFO'`).
- `debug` (`bool`): Enable debug mode and verbose tracebacks.
- `warn_on_duplicate_tools` (`bool`): Emit warning if a tool name is registered more than once (default: `True`).
- `resource_security` (`ResourceSecurity`): Configure path traversal and boundary policies.

> **Design Note:** Transport settings (`host`, `port`, `stateless_http`) are decoupled from server identity and configured at execution time via `.run()` or `.streamable_http_app()`.

---

## 2. Stateless Protocol Architecture

In MCP v2:
- **No Sticky Sessions:** Servers do not require session handshakes (`initialize`) or session headers (`Mcp-Session-Id`). Requests can be routed across arbitrary processes, containers, or serverless functions.
- **Self-Contained Requests:** Protocol version and client capabilities travel inside the request's `_meta` field (`io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientCapabilities`).
- **Capability Discovery:** The `server/discover` RPC allows clients to probe server capabilities and version support on demand.

### Multi-Turn State via Explicit Handles
When domain logic spans multiple tool calls, state is managed by minting explicit handles rather than relying on transport-level session state:

```
[Client / LLM] ---> tools/call: start_workflow() 
                    <--- returns { workflow_id: "wf_8a1f" } (stored in DB/Redis)

[Client / LLM] ---> tools/call: step_workflow(workflow_id="wf_8a1f", action="run")
                    <--- loads state by handle, executes, returns update
```

---

## 3. Modular Server Composition & Route Delegation

For large servers, avoid god files. Define tools in separate domain modules and register them on the central server instance:

### Option A: Direct Function Registration (`add_tool`)
```python
from mcp.server.mcpserver import MCPServer
from my_app.tools import database, filesystem, network

mcp = MCPServer(name="ModularServer", version="1.0.0")

# Register functions directly from modules
for fn in [database.query, database.get_schema]:
    mcp.add_tool(fn)

for fn in [filesystem.read_file, filesystem.list_dir]:
    mcp.add_tool(fn)

# Register with alias
mcp.add_tool(network.ping_host, name="check_connectivity")
```

### Option B: Domain Registration Modules (`register(mcp)`)
Group tools into domain modules (e.g. `routes/database.py`, `routes/storage.py`), each exporting a `register(mcp)` function:

```python
# routes/database.py
from mcp.types import ToolAnnotations

def query_records(table: str) -> list[dict]: ...

def register(mcp: object) -> None:
    mcp.tool(annotations=ToolAnnotations(read_only_hint=True))(query_records)
```

In the central server entrypoint, iterate across domain modules to register routes:

```python
# main.py
from mcp.server.mcpserver import MCPServer
from my_server.routes import database, filesystem, user_management

mcp = MCPServer(name="EnterpriseServer", version="1.0.0")

for module in [database, filesystem, user_management]:
    module.register(mcp)
```

