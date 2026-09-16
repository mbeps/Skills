---
name: migrating-mcp-1-to-2
description: Use when upgrading a Model Context Protocol (MCP) server or client from v1 to v2 (2026-07-28 stateless specification) — bumping mcp to >=2.0.0, replacing FastMCP with MCPServer, migrating @modelcontextprotocol/sdk to modular server/client packages, enabling stateless Streamable HTTP (stateless_http=True), or debugging errors like ModuleNotFoundError for mcp.server.fastmcp, McpError renames, camelCase inputSchema deprecations, or broken sticky session logic.
---

# Migrating Model Context Protocol (MCP) v1 $\to$ v2 (Stateless)

## Overview

The 2026-07-28 MCP specification transitions the protocol from a stateful, session-bound model (`initialize` handshake, `Mcp-Session-Id` header, sticky sessions) to a self-contained, **stateless request/response architecture** where requests carry their own metadata in `_meta`. This guide orchestrates migrating both Python and TypeScript servers, adopting `MCPServer`, enabling stateless Streamable HTTP, and writing in-memory test suites.

## When to Use

Use when:
- Upgrading Python `mcp` package from `1.x` (`1.24.0`+) to `2.x` (`2.0.0`+ / `2.2.0`+).
- Upgrading TypeScript `@modelcontextprotocol/sdk` to `@modelcontextprotocol/server` and `@modelcontextprotocol/client`.
- Encountering runtime error: `ModuleNotFoundError: No module named 'mcp.server.fastmcp'`.
- Encountering type or exception errors: `McpError` (now `MCPError`), `FastMCPError` (now `MCPServerError`), or `Tool.inputSchema` (now `tool.input_schema`).
- Eliminating legacy sticky-session infrastructure or session affinity requirements in favor of serverless, Kubernetes, or edge load-balanced deployments.
- Migrating web transports from Server-Sent Events (SSE) to Streamable HTTP (`stateless_http=True`).
- Refactoring `get_context()` calls to explicit `ctx: Context` parameters.
- Migrating test suites to use the v2 in-memory `Client(server)` fixture.

**When NOT to use:**
- Building a brand new server from scratch with no legacy v1 code.
- General REST, tRPC, or GraphQL migrations unrelated to the Model Context Protocol.

## Workflow

1. **Audit Application State & Transports**: Identify if the server relies on in-memory session dictionaries keyed by `Mcp-Session-Id`. If multi-turn state is needed, convert to explicit handles minted by tools and persisted in a shared store ([protocol-and-architecture.md](references/protocol-and-architecture.md)).
2. **Upgrade SDK Dependencies**: Bump `mcp[cli]>=2.2.0` in `pyproject.toml` (Python) or install `@modelcontextprotocol/server` / `@modelcontextprotocol/client` (TypeScript) ([python-sdk-migration.md](references/python-sdk-migration.md), [typescript-sdk-migration.md](references/typescript-sdk-migration.md)).
3. **Refactor Server & Tool Definitions**:
   - Python: Replace `FastMCP` with `MCPServer`, move transport options out of constructor, update `camelCase` fields to `snake_case`, and use `ctx: Context` parameters.
   - TypeScript: Run codemod `npx @modelcontextprotocol/codemod@latest v1-to-v2 .` and adopt Standard Schema.
4. **Configure Stateless Transports**: Keep `stdio` for desktop clients (VS Code, Claude Desktop); configure `streamable-http` with `stateless_http=True` for network deployments ([transports-and-deployment.md](references/transports-and-deployment.md)).
5. **Verify with In-Memory Client Tests**: Write unit tests using `mcp.Client(mcp)` to assert tool discovery, schema validity, and tool execution without network overhead ([testing-and-verification.md](references/testing-and-verification.md)).

## Quick Reference

| Migration Topic | Reference File |
| :--- | :--- |
| 2026-07-28 Spec, `_meta` envelope, `server/discover`, state handles | [protocol-and-architecture.md](references/protocol-and-architecture.md) |
| Python `MCPServer`, `snake_case` fields, `MCPError`, context injection | [python-sdk-migration.md](references/python-sdk-migration.md) |
| TypeScript modular packages, codemod, Standard Schema, factory pattern | [typescript-sdk-migration.md](references/typescript-sdk-migration.md) |
| Streamable HTTP, `stateless_http=True`, `stdio`, ASGI & CLI runners | [transports-and-deployment.md](references/transports-and-deployment.md) |
| In-memory `Client(server)` fixtures, schema assertions, verification checklist | [testing-and-verification.md](references/testing-and-verification.md) |
| Runnable Before & After code templates in Python and TypeScript | [code-examples.md](references/code-examples.md) |
| Official documentation, specifications, and repository URLs | [references.md](references/references.md) |

## Red Flags

- **"Stateless means my server cannot maintain any business state"** — **Wrong**. Stateless means the transport protocol requires no sticky sessions. Applications store state in databases/caches and reference it via explicit opaque handles minted by tools.
- **"I can keep using `FastMCP` as a backwards-compatibility alias in v2"** — **Wrong**. `mcp.server.fastmcp` throws `ModuleNotFoundError` at import time in v2. You must rename to `MCPServer`.
- **"Passing `stateless_http=True` breaks `stdio`"** — **Wrong**. `stateless_http` applies only to the `streamable-http` transport. `stdio` is naturally point-to-point and always runs cleanly.
- **"`mcp.run()` still takes host and port in constructor"** — **Wrong**. In v2, transport options belong on `.run()` or `.streamable_http_app()`, not `MCPServer()`.
- **"Testing requires starting a real HTTP server on a port"** — **Wrong**. Use `from mcp import Client` to connect directly to the `MCPServer` instance in-memory with zero networking latency.

