# Transports & Deployment: Stdio vs Stateless Streamable HTTP

MCP v2 provides three primary transport options. Choosing and configuring the appropriate transport is essential for desktop, container, or serverless deployments.

---

## Transport Overview

| Transport         | Typical Host / Client            | Protocol Nature               | State Model                          | Notes                                  |
| :---------------- | :------------------------------- | :---------------------------- | :----------------------------------- | :------------------------------------- |
| `stdio`           | VS Code, Claude Desktop, Cursor  | Process standard I/O streams  | Naturally 1-to-1, protocol stateless | Default for local tools                |
| `streamable-http` | Web services, Docker, Kubernetes | Bidirectional HTTP streaming  | Stateless (`stateless_http=True`)    | Replaces SSE as primary HTTP transport |
| `sse`             | Legacy 2025-era web clients      | SSE GET + HTTP POST endpoints | Stateful session manager             | Maintained for backward compatibility  |

---

## 1. Standard I/O (`stdio`)

Used for desktop integrations (like VS Code or Claude Desktop) where the client spawns the server as a local child process.

### VS Code Configuration (`.vscode/mcp.json`)
```json
{
  "servers": {
    "my-server": {
      "type": "stdio",
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/path/to/project",
        "src/mcp_server/main.py"
      ],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

In Python SDK v2:
```python
mcp.run(transport="stdio")  # Default when called with no arguments
```

---

## 2. Stateless Streamable HTTP (`streamable-http`)

Streamable HTTP replaces the old Server-Sent Events (SSE) pattern. It allows clients to send JSON-RPC requests and stream back chunked responses over standard HTTP.

### Key Behaviors
- **Cancellation**: Closing the HTTP response stream signals cancellation to the server.
- **Payload Limit**: Request bodies default to a 4 MiB limit (`max_request_body_size=4194304`).
- **Stateless Flag**: Set `stateless_http=True`. Each HTTP request is treated as independent. No session handshake, no cookies, no sticky session headers required.

### Python SDK Configuration
```python
# Standalone execution
mcp.run(
    transport="streamable-http",
    host="0.0.0.0",
    port=8000,
    stateless_http=True,
)

# ASGI Application (for Uvicorn / Starlette / FastAPI)
app = mcp.streamable_http_app(stateless_http=True)
```

Run with Uvicorn:
```bash
uv run uvicorn mcp_server.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 3. Production Multi-Transport CLI Pattern

Equip your server's `run()` function with argument parsing and environment variable fallbacks so a single codebase can run as both a desktop `stdio` tool and a containerized HTTP service:

```python
import argparse
import os
from mcp.server.mcpserver import MCPServer

mcp = MCPServer(name="MyServer", version="1.0.0")

def parse_args(args=None):
    parser = argparse.ArgumentParser(description="MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http", "sse"],
        default=os.environ.get("MCP_TRANSPORT", "stdio"),
        help="Transport protocol (default: stdio)",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("MCP_HOST", "127.0.0.1"),
        help="Host for HTTP transport (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("MCP_PORT", "8000")),
        help="Port for HTTP transport (default: 8000)",
    )
    parser.add_argument(
        "--stateless",
        action=argparse.BooleanOptionalAction,
        default=os.environ.get("MCP_STATELESS_HTTP", "true").lower() in ("true", "1", "yes"),
        help="Enable stateless HTTP mode (default: True)",
    )
    return parser.parse_args(args)

def run():
    args = parse_args()
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
```

---

## 4. Transport Security & DNS-Rebinding Protection

By default, `streamable_http_app()` restricts connections to `localhost` to prevent DNS rebinding attacks. When deploying to a cloud network or reverse proxy, pass explicit transport security settings:

```python
from mcp.server.mcpserver import TransportSecuritySettings

security = TransportSecuritySettings(
    allowed_hosts=["api.mycompany.com", "localhost"]
)

app = mcp.streamable_http_app(
    stateless_http=True,
    transport_security=security,
)
```

