# Protocol & Architecture: Stateless MCP (2026-07-28 Spec)

## The Stateless Paradigm Shift

Prior to the July 28, 2026 specification, the Model Context Protocol (MCP) was fundamentally connection-oriented and sessionful:
1. Clients and servers executed an explicit `initialize` and `notifications/initialized` handshake.
2. Servers assigned an `Mcp-Session-Id` header to bind subsequent HTTP/SSE requests.
3. Transports required sticky sessions or connection affinity, making horizontal autoscaling, serverless execution, and multi-tenant edge routing difficult and fragile.

The **2026-07-28 specification** shifted MCP to a **stateless request/response architecture**:
- Every JSON-RPC request is completely self-describing and self-contained.
- The mandatory `initialize` handshake and `Mcp-Session-Id` headers are eliminated.
- Any server instance or worker can handle any incoming request without relying on shared in-memory session caches.

---

## Architectural Comparison

| Dimension           | MCP v1 (Legacy Stateful)                    | MCP v2 (Stateless 2026-07-28)                            |
| :------------------ | :------------------------------------------ | :------------------------------------------------------- |
| **Session Model**   | Session-bound (`Mcp-Session-Id`)            | Stateless, self-contained per request                    |
| **Handshake**       | Mandatory `initialize` / `initialized`      | Discovered on-demand via `server/discover` or implicit   |
| **Request Context** | Negotiated in session handshake             | Carried in `_meta` object on each request                |
| **Web Transport**   | SSE (Server-Sent Events) + POST endpoints   | Streamable HTTP (bidirectional HTTP streams)             |
| **Cancellation**    | Out-of-band notification (`$/cancel`)       | Closing request response stream or explicit cancellation |
| **Load Balancing**  | Requires sticky sessions (session affinity) | Standard round-robin / serverless / anycast              |
| **State Handling**  | Server in-memory session objects            | Explicit handles minted by tools and passed by the model |
| **Legacy Features** | Roots, Sampling, Logging active             | Roots, Sampling, Logging on 12-month deprecation track   |

---

## Self-Describing Request Envelopes (`_meta`)

In stateless MCP, metadata that previously required an initialization handshake is passed inside the JSON-RPC request's `_meta` field:

```json
{
  "jsonrpc": "2.0",
  "id": "req-42",
  "method": "tools/call",
  "params": {
    "name": "analyze_metrics",
    "arguments": {
      "cpu_percent": 84.5
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "Claude-Desktop",
        "version": "1.8.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {
        "experimental": {}
      }
    }
  }
}
```

### Key Metadata Keys
- `io.modelcontextprotocol/protocolVersion`: Negotiated protocol specification date string (e.g. `"2026-07-28"`).
- `io.modelcontextprotocol/clientInfo`: Client name and version.
- `io.modelcontextprotocol/clientCapabilities`: Capabilities supported by the caller.

---

## The `server/discover` RPC

In place of the rigid `initialize` handshake, MCP v2 introduces the `server/discover` procedure. A client can query the server at any point to discover supported protocol versions, identity, and capabilities:

### Request
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {}
}
```

### Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2026-07-28",
    "serverInfo": {
      "name": "Linux-GNOME-Automations",
      "version": "0.1.0"
    },
    "capabilities": {
      "tools": { "listChanged": false },
      "resources": { "subscribe": false, "listChanged": false },
      "prompts": { "listChanged": false }
    }
  }
}
```

---

## Managing Application State in a Stateless Protocol

A common misconception is that a stateless protocol forbids applications from having state. **Stateless protocol means the transport layer has no session memory, not that your business domain cannot maintain state.**

### How Multi-Turn State Works in MCP v2
Instead of storing state in an ephemeral server session dictionary keyed by `Mcp-Session-Id`, use **explicit domain handles**:
1. **Tool Mints an Opaque Handle**: A tool (e.g., `open_database_session` or `create_task`) returns an opaque identifier (`session_id`, `task_id`, or resource URI) persisted in a database, cache, or external service.
2. **Model Carries the Handle**: The LLM includes the handle in subsequent tool calls (e.g., `query_database(session_id="sess_123", query="...")`).
3. **Any Server Handles the Call**: Any load-balanced server instance receives the request, loads the state by handle from the shared store, performs the action, and updates the store.

