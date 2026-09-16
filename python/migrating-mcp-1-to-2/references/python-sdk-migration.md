# Python SDK Migration Guide (v1 $\to$ v2)

The MCP Python SDK underwent a major version upgrade to version 2 (`mcp>=2.0.0`, current 2.2.x) to support the July 28, 2026 stateless specification.

---

## 1. Package Dependencies

### `pyproject.toml`
```toml
# Old (v1)
dependencies = [
    "mcp[cli]>=1.24.0",
]

# New (v2)
dependencies = [
    "mcp[cli]>=2.2.0",
]
```

### Underlying Dependency Changes
- `mcp-types` is now a dedicated companion package installed alongside `mcp`.
- `httpx` and `httpx-sse` are replaced by `httpx2` and `httpcore2`.
- Run `uv sync` or `pip install --upgrade "mcp[cli]>=2.2.0"`.

---

## 2. Server Class Rename: `FastMCP` $\to$ `MCPServer`

In SDK v1, the high-level server was `mcp.server.fastmcp.FastMCP`. In SDK v2, this has been renamed to `MCPServer` and the old import path raises `ModuleNotFoundError`.

### Imports
```python
# ❌ v1 (ModuleNotFoundError in v2)
from mcp.server.fastmcp import FastMCP

# ✅ v2
from mcp.server.mcpserver import MCPServer
# Or from the top-level server namespace:
from mcp.server import MCPServer
```

### Constructor Signature
In v2, server metadata and identity are separated from transport configuration:
- Parameters: `name`, `title`, `description`, `instructions`, `version`, `website_url`, `icons`.
- Transport configuration (`host`, `port`, `stateless_http`) has moved to `.run()` and `.streamable_http_app()`. Passing transport options to `MCPServer(...)` raises `TypeError`.

```python
# ❌ v1
mcp = FastMCP("My-Server", dependencies=["pydantic"])

# ✅ v2
mcp = MCPServer(
    name="My-Server",
    version="1.0.0",
    description="Automations and system tools",
)
```

---

## 3. Tool & Resource Registration

### Decorator Pattern (Identical)
```python
@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b

@mcp.resource("config://app/defaults")
def get_config() -> str:
    return '{"timeout": 30}'
```

### Direct Programmatic Registration (`add_tool`)
Instead of wrapping functions manually, you can register callable functions directly:
```python
# Register function directly, preserving docstrings and type annotations
mcp.add_tool(some_module.my_function)

# Register function with a custom public tool name
mcp.add_tool(some_module.internal_func, name="public_tool_name")
```

---

## 4. Context Access & Handler Execution

### `get_context()` Removal
In v1, handlers accessed context via `mcp.get_context()`. In v2, declare `ctx: Context` as an annotated parameter:
```python
# ❌ v1
@mcp.tool()
def log_action(text: str) -> str:
    ctx = mcp.get_context()
    ctx.info(f"Processing {text}")
    return text

# ✅ v2
from mcp.server.mcpserver import Context

@mcp.tool()
async def log_action(text: str, ctx: Context) -> str:
    await ctx.info(f"Processing {text}")
    return text
```

### Sync Functions Run on Worker Threads
In SDK v2, synchronous tool functions are automatically dispatched to AnyIO worker threads (`anyio.to_thread.run_sync`), preventing blocking operations from stalling the event loop.

---

## 5. Type Naming & Case Conventions

SDK attributes and models transitioned from `camelCase` to standard Python `snake_case`:

| v1 (Legacy)         | v2 (Modern)                          | Notes                                                    |
| :------------------ | :----------------------------------- | :------------------------------------------------------- |
| `tool.inputSchema`  | `tool.input_schema`                  | Dict describing JSON Schema                              |
| `tool.outputSchema` | `tool.output_schema`                 | Output schema if structured                              |
| `ToolAnnotations`   | `read_only_hint`, `destructive_hint` | Attributes now snake_case (`readOnlyHint` still aliases) |
| `McpError`          | `MCPError`                           | Base protocol exception                                  |
| `FastMCPError`      | `MCPServerError`                     | Base server framework exception                          |
| `ctx.fastmcp`       | `ctx.mcp_server`                     | Context backreference                                    |
| `mcp.types.AnyUrl`  | `str`                                | Resource URIs are plain strings                          |
| `RootModel` unions  | Plain `Union` types                  | E.g. `ServerNotification`                                |

