---
name: mcp-nextjs
description: Use when building, exposing, securing, or debugging a Model Context Protocol (MCP) server inside a Next.js (App Router, TypeScript) application, connecting AI clients (Claude, Gemini, Cursor, Copilot) via Streamable HTTP, implementing OAuth 2.1 authentication, or writing Vitest tests for MCP tools.
---

# MCP + Next.js

## Overview

Hosting a Model Context Protocol (MCP) server inside Next.js exposes application data, business logic, and database operations directly to AI clients (Claude, Gemini, Cursor, Copilot) via Web-standard Streamable HTTP. Using `mcp-handler` with `@modelcontextprotocol/server` (v2.x) eliminates standalone server infrastructure by embedding the MCP server directly into standard App Router Route Handlers.

**Core principle:** Treat the MCP server as a standard Next.js Route Handler adapter. Keep tools modular by domain in `lib/mcp/tools/`, validate arguments with Standard Schema / Zod v4, and serve stateless Streamable HTTP at `/api/mcp`.

---

## When to Use

- Building or turning a Next.js web application into an MCP server accessible by AI assistants.
- Exposing internal application data (e.g. portfolio items, CRM records, analytics, CMS blogs) as AI-queryable tools.
- Replacing legacy stdio-only MCP bridges with remote, Web-standard Streamable HTTP endpoints.
- Securing remote MCP tools with Bearer token authentication and RFC 9728 challenges.
- Writing unit and route handler integration tests for MCP tools using Vitest.

## Not For

- Stdio-only desktop tools with no web application (use a standalone Node/Python CLI).
- Pure WebSocket bidirectional push streams where the client does not speak MCP (use WebSockets or Server-Sent Events directly).

---

## Quick Start

### 1. Install Dependencies
```bash
yarn add mcp-handler@^2 @modelcontextprotocol/server@^2 zod@^4
```

### 2. Create Route Handler
```typescript
// app/api/mcp/route.ts
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "echo",
      {
        title: "Echo Tool",
        description: "Echoes the provided message back.",
        inputSchema: z.object({
          message: z.string(),
        }),
      },
      async ({ message }) => ({
        content: [{ type: "text", text: `Echo: ${message}` }],
      }),
    );
  },
  {
    serverInfo: {
      name: "my-nextjs-mcp",
      version: "1.0.0",
    },
  },
);

export { handler as GET, handler as POST };
```

---

## Core Architecture

```mermaid
flowchart LR
    Client["MCP Client\n(Claude / Gemini / Copilot)"]
    Route["Next.js Route Handler\napp/api/mcp/route.ts"]
    Handler["mcp-handler\ncreateMcpHandler()"]
    Server["McpServer (v2)\n@modelcontextprotocol/server"]
    Tools["Modular Tools\nlib/mcp/tools/*.ts"]
    DB["Application Logic & DB\n(Database / Services)"]

    Client <-->|Streamable HTTP\nJSON-RPC| Route
    Route <--> Handler
    Handler <--> Server
    Server <--> Tools
    Tools <--> DB
```

### Recommended Directory Structure

```text
app/
└── api/
    └── mcp/
        └── route.ts            # Route handler (GET & POST)
lib/
└── mcp/
    ├── helpers.ts              # formatToolResponse helper
    ├── register-tools.ts       # Tool aggregation registry
    ├── server.ts               # createMcpHandler configuration
    └── tools/                  # Domain-specific tool modules
        ├── about.ts
        ├── projects.ts
        └── skills.ts
```

---

## Quick Reference

| Task | Pattern | Detailed Guide |
| :--- | :--- | :--- |
| **Tool Registration** | `server.registerTool("name", { inputSchema: z.object({...}) }, handler)` | [Tools & Resources](references/tools-and-resources.md) |
| **No-arg Tools** | Pass `inputSchema: z.object({})` | [Tools & Resources](references/tools-and-resources.md) |
| **Server Action Reuse** | `runWithMcpClient(client, () => baseHandler(req))` via `AsyncLocalStorage` | [Tools & Resources](references/tools-and-resources.md) |
| **Resources** | `server.registerResource("name", "uri://...", meta, handler)` | [Tools & Resources](references/tools-and-resources.md) |
| **Authentication** | `withMcpAuth(handler, verifyMcpToken, { required: false })` | [Auth & Security](references/authentication-and-security.md) |
| **Universal OAuth 2.1** | RFC 9728, RFC 8414, RFC 7591 DCR, and Supabase GoTrue IdP | [OAuth 2.1 & OIDC](references/oauth-and-oidc.md) |
| **CORS & Probes** | Export `OPTIONS` (204 CORS) and `HEAD` (200 probe) in `route.ts` | [Auth & Security](references/authentication-and-security.md) |
| **Claude Desktop** | `npx -y mcp-remote http://localhost:3000/api/mcp` | [Client Config](references/client-configuration.md) |
| **Gemini Connected Apps** | Discover via `/.well-known/oauth-protected-resource/api/mcp` + `offline_access` | [Client Config](references/client-configuration.md) |
| **VS Code Copilot** | Add `"type": "http"` entry in `.vscode/mcp.json` | [Client Config](references/client-configuration.md) |
| **Testing Route** | Send `POST` with `Accept: application/json, text/event-stream` | [Testing & Debugging](references/testing-and-debugging.md) |

