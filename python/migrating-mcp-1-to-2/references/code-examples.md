# Code Examples: MCP v1 vs MCP v2

Complete, runnable before-and-after patterns for migrating MCP servers to SDK v2 stateless architecture.

---

## 1. Python Server: Before & After

### Before (v1 FastMCP)
```python
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

mcp = FastMCP("MathServer", dependencies=["pydantic"])

class MultiplyArgs(BaseModel):
    a: float = Field(..., description="First number")
    b: float = Field(..., description="Second number")

@mcp.tool()
def multiply(args: MultiplyArgs) -> float:
    """Multiply two numbers together."""
    return args.a * args.b

@mcp.resource("data://version")
def get_version() -> str:
    return "1.0.0"

if __name__ == "__main__":
    mcp.run()
```

### After (v2 MCPServer Stateless)
```python
from __future__ import annotations

import argparse
import os
from mcp.server.mcpserver import MCPServer
from pydantic import BaseModel, Field
from starlette.applications import Starlette

# Initialize server metadata
mcp: MCPServer = MCPServer(
    name="MathServer",
    version="2.0.0",
    description="Mathematical computation MCP server",
)

class MultiplyArgs(BaseModel):
    a: float = Field(..., description="First number")
    b: float = Field(..., description="Second number")

@mcp.tool()
def multiply(args: MultiplyArgs) -> float:
    """Multiply two numbers together."""
    return args.a * args.b

@mcp.resource("data://version")
def get_version() -> str:
    """Return current server version."""
    return "2.0.0"

# Export ASGI application for stateless Streamable HTTP
app: Starlette = mcp.streamable_http_app(stateless_http=True)

def run() -> None:
    parser = argparse.ArgumentParser(description="MathServer MCP v2")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http", "sse"],
        default=os.environ.get("MCP_TRANSPORT", "stdio"),
    )
    parser.add_argument("--host", default=os.environ.get("MCP_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("MCP_PORT", "8000")))
    parser.add_argument(
        "--stateless",
        action=argparse.BooleanOptionalAction,
        default=os.environ.get("MCP_STATELESS_HTTP", "true").lower() in ("true", "1", "yes"),
    )
    args = parser.parse_args()

    if args.transport == "stdio":
        mcp.run(transport="stdio")
    elif args.transport == "streamable-http":
        mcp.run(
            transport="streamable-http",
            host=args.host,
            port=args.port,
            stateless_http=args.stateless,
        )
    elif args.transport == "sse":
        mcp.run(transport="sse", host=args.host, port=args.port)

if __name__ == "__main__":
    run()
```

---

## 2. TypeScript Server: Before & After

### Before (v1 Monolithic SDK)
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "MyServer", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "greet",
    description: "Greet a user",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"]
    }
  }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

### After (v2 Modular Server)
```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const server = new McpServer({
  name: "MyServer",
  version: "2.0.0"
});

server.tool(
  "greet",
  "Greet a user",
  { name: z.string().describe("User name") },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name}!` }]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 3. Explicit State Handle Pattern (Multi-Turn State over Stateless Protocol)

When your domain requires tracking sessions or workflow tasks across requests, do not rely on transport session stickiness. Return an opaque handle from the initialization tool:

```python
import uuid
from typing import Dict
from mcp.server.mcpserver import MCPServer
from pydantic import BaseModel

mcp = MCPServer(name="WorkflowServer", version="2.0.0")

# External shared store (e.g. Redis, database, file)
SHARED_STATE_STORE: Dict[str, dict] = {}

class InitWorkflowResult(BaseModel):
    workflow_id: str
    status: str

@mcp.tool()
def start_workflow(task_name: str) -> InitWorkflowResult:
    """Initialize a workflow and mint an explicit tracking handle."""
    workflow_id = f"wf_{uuid.uuid4().hex[:8]}"
    SHARED_STATE_STORE[workflow_id] = {"task": task_name, "step": 1, "completed": False}
    return InitWorkflowResult(workflow_id=workflow_id, status="started")

@mcp.tool()
def step_workflow(workflow_id: str, action: str) -> str:
    """Progress a workflow using its explicit handle."""
    wf = SHARED_STATE_STORE.get(workflow_id)
    if not wf:
        raise ValueError(f"Workflow '{workflow_id}' not found.")
    
    wf["step"] += 1
    return f"Workflow '{workflow_id}' processed action '{action}', now on step {wf['step']}."
```

