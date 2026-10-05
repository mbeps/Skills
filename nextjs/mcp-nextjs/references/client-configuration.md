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

## 2. Gemini CLI

For clients supporting Streamable HTTP natively:

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

## 3. GitHub Copilot in VS Code (GHCP)

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

### Verification in VS Code
1. Open the **Output** panel (`Ctrl+Shift+U` / `Cmd+Shift+U`).
2. Select **MCP** or **GitHub Copilot** from the dropdown menu to inspect connection handshakes and tool registration logs.

---

## 4. Cursor & Windsurf

1. Open **Settings** -> **Features** -> **MCP Servers**.
2. Click **Add New MCP Server**.
3. Fill in the server details:
   - **Name**: `my-nextjs-app`
   - **Type**: `SSE` or `HTTP` (or `Command` with `npx -y mcp-remote <URL>`)
   - **URL**: `http://localhost:3000/api/mcp`
