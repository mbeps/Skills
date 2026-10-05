# Authentication and Security for Next.js MCP Servers

This reference details security patterns, token authorization, Client ID Metadata Documents (CIMD), and RFC 9728 compliance when securing Model Context Protocol servers in Next.js.

---

## 1. Public vs. Authenticated Endpoints

- **Public Endpoints**: For open portfolios, documentation hubs, or publicly queryable APIs, serve the MCP route without authentication. The handler remains stateless and scalable.
- **Authenticated Endpoints**: For private datasets, customer accounts, database mutations, or internal tooling, wrap the handler using `withMcpAuth`.

---

## 2. Using `withMcpAuth`

`mcp-handler` provides `withMcpAuth` to verify Bearer tokens and automatically issue RFC 9728-compliant `WWW-Authenticate` challenges (401/403).

### Signature
```typescript
withMcpAuth(
  handler: (req: Request) => Promise<Response>,
  verifyToken: (token: string, req: Request) => Promise<AuthInfo | null>,
  options?: {
    required?: boolean;
    resourceMetadataUrl?: string;
  }
): (req: Request) => Promise<Response>
```

### Next.js Route Handler Implementation

```typescript
// app/api/mcp/route.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerAllTools } from "@/lib/mcp/register-tools";

const baseHandler = createMcpHandler((server) => {
  registerAllTools(server);
});

// Custom token verification logic (e.g. JWT or database API key)
async function verifyBearerToken(token: string, req: Request) {
  if (token === process.env.MCP_API_KEY) {
    return {
      userId: "admin",
      scopes: ["read", "write"],
    };
  }

  // Example JWT or third-party auth check (Clerk / Supabase / Stytch)
  try {
    const payload = await verifyJwt(token);
    return {
      userId: payload.sub,
      scopes: payload.scopes ?? ["read"],
    };
  } catch {
    return null; // Invalid token -> triggers 401
  }
}

const secureHandler = withMcpAuth(baseHandler, verifyBearerToken, {
  required: true,
});

export { secureHandler as GET, secureHandler as POST };
```

---

## 3. Accessing Authentication Info inside Tools

In MCP SDK v2 and `mcp-handler` 2.x, authentication info returned by `verifyToken` is injected into the tool execution context under `extra`:

```typescript
server.registerTool(
  "delete_project",
  {
    description: "Delete a project (admin only)",
    inputSchema: z.object({ projectId: z.string() }),
  },
  async ({ projectId }, extra) => {
    // Auth info injected by withMcpAuth
    const auth = (extra as { authInfo?: { userId: string; scopes: string[] } }).authInfo;

    if (!auth?.scopes.includes("write")) {
      return {
        isError: true,
        content: [{ type: "text", text: "Forbidden: Missing 'write' scope." }],
      };
    }

    await db.project.delete({ where: { id: projectId } });
    return {
      content: [{ type: "text", text: `Project ${projectId} deleted.` }],
    };
  },
);
```

---

## 4. Client ID Metadata Documents (CIMD) & RFC 9728

The 2026-07-28 MCP specification deprecates legacy Dynamic Client Registration (DCR) in favor of **Client ID Metadata Documents (CIMD)**:
- OAuth clients identify themselves with an HTTPS URL pointing to their client metadata document.
- `withMcpAuth` answers missing or expired tokens with `WWW-Authenticate` response headers:
  ```http
  HTTP/1.1 401 Unauthorized
  WWW-Authenticate: Bearer error="invalid_token", resource_metadata="https://your-domain.com/.well-known/oauth-protected-resource"
  ```
- Clients inspect this document to discover supported authorization servers and initiate user authentication.

---

## 5. Security Best Practices

1. **Input Sanitization**: Always validate tool inputs with Zod schemas. Do not pass raw strings directly to shell or database queries without escaping/parameterization.
2. **Never Return Environment Secrets**: Ensure tools that return configuration or file contents never expose `.env*`, API keys, or private keys.
3. **Rate Limiting**: For public servers deployed to Vercel or cloud hosts, configure rate limiting (e.g. `@upstash/ratelimit` or edge middleware) to protect against agent runaway loops.
4. **CORS / Host Headers**: `mcp-handler` automatically verifies host and origin headers against allowed patterns. For multi-tenant setups, configure allowed origins explicitly in handler options.
