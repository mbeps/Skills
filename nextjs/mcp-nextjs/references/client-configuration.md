# MCP Client Configuration Reference

This reference provides setup instructions for connecting Model Context Protocol (MCP) clients to Next.js Streamable HTTP servers.

---

## Transport Overview

Next.js route handlers serve **Streamable HTTP** (stateless HTTP with server-sent events per request).
- Clients that natively support remote HTTP endpoints (Gemini CLI, Cursor, Windsurf, VS Code Copilot) connect directly via the endpoint URL.
- Clients that only support local process stdin/stdout (`stdio`) transports (like standard Claude Desktop) require the [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridge.

---

## 1. Claude Desktop

Claude Desktop uses local processes defined in `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Configuration using `mcp-remote`
```json
{
  "mcpServers": {
    "my-nextjs-app": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/api/mcp"
      ]
    }
  }
}
```

*For deployed servers, replace `http://localhost:3000/api/mcp` with your production HTTPS URL.*

---

## 2. Google Gemini

Gemini supports MCP servers in two ways: via Gemini CLI/Developer API (direct HTTP), and via **Gemini Connected / Custom Apps** in the web interface.

### A. Gemini Connected Apps (Web & Mobile UI)
Gemini Web initiates an automated OAuth 2.1 handshake:
1. Queries `/.well-known/oauth-protected-resource` and path-scoped `/.well-known/oauth-protected-resource/api/mcp`.
2. Queries authorization server metadata and registers dynamically via RFC 7591 (`/api/oauth/register`).
3. Directs the user to the consent screen (`/oauth/consent`).

> [!IMPORTANT]
> **Mandatory `offline_access` Scope**:
> Gemini mandates a persistent `refresh_token` during the token exchange. If your metadata endpoints omit `"offline_access"` from `scopes_supported`, the authorization server omits the refresh token, and Gemini fails with:
> *"Account linking is required to use this custom app. Please try again."*
> Always ensure `"offline_access"` is advertised in RFC 9728 and RFC 8414 discovery.

### B. Gemini CLI
For local development or script-based invocation:
```json
{
  "mcpServers": {
    "my-nextjs-app": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

If passing a Bearer token:
```json
{
  "mcpServers": {
    "my-nextjs-app": {
      "url": "https://example.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SECRET_TOKEN"
      }
    }
  }
}
```

---

## 3. Claude Desktop & Claude Web

- **Guest Mode (Default)**: Claude connects and sends `initialize` without auth headers. When `withMcpAuth` has `{ required: false }`, public tools execute without error.
- **Triggering OAuth**: If using `mcp-remote` with authenticated tools, configure the URL as `https://example.com/api/mcp?auth=required`. The server returns an RFC 9728 `401 Unauthorized` challenge, prompting `mcp-remote` to open the browser OAuth login.

---

## 4. GitHub Copilot in VS Code (GHCP)

VS Code supports MCP servers for GitHub Copilot in `.vscode/mcp.json` or globally via the Command Palette.

### Option A: Direct HTTP (`.vscode/mcp.json`)
Create `.vscode/mcp.json` at the workspace root:

```json
{
  "servers": {
    "my-nextjs-app": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

### Option B: Via `mcp-remote`
```json
{
  "servers": {
    "my-nextjs-app": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"]
    }
  }
}
```

---

## 5. Cursor & Windsurf

1. Open **Settings** -> **Features** -> **MCP Servers**.
2. Click **Add New MCP Server**.
3. Fill in the server details:
   - **Name**: `my-nextjs-app`
   - **Type**: `SSE` or `HTTP`
   - **URL**: `http://localhost:3000/api/mcp` (or `http://localhost:3000/api/mcp?auth=required` to force login challenge)

---

## 6. ChatGPT & Custom GPTs

ChatGPT connects to external services using OpenID Connect (OIDC) and OAuth 2.0:
- Point ChatGPT Actions / OAuth settings to your Next.js domain (`https://your-domain.com`).
- Discovery endpoints (`/.well-known/openid-configuration`, `/.well-known/jwks.json`, and `/api/oauth/token`) resolve automatically.
- Authorize via your `/oauth/consent` page.

---

## 7. Client Permission & Approval Lifecycles

Most chat interfaces (Claude, Gemini, VS Code Copilot) enforce permission checks before executing remote MCP tools:

- **Interactive Approval Banner**: On first invocation, the UI prompts the user to `Allow` or `Deny` tool access.
- **Pending Execution Fallback**: Until `Allow` is clicked, the tool returns nothing. Chat models may print a disclaimer (e.g., *"I do not have access to read..."*) assuming external tools were denied or unavailable.
- **Always-Allow Settings**: To prevent interruptions during iterative workflows, check your client's settings (e.g. VS Code MCP tool permissions or Gemini Workspace security rules) to grant auto-approval for trusted local endpoints (`localhost:3000`).

