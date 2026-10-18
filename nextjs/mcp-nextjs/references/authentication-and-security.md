# Authentication and Security for Next.js MCP Servers

This reference details security patterns, token authorization, Client ID Metadata Documents (CIMD), and RFC 9728 compliance when securing Model Context Protocol servers in Next.js.

---

## 1. Authentication Middleware Options

Two primary middleware patterns exist for Next.js MCP servers:
- **`requireMcpAuth` (`@better-auth/mcp`)** — Native middleware for applications using Better Auth as an OAuth 2.1 Provider. Automatically verifies JWKS signatures, checks resource audience binding, extracts `tokenClaims`, and issues RFC 9728 challenges.
- **`withMcpAuth` (`mcp-handler`)** — Generalized wrapper for custom token verification or external IdPs (e.g. Supabase GoTrue, Auth0).

---

## 2. Using Better Auth `requireMcpAuth` (Recommended for Better Auth)

In Better Auth setups, wrap your Next.js route handler at `app/api/mcp/route.ts` with `requireMcpAuth`:

### Signature
```typescript
requireMcpAuth(
  auth: BetterAuthInstance,
  handler: (request: Request, tokenClaims?: Record<string, unknown>) => Promise<Response>,
  options?: {
    resource?: string; // Canonical URL of the protected resource, e.g. "https://example.com/api/mcp"
  }
): (req: Request) => Promise<Response>
```

### Complete Implementation (`app/api/mcp/route.ts`)