---

## Common Pitfalls & Mistakes

### 1. `406 Not Acceptable` Error
- **Symptom**: Client requests to `/api/mcp` fail with HTTP 406.
- **Cause**: The MCP Streamable HTTP specification mandates that the client `Accept` header contains both `application/json` and `text/event-stream`.
- **Fix**: In tests and client configurations, always specify `Accept: application/json, text/event-stream`. In route handlers, normalize `Accept` if client passes `*/*`.

### 2. `415 Unsupported Media Type` on Probes
- **Symptom**: Automated client health probes or gateway requests fail with HTTP 415.
- **Cause**: `@modelcontextprotocol/server` strictly validates `Content-Type: application/json` on incoming POST requests.
- **Fix**: In `app/api/mcp/route.ts`, normalize incoming headers before calling `mcpHandler` if `content-type` is omitted or empty.

### 3. Missing `offline_access` Causes Gemini Account Linking Failure
- **Symptom**: Google Gemini reports: *"Account linking is required to use this custom app. Please try again."*
- **Cause**: Gemini mandates a `refresh_token` in the OAuth token response. If the OAuth server is not asked for `offline_access`, it returns only an access token.
- **Fix**: Advertise `"offline_access"` in `scopes_supported` in RFC 9728 (`/.well-known/oauth-protected-resource`) and RFC 8414 metadata.

### 4. Supabase GoTrue HTTP 500 `Error generating ID token`
- **Symptom**: Token exchange fails with HTTP 500 when Gemini or Claude connects via OAuth.
- **Cause**: GoTrue enforces asymmetric keys (`ES256` or `RS256`) for signing OIDC `id_token`. Legacy Supabase projects using symmetric `HS256` shared secret throw an internal error.
- **Fix**: Open Supabase Dashboard (**Project Settings > JWT Signing Keys**) and migrate/rotate to `ES256` or `RS256` asymmetric keys.

### 5. Silent Auth Downgrade on Invalid Bearer Tokens
- **Symptom**: Calling tools with an expired or forged token runs as Guest instead of returning 401.
- **Cause**: In `withMcpAuth` with `{ required: false }`, returning `undefined` from `verifyToken` treats the request as unauthenticated.
- **Fix**: If an `Authorization: Bearer <token>` header is present but the token is invalid, throw `new OAuthError(OAuthErrorCode.InvalidToken, "...")`. Only return `undefined` when no auth header was provided.

### 6. Server Component SSR Crash from `"use client"` Helpers (`buttonVariants`)
- **Symptom**: Next.js 16 throws `Error: Attempted to call buttonVariants() from the server but buttonVariants is on the client` during SSR of 404 or error pages.
- **Cause**: Pure functions (like CVA variants) exported from files with `"use client"` cannot be invoked during Server Component rendering.
- **Fix**: Extract pure CVA helper functions to a separate directive-free `.ts` file (`components/ui/button-variants.ts`).

### 7. Arcjet WAF Bot Detection Blocking MCP Clients
- **Symptom**: MCP clients receive HTTP 403 Forbidden on `/api/mcp`.
- **Cause**: Automated CLI clients (`curl`, `mcp-remote`, Claude, Gemini) trigger bot heuristics in WAF middleware (`detectBot`).
- **Fix**: Bypass `detectBot` for `/api/mcp` and `/.well-known/*` while keeping WAF `shield` active.

### 8. Strict Slug / Key Mismatches on LLM Inputs
- **Symptom**: Queries for valid items return empty results (`total: 0`).
- **Cause**: LLMs generate natural-language strings (e.g. `"Spring Boot"`, `"Mercedes Benz"`) rather than internal kebab-case keys (`"spring-boot"`, `"mercedes-benz"`).
- **Fix**: Implement an input normalizer in tool handlers to resolve natural language and aliases to internal database keys before filtering.

---

## Detailed References

- [Tools, Resources, and Prompts Guide](references/tools-and-resources.md) — API contracts, Zod schemas, and `AsyncLocalStorage` Server Action reuse.
- [Authentication and Security Guide](references/authentication-and-security.md) — `withMcpAuth` v2, dual-mode auth, and strict RFC 9728 error handling.
- [OAuth 2.1 and OpenID Connect Guide](references/oauth-and-oidc.md) — Universal OAuth 2.1, RFC 7591 Dynamic Client Registration, Supabase GoTrue IdP, and consent UI.
- [Client Configuration Guide](references/client-configuration.md) — Connecting Google Gemini, Claude Desktop/Web, VS Code Copilot, Cursor, and Windsurf.
- [Testing and Debugging Guide](references/testing-and-debugging.md) — Vitest test recipes for tools, route handlers, probes, discovery endpoints, and curl inspection.