---

## 6. Exceptions & Tool Error Masking

### Tool Error Masking in v2.1+
In SDK v1, any generic exception (e.g. `ValueError("Sheet not found")`) raised in a `@mcp.tool()` handler was automatically serialized into an `is_error=True` result preserving the exception message.

In SDK v2.1+, **unhandled generic exceptions are masked** to prevent leaking internal stack traces:
```text
Error executing tool <tool_name>
```
To expose model-visible error messages in tool failure responses, raise `ToolError` from `mcp.server.mcpserver.exceptions`:

```python
# ❌ v1 style in v2 (client only sees "Error executing tool find_sheet")
@mcp.tool()
def find_sheet(name: str) -> str:
    raise ValueError(f"Sheet '{name}' not found")

# ✅ v2 (client sees "Error executing tool find_sheet: Sheet 'X' not found")
from mcp.server.mcpserver.exceptions import ToolError

@mcp.tool()
def find_sheet(name: str) -> str:
    raise ToolError(f"Sheet '{name}' not found")
```

### Route Adapter Choke Point Pattern
If migrating an existing codebase with dozens of tools raising `ValueError` or standard domain exceptions, wrap the tool registration or handler execution at a central choke point to catch domain exceptions and re-raise `ToolError(str(e))` without altering internal domain logic:

```python
import functools
import inspect
from mcp.server.mcpserver.exceptions import ToolError

def wrap_tool_fn(fn):
    if inspect.iscoroutinefunction(fn):
        @functools.wraps(fn)
        async def async_wrapped(*args, **kwargs):
            try:
                return await fn(*args, **kwargs)
            except (ValueError, FileNotFoundError, KeyError) as e:
                raise ToolError(str(e)) from e
        return async_wrapped

    @functools.wraps(fn)
    def sync_wrapped(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except (ValueError, FileNotFoundError, KeyError) as e:
            raise ToolError(str(e)) from e
    return sync_wrapped
```

### Protocol-Level MCPError
```python
# ❌ v1
from mcp.types import McpError, ErrorCode
raise McpError(ErrorCode.INVALID_PARAMS, "Invalid parameter")

# ✅ v2
from mcp.types import MCPError, ErrorCode
raise MCPError(ErrorCode.INVALID_PARAMS, "Invalid parameter")
```
When an `MCPError` is raised within a handler, the SDK surfaces it directly as a standard JSON-RPC protocol error to the client.

---

## 7. Resource Templates & Path Security (`ResourceSecurity`)

In SDK v2, `@mcp.resource("uri://{param}")` templates strictly validate according to RFC 6570 and enforce `ResourceSecurity`:
- **Default Policy**: `ResourceSecurity(reject_path_traversal=True, reject_absolute_paths=True, reject_null_bytes=True)`.
- **Filesystem Paths**: If a template parameter receives filesystem paths (e.g. `/home/user/doc.xlsx` or `../data/file.csv`), default security rejects the match with `Unknown resource`.
- **Exemption**: Exclude specific parameters from path checks by passing `ResourceSecurity(exempt_params={"param_name"})` to `MCPServer`:

```python
from mcp.server.mcpserver import MCPServer, ResourceSecurity

mcp = MCPServer(
    name="FileServer",
    resource_security=ResourceSecurity(exempt_params={"file_path"}),
)

@mcp.resource("file://workbook/{file_path}/sheets")
def get_sheets(file_path: str) -> str:
    return "..."
```

Note: Template parameter values with slashes must be percent-encoded by the client (`urllib.parse.quote(path, safe="")`) when queried, or defined with RFC 6570 reserved expansion (`{+file_path}`).

