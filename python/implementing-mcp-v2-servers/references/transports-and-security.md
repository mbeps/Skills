# Transports, Security & Deployment

MCP v2 servers communicate with clients via two primary transports: standard input/output (`stdio`) for local desktop processes and Streamable HTTP (`streamable-http`) for networked or cloud deployments.

---

## 1. Transport Comparison

| Characteristic       | `stdio`                                        | `streamable-http` (Stateless)                           |
| :------------------- | :--------------------------------------------- | :------------------------------------------------------ |
| **Primary Use Case** | Desktop IDEs (VS Code, Cursor), Claude Desktop | Web services, Kubernetes, Serverless, Docker            |
| **Connection Model** | Local subprocess pipe (stdin/stdout)           | HTTP request/response with bidirectional streaming      |
| **Session Model**    | 1-to-1 process binding                         | Stateless (`stateless_http=True`), round-robin friendly |
| **Cancellation**     | Process termination or standard pipe close     | Client closing the response stream                      |
| **Network Security** | Local OS boundaries                            | DNS rebinding protection, host & CORS validation        |

---

## 2. Standard I/O (`stdio`)

Default transport for local execution. Desktop AI clients launch the server as a subprocess:

```python
# Synchronous run over stdio (default)
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Client Configuration (`.vscode/mcp.json`)
```json
{
  "servers": {
    "my-server": {
      "type": "stdio",
      "command": "uv",
      "args": ["run", "src/server/main.py"],
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    }
  }
}
```

---

## 3. Stateless Streamable HTTP (`streamable-http`)

Streamable HTTP enables serving MCP tools over standard web infrastructure without sticky sessions or persistent connection affinity.

### Standalone Server Run
```python
mcp.run(
    transport="streamable-http",
    host="0.0.0.0",
    port=8000,
    stateless_http=True,
)
```

### ASGI Application Integration (Uvicorn / Starlette / FastAPI)
Export the Starlette application directly from the server instance:

```python
from starlette.applications import Starlette

# Exported ASGI application
app: Starlette = mcp.streamable_http_app(stateless_http=True)
```

Run with Uvicorn:
```bash
uv run uvicorn server.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Mounting into Existing FastAPI Applications
```python
from fastapi import FastAPI
from starlette.routing import Mount

api = FastAPI()
api.mount("/mcp", app=mcp.streamable_http_app(stateless_http=True))
```

---

## 4. Transport Security Settings

To safeguard web servers against DNS rebinding attacks and restrict unauthorized browser origins, configure `TransportSecuritySettings`:

```python
from mcp.server.mcpserver import TransportSecuritySettings

security = TransportSecuritySettings(
    allowed_hosts=["api.example.com", "mcp.example.com:*", "localhost"],
    allowed_origins=["https://dashboard.example.com"],
    enable_dns_rebinding_protection=True,
)

app = mcp.streamable_http_app(
    stateless_http=True,
    transport_security=security,
)
```
- If a client sends an unapproved `Host` header, the server returns HTTP `421 Misdirected Request`.
- Set `enable_dns_rebinding_protection=False` only when sitting behind a trusted reverse proxy (e.g. Nginx or Traefik) that already strictly validates the `Host` header.

---

## 5. Dual-Transport Server Runner Pattern

Use this template in your main entrypoint to allow seamless local stdio execution and containerized HTTP deployment:

```python
import argparse
import os
from mcp.server.mcpserver import MCPServer

mcp = MCPServer(name="ProductionServer", version="1.0.0")

def run() -> None:
    parser = argparse.ArgumentParser(description="MCP v2 Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http"],
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

if __name__ == "__main__":
    run()
```

