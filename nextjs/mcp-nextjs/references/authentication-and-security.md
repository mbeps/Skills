# Authentication and Security for Next.js MCP Servers

This reference details security patterns, token authorization, Client ID Metadata Documents (CIMD), and RFC 9728 compliance when securing Model Context Protocol servers in Next.js.

---

## 1. Public vs. Authenticated Endpoints

- **Public Endpoints**: For open portfolios, documentation hubs, or publicly queryable APIs, serve the MCP route without authentication. The handler remains stateless and scalable.
- **Authenticated Endpoints**: For private datasets, customer accounts, database mutations, or internal tooling, wrap the handler using `withMcpAuth`.

---

## 2. Using `withMcpAuth`

`mcp-handler` provides `withMcpAuth` to verify Bearer tokens and automatically issue RFC 9728-compliant `WWW-Authenticate` challenges (401/403).

### Signature (mcp-handler v2)
```typescript
withMcpAuth(
  handler: (req: Request) => Promise<Response>,
  verifyToken: (req: Request, bearerToken?: string) => Promise<AuthInfo | undefined>,
  options?: {
    required?: boolean;
    resourceMetadataPath?: string;
    resourceMetadataUrl?: string;
  }
): (req: Request) => Promise<Response>
```

> [!IMPORTANT]
> **Parameter Order**: In `mcp-handler` v2, `verifyToken` receives `req: Request` first and `bearerToken?: string` second.
> **AuthInfo Requirement**: In `@modelcontextprotocol/server`, `AuthInfo` must supply `{ clientId: string, token: string, scopes: string[], expiresAt?: number, extra?: Record<string, unknown> }`.

---

## 3. Strict RFC 9728 Bearer Token Handling & Dual-Mode Auth

When building servers that support both unauthenticated public access and privileged tools (Guest, User, Admin) on a single route:

1. **Configure `required: false`**: Allows requests without Bearer tokens to proceed as Guest.
2. **Never Silently Downgrade**: If an `Authorization: Bearer <token>` header is present but the token is invalid or expired, throw `new OAuthError(OAuthErrorCode.InvalidToken, "...")` from `@modelcontextprotocol/server`. If `verifyToken` returns `undefined` when `required: false`, `withMcpAuth` treats the request as unauthenticated Guest! Throwing `OAuthError` ensures `withMcpAuth` immediately returns an RFC 9728 `401 Unauthorized` with `WWW-Authenticate: Bearer error="invalid_token"`.
3. **On-Demand 401 Challenge (`?auth=required`)**: Clients like `mcp-remote`, Cursor, and Claude Desktop only initiate browser OAuth flows after receiving a 401 response on `initialize`. By checking `new URL(req.url).searchParams.get("auth") === "required"`, you can throw `OAuthError(OAuthErrorCode.InvalidToken, "Authentication required")` when unauthenticated, providing full OAuth triggering without breaking default Guest access.

### Route Handler Implementation

```typescript
// app/api/mcp/route.ts
import { mcpHandler } from "@/lib/mcp/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, HEAD",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, mcp-session-id, baggage, sentry-trace",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function POST(req: Request) {
  // Normalize missing Content-Type or Accept headers to avoid 415/406 on client probes
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");
  let requestToHandle = req;

  const needsContentType = !contentType || !contentType.toLowerCase().includes("application/json");
  const needsAccept = !accept || accept === "*/*" || accept.trim() === "";

  if (needsContentType || needsAccept) {
    const newHeaders = new Headers(req.headers);
    if (needsContentType) newHeaders.set("content-type", "application/json");
    if (needsAccept) newHeaders.set("accept", "application/json, text/event-stream");
    requestToHandle = new Request(req, { headers: newHeaders });
  }

  return withCors(await mcpHandler(requestToHandle));
}

export async function GET(req: Request) {
  return withCors(await mcpHandler(req));
}

export async function DELETE(req: Request) {
  return withCors(await mcpHandler(req));
}
```

