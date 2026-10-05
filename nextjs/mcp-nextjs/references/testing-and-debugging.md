# Testing and Debugging Next.js MCP Servers

This reference details testing patterns with Vitest, curl inspection techniques, and solutions for common HTTP errors encountered when building MCP servers in Next.js.

---

## 1. Unit Testing Tools Directly

Testing tool logic in isolation without spinning up HTTP servers provides fast feedback loops:

```typescript
// __tests__/mcp/tools.test.ts
import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { registerProjectTools } from "@/lib/mcp/tools/projects";

describe("MCP Project Tools", () => {
  const server = new McpServer({ name: "test-server", version: "1.0.0" });
  registerProjectTools(server);

  // Access the registered tool handler from internal map
  const tool = (server as any)._registeredTools.list_projects;

  it("filters projects by category", async () => {
    const response = await tool.handler({
      category: "FullStack",
      limit: 5,
    });

    expect(response.content).toHaveLength(1);
    const data = JSON.parse(response.content[0].text);
    expect(data.total).toBeGreaterThan(0);
    expect(data.projects.length).toBeLessThanOrEqual(5);
  });
});
```

---

## 2. Testing Route Handlers with Vitest

Next.js App Router route handlers can be invoked directly by passing standard Web `Request` objects to the exported `POST` or `GET` functions.

### The Required `Accept` Header Rule
> [!IMPORTANT]
> The MCP Streamable HTTP specification requires the client to accept both `application/json` and `text/event-stream`. If this header is missing or incomplete, the server responds with **`406 Not Acceptable`**.

```typescript
// __tests__/app/api/mcp/route.test.ts
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";

function parseMcpResponse(text: string) {
  for (const line of text.split("\n")) {
    if (line.startsWith("data:")) {
      return JSON.parse(line.slice(5).trim());
    }
  }
  return JSON.parse(text);
}

describe("MCP Route Handler: /api/mcp", () => {
  const defaultHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream", // REQUIRED
  };

  it("handles initialize handshake", async () => {
    const request = new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = parseMcpResponse(await response.text());
    expect(data.result.serverInfo.name).toBe("personal-portfolio-mcp");
    expect(data.result.capabilities.tools).toBeDefined();
  });

  it("rejects request missing text/event-stream accept header with 406", async () => {
    const request = new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json", // Missing text/event-stream
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: {},
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(406);
  });
});
```

---

## 3. Manual Debugging with `curl`

When testing a running development server (`yarn dev` / `next dev`):

### Initialize Handshake
```bash
curl -i -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "curl-client", "version": "1.0.0" }
    }
  }'
```

---

## 4. Common Errors and Solutions

| Error Code / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **`406 Not Acceptable`** | Missing required `Accept` header. | Client must send `Accept: application/json, text/event-stream`. |
| **`405 Method Not Allowed` on GET** | Stateless Streamable HTTP does not support GET listeners without SSE channels. | Normal behavior for stateless 2026-07-28 servers. Use POST for RPC commands. |
| **`TS2339: Property ... does not exist`** | Schema shape mismatch or accessing properties outside inferred Zod types. | Ensure types imported match database records, and `inputSchema` uses `z.object({...})`. |
| **Client hangs on connection** | Client expecting stdio instead of Streamable HTTP. | Wrap HTTP endpoint with `mcp-remote` bridge (`npx -y mcp-remote <URL>`). |
