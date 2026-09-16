# Context, Elicitation & Server Lifespan

The `Context` object gives handlers access to request-level capabilities: sending real-time log notifications, reporting progress tokens, checking client capabilities, and managing server lifespans.

---

## 1. Injecting `Context`

Declare a `ctx: Context` parameter in any `@mcp.tool()`, `@mcp.resource()`, or `@mcp.prompt()` handler. The SDK automatically populates it without adding it to the LLM's input schema:

```python
from mcp.server.mcpserver import Context, MCPServer

mcp = MCPServer(name="ContextDemo")

@mcp.tool()
async def process_batch(items: list[str], ctx: Context) -> int:
    """Process a list of items with progress and logging."""
    await ctx.info(f"Starting batch of {len(items)} items", data={"count": len(items)})
    
    for idx, item in enumerate(items):
        # Progress token update
        await ctx.report_progress(progress=idx + 1, total=len(items))
        # Process item...
        
    await ctx.info("Batch processing complete")
    return len(items)
```

---

## 2. Key `Context` Methods

| Method                                       | Purpose                                                     |
| :------------------------------------------- | :---------------------------------------------------------- |
| `await ctx.info(message, data=None)`         | Emit `notifications/message` info log to client             |
| `await ctx.warning(message, data=None)`      | Emit warning log to client                                  |
| `await ctx.error(message, data=None)`        | Emit error log to client                                    |
| `await ctx.debug(message, data=None)`        | Emit debug log to client                                    |
| `await ctx.report_progress(progress, total)` | Send progress updates if client provided a progress token   |
| `await ctx.read_resource(uri)`               | Read another resource from the server internally            |
| `ctx.client_capabilities`                    | Inspect client capabilities (`experimental`, `roots`, etc.) |
| `ctx.protocol_version`                       | Current protocol version (e.g. `"2026-07-28"`)              |
| `ctx.request_id`                             | Current JSON-RPC request identifier                         |

---

## 3. Human Elicitation (`ctx.elicit`)

For high-consequence operations (e.g., deleting a database table or sending funds), tools can request interactive confirmation or additional input from the user before executing:

```python
from pydantic import BaseModel, Field

class ConfirmAction(BaseModel):
    confirmed: bool = Field(..., description="Confirm you want to execute destructive action.")

@mcp.tool()
async def drop_table(table_name: str, ctx: Context) -> str:
    """Drop a table with mandatory user verification."""
    # Elicit confirmation from the user
    response = await ctx.elicit(
        message=f"Are you sure you want to permanently drop table '{table_name}'?",
        schema=ConfirmAction,
    )
    
    if not response.confirmed:
        return "Operation cancelled by user."
        
    # Proceed with drop...
    return f"Table '{table_name}' dropped successfully."
```

---

## 4. Server Lifespan Management

Manage startup and shutdown logic (e.g. database pools, HTTP sessions, Redis clients) using the `lifespan` parameter on `MCPServer`:

```python
from contextlib import asynccontextmanager
from typing import AsyncIterator
from mcp.server.mcpserver import MCPServer

class AppState:
    db_pool: any = None

@asynccontextmanager
async def server_lifespan(server: MCPServer) -> AsyncIterator[AppState]:
    state = AppState()
    # Startup logic
    state.db_pool = "Initialized Connection Pool"
    print("Database pool connected.")
    
    yield state
    
    # Shutdown logic
    print("Closing database pool...")

mcp = MCPServer(
    name="LifespanServer",
    version="1.0.0",
    lifespan=server_lifespan,
)
```