---

## 4. Token Verification Logic (`verifyMcpToken`)

```typescript
// lib/mcp/auth.ts
import { type AuthInfo, OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";

export async function verifyMcpToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  // 1. Explicit Bearer token
  if (bearerToken) {
    const user = await validateToken(bearerToken);
    if (!user) {
      throw new OAuthError(
        OAuthErrorCode.InvalidToken,
        "Invalid or expired bearer token",
      );
    }

    return {
      clientId: user.id,
      token: bearerToken,
      scopes: user.role === "admin" ? ["user", "admin"] : ["user"],
      extra: { userId: user.id, role: user.role, email: user.email },
    };
  }

  // 2. Cookie session fallback (browser-based testing or web apps)
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const sessionUser = await getSessionFromCookies(cookieHeader);
    if (sessionUser) {
      return {
        clientId: sessionUser.id,
        token: "cookie-session",
        scopes: sessionUser.role === "admin" ? ["user", "admin"] : ["user"],
        extra: { userId: sessionUser.id, role: sessionUser.role },
      };
    }
  }

  // 3. On-demand 401 challenge for OAuth-initiated connections
  let isAuthRequired = false;
  try {
    isAuthRequired = new URL(req.url).searchParams.get("auth") === "required";
  } catch {
    // Relative URL in mock environment; fall through to guest
  }

  if (isAuthRequired) {
    throw new OAuthError(
      OAuthErrorCode.InvalidToken,
      "Authentication required",
    );
  }

  // 4. Guest mode
  return undefined;
}
```

---

## 5. Accessing Authentication Info inside Tools

In `@modelcontextprotocol/server` v2, tool callbacks take `(args, ctx: ServerContext)`. `mcp-handler` injects `req.auth` into `sdkHandler.fetch(req, { authInfo: req.auth })`, which exposes it at **`ctx.http?.authInfo`**:

```typescript
import type { ServerContext } from "@modelcontextprotocol/server";

export function getMcpAuth(ctx: unknown) {
  const context = ctx as { http?: { authInfo?: AuthInfo }; authInfo?: AuthInfo } | undefined;
  return context?.http?.authInfo?.extra ?? null;
}

server.registerTool(
  "delete_project",
  {
    description: "Delete a project (admin only)",
    inputSchema: z.object({ projectId: z.string() }),
  },
  async ({ projectId }, ctx: ServerContext) => {
    const auth = getMcpAuth(ctx);

    if (auth?.role !== "admin") {
      return {
        isError: true,
        content: [{ type: "text", text: "Forbidden: Admin role required." }],
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

## 6. Universal OAuth 2.1 & OIDC Integration

For zero-configuration OAuth 2.1 authentication with Dynamic Client Registration (RFC 7591), Protected Resource Metadata (RFC 9728), and full Supabase GoTrue IdP integration, see the dedicated reference:
👉 **[OAuth 2.1 & OpenID Connect Guide](oauth-and-oidc.md)**

---

## 7. Security Best Practices

1. **WAF & Bot Detection Bypass**: If using Web Application Firewalls like Arcjet (`detectBot`), bypass bot challenges for `/api/mcp` while keeping WAF `shield` inspection active. Legitimate MCP clients (`curl`, `mcp-remote`, Claude, Gemini) trigger bot heuristics.
2. **Input Sanitization**: Always validate tool inputs with Zod schemas. Parameterize database queries.
3. **Never Return Environment Secrets**: Filter out API keys, private tokens, or connection strings from tool return payloads.
4. **Defense-in-Depth**: Never rely solely on tool-level auth checks or database RLS if executing privileged external side effects (e.g. deleting S3/Storage buckets via admin service-role clients). Always enforce role verification in TypeScript.
5. **Never Trust User Metadata for Roles**: User-editable metadata (e.g. Supabase `user_metadata`) can be forged. Always query authoritative database roles or protected claims (`app_metadata`).
