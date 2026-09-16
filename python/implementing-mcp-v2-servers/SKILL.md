---
name: implementing-mcp-v2-servers
description: Use when building or designing new Model Context Protocol (MCP) servers using the v2 specification (2026-07-28 stateless protocol) — implementing tools with Pydantic structured output, dependency injection via Resolve, resource URI templates, dynamic prompts, Context logging/progress/elicitation, dual-mode stdio and stateless Streamable HTTP transports, or in-memory Client testing.
---

# Implementing MCP v2 Servers (Stateless)

## Overview

Build modern, production-grade Model Context Protocol (MCP) servers targeting the 2026-07-28 stateless specification. MCP v2 servers use a self-contained request/response model where requests carry metadata in `_meta`, enabling horizontal scaling, serverless hosting, and dual transport support (`stdio` for desktop IDEs and `streamable-http` for networked clouds) with zero session stickiness.

## When to Use

Use when:
- Creating a new MCP server from scratch in Python (`MCPServer`) or TypeScript (`@modelcontextprotocol/server`).
- Implementing tools with strong validation, Pydantic models, and structured output (`structured_content`).
- Using dependency injection (`Annotated[T, Resolve(fn)]`) for database pools, auth tokens, or internal services.
- Exposing static resources, dynamic URI templates (`data://{id}`), or user-driven prompts (`@mcp.prompt()`).
- Adding request-level capabilities: structured logging (`ctx.info`), progress tokens (`ctx.report_progress`), or human verification (`ctx.elicit`).
- Configuring network transports: stateless Streamable HTTP (`stateless_http=True`), ASGI Starlette/FastAPI mounting, or desktop `stdio`.
- Implementing path security (`ResourceSecurity`) and DNS-rebinding protection (`TransportSecuritySettings`).
- Writing unit and integration tests using the in-memory test client (`Client(server)`).

**When NOT to use:**
- Migrating legacy v1 servers or FastMCP codebases (use `migrating-mcp-1-to-2`).
- Building standard REST, tRPC, or GraphQL APIs unrelated to AI tool integration.

## Implementation Workflow

1. **Initialize Server & Metadata**: Create the `MCPServer` instance with name, version, and instructions. Do not pass transport options to the constructor ([core-server-and-architecture.md](references/core-server-and-architecture.md)).
2. **Implement Tools & Output Models**: Define tools using `@mcp.tool()` with typed arguments and Pydantic return models for structured output. Inject hidden dependencies using `Resolve` ([tools-and-dependency-injection.md](references/tools-and-dependency-injection.md)).
3. **Expose Resources & Prompts**: Declare static resources and dynamic URI templates with `@mcp.resource()`, configuring `ResourceSecurity` to guard against traversal. Add user prompts with `@mcp.prompt()` ([resources-and-templates.md](references/resources-and-templates.md), [prompts-and-completions.md](references/prompts-and-completions.md)).
4. **Leverage Request Context**: Add `ctx: Context` parameters where handlers need structured logging, progress token reporting, or user confirmation elicitation ([context-and-lifecycle.md](references/context-and-lifecycle.md)).
5. **Configure Transports & Security**: Provide dual-mode execution: `stdio` for desktop clients and `streamable-http` with `stateless_http=True` for network deployments. Protect public endpoints with `TransportSecuritySettings` ([transports-and-security.md](references/transports-and-security.md)).
6. **Verify with In-Memory Client Tests**: Write automated tests using `from mcp import Client` to validate tool schemas, invocations, and resources in-process without network overhead ([in-memory-testing.md](references/in-memory-testing.md)).

## Quick Reference

| Topic | Reference File |
| :--- | :--- |
| `MCPServer` setup, constructor options, stateless protocol, explicit handles, modular routes | [core-server-and-architecture.md](references/core-server-and-architecture.md) |
| `@mcp.tool()`, Pydantic models, structured output, `Resolve()` DI, `ToolAnnotations`, `ToolError` | [tools-and-dependency-injection.md](references/tools-and-dependency-injection.md) |
| Static resources, URI templates (`{id}`), MIME types, `ResourceSecurity` traversal & slashes | [resources-and-templates.md](references/resources-and-templates.md) |
| Reusable user prompts (`@mcp.prompt()`), multi-message sequences, completions | [prompts-and-completions.md](references/prompts-and-completions.md) |
| `ctx: Context`, real-time logging, progress tokens, user elicitation, lifespan | [context-and-lifecycle.md](references/context-and-lifecycle.md) |
| `stdio`, `streamable-http` (stateless), ASGI mounting, DNS rebinding security | [transports-and-security.md](references/transports-and-security.md) |
| In-memory `Client(server)` testing, unit test stubbing, AnyIO fixtures, schema assertions | [in-memory-testing.md](references/in-memory-testing.md) |
| Canonical specifications, SDK documentation, and GitHub repositories | [references.md](references/references.md) |

## Red Flags

- **"I need sticky sessions to manage state across tool calls"** — **Wrong**. MCP v2 is stateless at the transport layer. Mint explicit opaque handles from initialization tools and pass them in subsequent tool calls; store domain state in a shared database or cache.
- **"Generic exceptions in tool handlers still return their message to the model"** — **Wrong**. Unhandled generic exceptions in SDK v2.1+ are masked to `"Error executing tool <name>"`. Raise `ToolError` from `mcp.server.mcpserver.exceptions` or wrap handlers centrally to preserve model-visible error messages.
- **"Resource templates match arbitrary file paths with slashes by default"** — **Wrong**. RFC 6570 templates reject unencoded slashes and `ResourceSecurity` rejects absolute paths unless parameter names are listed in `ResourceSecurity(exempt_params={...})` and values are URL-encoded by the client.
- **"Pass host and port to `MCPServer(...)`"** — **Wrong**. In v2, transport options belong on `.run()` or `.streamable_http_app()`, not on the server constructor.
- **"Testing requires binding to an HTTP port"** — **Wrong**. Use `async with Client(mcp) as client:` to test the server directly in-memory with sub-second execution and no port conflicts.
- **"Sync handlers block the server event loop"** — **Wrong**. In MCP v2 Python SDK, synchronous functions decorated with `@mcp.tool()` automatically run in worker threads via AnyIO.
- **"Exposing public HTTP without `TransportSecuritySettings`"** — **Danger**. Web-facing MCP servers without host validation risk DNS rebinding vulnerabilities; always configure `allowed_hosts`.

