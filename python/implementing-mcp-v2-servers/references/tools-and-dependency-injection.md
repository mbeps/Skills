# Tools, Structured Output & Dependency Injection

Tools are the primary mechanism through which models perform actions in MCP v2. They support strong typing, Pydantic input/output validation, automatic schema generation, and dependency injection.

---

## 1. Tool Declaration

Use the `@mcp.tool()` decorator. Docstrings and type hints are automatically compiled into the tool's JSON Schema:

```python
from typing import Literal
from mcp.server.mcpserver import MCPServer
from pydantic import BaseModel, Field

mcp = MCPServer(name="ToolServer")

class FilterOptions(BaseModel):
    max_results: int = Field(10, ge=1, le=100, description="Max entries to return.")
    status: Literal["active", "archived"] = Field("active", description="Filter state.")

@mcp.tool()
def search_records(query: str, options: FilterOptions) -> list[str]:
    """Search records by keyword with pagination and status filtering.

    Args:
        query: Search string.
        options: Filter options including max_results and status.
    """
    return [f"Record matching '{query}'"]
```

### Sync vs Async Execution
- `async def`: Coroutines run directly on the event loop.
- `def`: Synchronous handlers are automatically dispatched to AnyIO worker threads (`anyio.to_thread.run_sync`), keeping the server responsive during blocking I/O (like subprocesses or disk access).

---

## 2. Structured Output

When a tool returns a Pydantic `BaseModel`, the SDK automatically:
1. Generates an `output_schema` in the tool definition.
2. Emits `structured_content` in the result dictionary alongside text representations.

```python
class Assessment(BaseModel):
    healthy: bool
    load_factor: float = Field(..., description="Calculated load from 0.0 to 1.0")
    remediation: str | None = None

@mcp.tool()
def evaluate_health(cpu_percent: float, memory_gb: float) -> Assessment:
    """Assess node health and return structured classification."""
    is_healthy = cpu_percent < 80.0 and memory_gb < 16.0
    return Assessment(
        healthy=is_healthy,
        load_factor=cpu_percent / 100.0,
        remediation="Scale instances" if not is_healthy else None,
    )
```

The client receives:
```json
{
  "content": [
    { "type": "text", "text": "{\"healthy\": true, \"load_factor\": 0.45, \"remediation\": null}" }
  ],
  "structured_content": {
    "healthy": true,
    "load_factor": 0.45,
    "remediation": null
  },
  "is_error": false
}
```

---

## 3. Dependency Injection with `Resolve`

Similar to FastAPI's `Depends`, MCP v2 supports injecting dependencies via `Annotated[T, Resolve(resolver_fn)]`.
- **Invisible to Models**: Injected parameters are omitted from the tool's JSON Schema presented to LLMs.
- **Pre-execution**: The resolver runs before the tool logic.
- **Deduplication**: Resolvers execute at most once per tool call.

```python
from typing import Annotated
from mcp.server.mcpserver import Resolve

class DatabaseConnection:
    def execute(self, sql: str) -> list[dict]:
        return [{"id": 1, "name": "Item"}]

async def get_db_connection() -> DatabaseConnection:
    # Resolve DB pool, credentials, or session
    return DatabaseConnection()

@mcp.tool()
async def fetch_user(
    user_id: int,
    db: Annotated[DatabaseConnection, Resolve(get_db_connection)],
) -> dict:
    """Fetch user by ID. The 'db' argument is injected and hidden from the LLM."""
    records = db.execute(f"SELECT * FROM users WHERE id = {user_id}")
    return records[0] if records else {}
```

---

## 4. Error Handling with `MCPError`

To communicate errors to the client as formal JSON-RPC protocol errors (rather than text replies):

```python
from mcp.types import MCPError, ErrorCode

@mcp.tool()
def update_profile(user_id: int, email: str) -> str:
    """Update user email address."""
    if "@" not in email:
        raise MCPError(
            code=ErrorCode.INVALID_PARAMS,
            message=f"'{email}' is not a valid email address.",
        )
    return f"Updated user {user_id} email to {email}"
```
- `ErrorCode.INVALID_PARAMS`: -32602
- `ErrorCode.INTERNAL_ERROR`: -32603
- `ErrorCode.METHOD_NOT_FOUND`: -32601

