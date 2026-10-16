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

  it("handles initialize handshake with 2024-11-05 protocol version", async () => {
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
    expect(data.result.serverInfo.name).toBeDefined();
    expect(data.result.capabilities.tools).toBeDefined();
  });

  it("returns HTTP 401 challenge on unauthenticated POST", async () => {
    const request = new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const authHeader = response.headers.get("www-authenticate");
    expect(authHeader).toContain("Bearer resource_metadata=");
    // Ensure no double slashes in resource_metadata URL
    expect(authHeader).not.toMatch(/\/api\/mcp/g);
  });

  it("returns HTTP 401 challenge on unauthenticated GET probes", async () => {
    const { GET } = await import("@/app/api/mcp/route");
    const request = new Request("http://localhost:3000/api/mcp", {
      method: "GET",
      headers: { Accept: "application/json, text/event-stream" },
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer resource_metadata=");
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

  it("handles OPTIONS CORS preflight with 204", async () => {
    const { OPTIONS } = await import("@/app/api/mcp/route");
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("handles HEAD health probes with 200", async () => {
    const { HEAD } = await import("@/app/api/mcp/route");
    const response = await HEAD();
    expect(response.status).toBe(200);
  });

  it("normalizes requests missing Content-Type to avoid 415 errors", async () => {
    const request = new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        // Content-Type omitted
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/list",
        params: {},
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

---

## 3. Unit Testing Token Verification (`verifyMcpToken`)

Test auth logic directly to ensure no regressions between Guest, User, and Admin tiers:

```typescript
// __tests__/mcp/auth.test.ts
import { describe, expect, it } from "vitest";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { verifyMcpToken } from "@/lib/mcp/auth";

describe("verifyMcpToken", () => {
  it("returns undefined for unauthenticated requests (Guest mode)", async () => {
    const req = new Request("http://localhost:3000/api/mcp", { method: "POST" });
    const authInfo = await verifyMcpToken(req, undefined);
    expect(authInfo).toBeUndefined();
  });

  it("throws OAuthError(InvalidToken) on explicit invalid Bearer token", async () => {
    const req = new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer invalid-token" },
    });

    await expect(verifyMcpToken(req, "invalid-token")).rejects.toThrow(OAuthError);
  });

  it("throws OAuthError on ?auth=required when unauthenticated", async () => {
    const req = new Request("http://localhost:3000/api/mcp?auth=required", { method: "POST" });
    await expect(verifyMcpToken(req, undefined)).rejects.toThrowError("Authentication required");
  });
});
```

---

## 4. Testing OAuth Discovery Endpoints

```typescript
// __tests__/api/oauth/discovery.test.ts
import { describe, expect, it } from "vitest";
import { GET as getProtectedResource } from "@/app/.well-known/oauth-protected-resource/[[...resource]]/route";
import { GET as getAuthServer } from "@/app/.well-known/oauth-authorization-server/[[...resource]]/route";

describe("OAuth Discovery Endpoints", () => {
  it("advertises offline_access in protected resource metadata", async () => {
    const req = new Request("http://localhost:3000/.well-known/oauth-protected-resource/api/mcp");
    const res = await getProtectedResource(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.scopes_supported).toContain("offline_access");
    expect(data.authorization_servers.length).toBeGreaterThan(0);
  });

  it("returns registration_endpoint in authorization server metadata", async () => {
    const res = await getAuthServer();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.registration_endpoint).toBeDefined();
    expect(data.scopes_supported).toContain("offline_access");
  });
});
```

---

## 5. Manual Debugging with `curl`

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

### Discovery Endpoints Probe
```bash
# RFC 9728 Protected Resource Metadata
curl -i http://localhost:3000/.well-known/oauth-protected-resource/api/mcp

# RFC 8414 Authorization Server Metadata
curl -i http://localhost:3000/.well-known/oauth-authorization-server

# JWKS Keys
curl -i http://localhost:3000/.well-known/jwks.json
```

---

## 6. Common Errors and Solutions

| Error Code / Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **`HTTP 400 Bad Request: "Unsupported protocol version: 2024-11-05"`** | `createMcpHandler` was configured with `{ legacy: "reject" }`, which rejects AI clients (Gemini, Claude, ChatGPT) sending `2024-11-05` without `_meta` claims. | Use `{ legacy: "stateless" }` in `createMcpHandler` options to support `2024-11-05` traffic. |
| **`HTTP 308 Permanent Redirect` on discovery** | Trailing slash in `BETTER_AUTH_URL` created double slashes (`//api/mcp`) in `resource_metadata` challenge. AI clients reject redirects. | Normalize URLs with `getSiteUrl()` to strip trailing slashes before concatenating paths. |
| **`HTTP 404 Not Found` on Gemini discovery** | Issuer has path (`/api/auth`). Gemini queries RFC 8414 Section 3 path `/.well-known/oauth-authorization-server/api/auth`. | Create `app/.well-known/oauth-authorization-server/[[...path]]/route.ts` proxying to `auth.handler()`. |
| **`HTTP 404 Not Found` on ChatGPT discovery** | ChatGPT queries root `/.well-known/openid-configuration`. | Create `app/.well-known/openid-configuration/route.ts` proxying to `auth.handler()`. |
| **`415 Unsupported Media Type`** | Client omitted `Content-Type: application/json` on POST request. | Normalize incoming request headers in the route handler before calling `mcpHandler`. |
| **`406 Not Acceptable`** | Missing required `Accept` header. | Client must send `Accept: application/json, text/event-stream`. |
| **`405 Method Not Allowed` on GET probes** | MCP clients (Claude `mcp-remote`, Gemini) probe GET before POST. | Guard both `GET` and `POST` with `requireMcpAuth` to return 401 challenge instead of 405. |
| **`HTTP 500 Error generating ID token`** | Supabase GoTrue project uses legacy symmetric `HS256` key. OIDC ID token generation requires asymmetric keys. | Rotate JWT keys to `ES256` or `RS256` in Supabase Dashboard (**Project Settings > JWT Signing Keys**). |
| **"Account linking is required" in Gemini** | Discovery metadata omitted `"offline_access"` scope, so no `refresh_token` was returned. | Add `"offline_access"` to `scopes_supported` in RFC 9728 and RFC 8414 discovery endpoints. |
| **Silent Auth Downgrade to Guest** | `verifyToken` returned `undefined` on invalid bearer token with `{ required: false }`. | Throw `OAuthError(OAuthErrorCode.InvalidToken)` when a bearer token is present but invalid/expired. |
| **Consent Page prerender bailout build error** | `useSearchParams()` was called without Suspense boundary in Next.js App Router. | Wrap search-param consuming component inside `<Suspense>`. |
| **Server Component crash: `Attempted to call buttonVariants()`** | Pure function exported from a file with `"use client"` imported in SSR error/not-found page. | Extract pure helper functions to a separate file without `"use client"` (e.g. `button-variants.ts`). |
| **Arcjet WAF blocks MCP clients (403)** | Bot detection (`detectBot`) triggers on automated CLI or agent probes. | Bypass `detectBot` for `/api/mcp` while keeping WAF `shield` active. |
| **Tool returns empty list (`total: 0`)** | LLM passed natural language string (e.g. `"Spring Boot"`) against strict slug matching (`"spring-boot"`). | Implement flexible input normalization (`resolveItemKey`) to match canonical IDs. |
| **LLM says "I do not have direct access..."** | Client UI intercepted tool call with an unapproved confirmation dialog (`Allow` / `Deny`). | User must click `Allow` in client UI before the tool request is dispatched to the server. |

---

## 7. Client Tool Permission Interception

When integrating with conversational AI clients (such as Gemini or Claude), clients typically require explicit user permission before executing tools that fetch external data.

### Symptoms
- The client UI renders an interactive confirmation prompt:
  ```text
  Let Gemini use "<tool_name>" from <Server Name>
  Tool: <tool_name>
  [Deny]  [Allow]
  ```
- The model outputs a generic fallback response:
  > *"You referenced @ServerName, but I do not have direct access to read the contents... Please provide..."*

### Diagnosis & Remedy
1. **Not a server error**: The Next.js route handler was never called because the client paused execution awaiting user consent.
2. **Action required**: Clicking **`Allow`** dispatches the request to `/api/mcp` and feeds the result back to the LLM.
3. **Auto-approval configuration**: In client settings or workspace policies, configure trusted tools or servers to bypass manual per-invocation approvals if permitted.