> [!IMPORTANT]
> **Unified GET & POST Authentication**:
> Some MCP clients (e.g., Claude's `mcp-remote` bridge and Google Gemini) send `GET` probes before establishing sessions. Guard **both** `POST` and `GET` through `requireMcpAuth`. Bypassing `GET` with a raw 405 Method Not Allowed prevents clients from receiving the RFC 9728 `WWW-Authenticate` challenge required to launch the browser OAuth flow.

```typescript
// app/api/mcp/route.ts
export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth/auth";
import { requireMcpAuth } from "@better-auth/mcp";
import { mcpServerHandler } from "@/lib/mcp/server";
import { getMcpResourceUrl } from "@/lib/auth/auth-url";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, mcp-session-id, DPoP",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const resource = getMcpResourceUrl();

const protectedMcpHandler = requireMcpAuth(
  auth,
  async (request, tokenClaims) => {
    // 1. Normalize missing Content-Type or Accept headers before forwarding to MCP SDK
    const contentType = request.headers.get("content-type");
    const accept = request.headers.get("accept");
    let requestToHandle = request;

    const needsContentType = !contentType || !contentType.toLowerCase().includes("application/json");
    const needsAccept = !accept || accept === "*/*" || accept.trim() === "";

    if (needsContentType || needsAccept) {
      const newHeaders = new Headers(request.headers);
      if (needsContentType) newHeaders.set("content-type", "application/json");
      if (needsAccept) newHeaders.set("accept", "application/json, text/event-stream");
      requestToHandle = new Request(request, { headers: newHeaders });
    }

    // 2. Map verified tokenClaims into authInfo for tool execution context
    const authInfo = {
      userId: tokenClaims?.sub as string | undefined,
      sub: tokenClaims?.sub as string | undefined,
      clientId: tokenClaims?.client_id as string | undefined,
      scopes: tokenClaims?.scope ? String(tokenClaims.scope).split(" ") : [],
    };

    return await mcpServerHandler.fetch(requestToHandle, { authInfo } as any);
  },
  { resource },
);

export async function POST(req: Request) {
  return withCors(await protectedMcpHandler(req));
}

export async function GET(req: Request) {
  return withCors(await protectedMcpHandler(req));
}
```

---

## 3. Using `withMcpAuth` (Custom & Dual-Mode Auth)

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

## 4. Strict RFC 9728 Bearer Token Handling & Dual-Mode Auth

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

## 5. Clerk Bearer Token Authentication (Direct & Dual-Token Mode)

When using Clerk as your identity provider, incoming requests can carry either a direct Clerk session JWT or an internal OAuth 2.1 access token minted by your application's OAuth server.

```typescript
// lib/mcp/auth.ts
import { createClerkClient, verifyToken } from "@clerk/nextjs/server";
import { type AuthInfo, OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { verifyAccessToken } from "@/lib/mcp/oauth"; // internal OAuth 2.1 token verifier

export interface McpAuthInfo extends AuthInfo {
  extra: {
    userId: string;
  };
}

export const MCP_SCOPES = ["openid", "profile", "email", "offline_access"] as const;

export async function verifyMcpToken(
  req: Request,
  bearerToken?: string,
): Promise<McpAuthInfo | undefined> {
  const url = new URL(req.url);
  const isAuthRequired = url.searchParams.get("auth") === "required";

  if (!bearerToken) {
    if (isAuthRequired) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Authentication required");
    }
    return undefined; // Guest mode
  }

  // 1. Try verifying as an internal OAuth 2.1 access token
  const oauthPayload = verifyAccessToken(bearerToken);
  if (oauthPayload) {
    let clerkToken: string | undefined;
    if (oauthPayload.sessionId) {
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        const sessionToken = await clerk.sessions.getToken(oauthPayload.sessionId, "convex");
        clerkToken = sessionToken?.jwt;
      } catch {
        // Fall back gracefully to bearerToken
      }
    }

    return {
      token: clerkToken ?? bearerToken,
      clientId: oauthPayload.clientId,
      scopes: [...MCP_SCOPES],
      extra: { userId: oauthPayload.sub },
    };
  }

  // 2. Fall back to verifying direct Clerk JWT
  try {
    const payload = await verifyToken(bearerToken, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const clientId = (payload as { azp?: string }).azp ?? payload.sub;

    return {
      token: bearerToken,
      clientId,
      scopes: [...MCP_SCOPES],
      extra: { userId: payload.sub },
    };
  } catch {
    throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid token");
  }
}
```

---

## 6. Browser GET Navigation Interception (`Accept: text/html`)

Direct browser visits to `/api/mcp` send `GET` requests with `Accept: text/html` without Streamable HTTP headers (`text/event-stream`). By default, the MCP SDK rejects these with HTTP 405 / JSON-RPC `-32000 Method not allowed`.

Intercepting browser requests to return an informative HTML status page provides a great developer experience:

```typescript
// app/api/mcp/route.ts
async function handleRequest(req: Request): Promise<Response> {
  const accept = req.headers.get("accept");

  // Intercept direct browser visits
  if (req.method === "GET" && accept?.includes("text/html")) {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MCP Server Endpoint</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; }
    .card { max-width: 480px; padding: 2rem; background: #fff; border-radius: 1rem; border: 1px solid #e5e5e5; text-align: center; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>MCP Server Endpoint</h1>
    <p>This endpoint serves Model Context Protocol Streamable HTTP requests for AI assistants.</p>
    <p>Endpoint URL: <code>${req.url}</code></p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  // Forward valid MCP requests to authHandler
  return authHandler(req);
}
```

---

## 7. Per-Request Database Client Isolation

> [!CAUTION]
> **Cross-Request Token Contamination Vulnerability**:
> Reusing a singleton database client (e.g. `ConvexHttpClient` or ORM client) and calling `client.setAuth(token)` mutates global state. Under concurrent serverless requests, request B can execute queries using request A's authentication token, leading to severe tenant leakage.
>
> **Rule:** Always instantiate database clients per-request using a factory function with the request's verified token.

```typescript
// lib/mcp/db.ts
import { ConvexHttpClient } from "convex/browser";

export function createConvexClient(token?: string): ConvexHttpClient {
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) {
    client.setAuth(token);
  }
  return client;
}
```

---

## 8. Accessing Authentication Info inside Tools

In `@modelcontextprotocol/server` v2, context is passed as the second argument: `(args, ctx: ServerContext)`. Extract the user ID and token safely across both v2 `ctx.http` and legacy context shapes:

```typescript
// lib/mcp/auth-helpers.ts
export function getMcpUserId(ctx: unknown): string | undefined {
  const c = ctx as {
    http?: { authInfo?: { extra?: { userId?: string }; userId?: string } };
    authInfo?: { extra?: { userId?: string }; userId?: string };
  } | null | undefined;

  return (
    c?.http?.authInfo?.extra?.userId ??
    c?.authInfo?.extra?.userId ??
    c?.http?.authInfo?.userId ??
    c?.authInfo?.userId
  );
}

export function getMcpToken(ctx: unknown): string | undefined {
  const c = ctx as {
    http?: { authInfo?: { token?: string } };
    authInfo?: { token?: string };
  } | null | undefined;

  return c?.http?.authInfo?.token ?? c?.authInfo?.token;
}
```

### Authenticated Tool Implementation

```typescript
server.registerTool(
  "create_note",
  {
    title: "Create Note",
    description: "Creates a new note for the authenticated user",
    inputSchema: z.object({ title: z.string() }),
  },
  async ({ title }, ctx) => {
    const userId = getMcpUserId(ctx);
    const token = getMcpToken(ctx);

    if (!userId) {
      return {
        isError: true,
        content: [{ type: "text", text: "Unauthorized: Please sign in." }],
      };
    }

    const db = createConvexClient(token);
    const noteId = await db.mutation(api.notes.create, { title, userId });

    return {
      content: [{ type: "text", text: `Note created with ID: ${noteId}` }],
    };
  },
);
```

---

## 9. Universal OAuth 2.1 & OIDC Integration

For zero-configuration OAuth 2.1 authentication with Dynamic Client Registration (RFC 7591), Protected Resource Metadata (RFC 9728), Better Auth, Supabase GoTrue, or Clerk, see the dedicated reference:
👉 **[OAuth 2.1 & OpenID Connect Guide](oauth-and-oidc.md)**

---

## 10. Security Best Practices

1. **WAF & Bot Detection Bypass**: If using Web Application Firewalls like Arcjet (`detectBot`), bypass bot challenges for `/api/mcp` while keeping WAF `shield` inspection active. Legitimate MCP clients (`curl`, `mcp-remote`, Claude, Gemini) trigger bot heuristics.
2. **Input Sanitization**: Always validate tool inputs with Zod schemas. Parameterize database queries.
3. **Never Return Environment Secrets**: Filter out API keys, private tokens, or connection strings from tool return payloads.
4. **Defense-in-Depth**: Never rely solely on tool-level auth checks or database RLS if executing privileged external side effects. Always enforce role and user ownership verification in TypeScript (`note.userId === userId`).
5. **Never Trust User Metadata for Roles**: User-editable metadata can be forged. Always query authoritative database roles or protected claims.
