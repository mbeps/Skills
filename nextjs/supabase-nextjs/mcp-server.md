# MCP Server & OAuth 2.1 Integration: Supabase × Next.js

> Prerequisite: read `SKILL.md` and `authentication.md` first. This guide explains how to expose your Supabase-backed Next.js application as a remote **Model Context Protocol (MCP)** server authenticated via Supabase's native **OAuth 2.1 & OpenID Connect (OIDC)** identity provider.

---

## 1. Architecture Overview

Exposing an MCP server directly within the Next.js App Router (`app/api/mcp/route.ts`) lets AI clients (Google Gemini, Claude Desktop/Web, Cursor, VS Code Copilot) query application data, trigger Server Actions, and execute database operations under genuine Supabase Postgres RLS.

```mermaid
sequenceDiagram
    autonumber
    participant Client as MCP Client (Gemini / Claude / Cursor)
    participant Proxy as proxy.ts (WAF / Edge)
    participant Next as Next.js MCP Server (/api/mcp)
    participant Supa as Supabase GoTrue (OAuth 2.1 IdP)
    participant DB as Postgres (with RLS)

    Note over Client,Supa: Phase 1: Universal Discovery & Dynamic Client Registration (RFC 9728 / 8414 / 7591)
    Client->>Next: GET /.well-known/oauth-protected-resource(/api/mcp)
    Next-->>Client: 200 OK (authorization_servers, scopes: openid, email, profile, offline_access)
    Client->>Next: GET /.well-known/oauth-authorization-server
    Next-->>Client: 200 OK (endpoints, registration_endpoint)
    Client->>Next: POST /api/oauth/register (RFC 7591 DCR)
    Next->>Supa: Register client
    Next-->>Client: 201 Created (client_id, redirect_uris)

    Note over Client,Next: Phase 2: Authorization & Next.js Consent Screen
    Client->>Supa: Browser redirect to /auth/v1/oauth/authorize
    Supa->>Next: Redirect to /oauth/consent?authorization_id=<uuid>
    alt User unauthenticated
        Next->>Next: Redirect to /sign-in?redirect=/oauth/consent...
        Next->>Next: User logs in (Email/Password or Social OAuth)
    end
    Next->>Supa: supabase.auth.oauth.getAuthorizationDetails(authorizationId)
    Next->>Next: Render consent card; user clicks "Allow Access"
    Next->>Supa: supabase.auth.oauth.approveAuthorization(authorizationId)
    Supa-->>Next: { redirect_url: "<callback>?code=...&state=..." }
    Next->>Client: Redirect to client callback

    Note over Client,Supa: Phase 3: Token Exchange & ID Token Verification
    Client->>Next: POST /api/oauth/token (code + code_verifier)
    Next->>Supa: Forward to /auth/v1/oauth/token
    Supa-->>Client: 200 OK (access_token, refresh_token, id_token signed with ES256)
    Client->>Next: GET /.well-known/jwks.json (verify id_token)
    Next-->>Client: 200 OK (public keys)

    Note over Client,DB: Phase 4: Authenticated MCP Execution
    Client->>Proxy: POST /api/mcp (Authorization: Bearer <access_token>)
    Proxy->>Next: Bypass detectBot; evaluate WAF shield
    Next->>Supa: supabase.auth.getUser(access_token) + Role lookup
    Next->>DB: Execute existing Server Actions in AsyncLocalStorage (evaluating auth.uid())
    DB-->>Next: Query results respecting Postgres RLS
    Next-->>Client: JSON-RPC CallToolResult
```

---

## 2. Supabase OAuth 2.1 Server Configuration

Supabase Auth includes a built-in, headless OAuth 2.1 server.

### Local Configuration (`supabase/config.toml`)
```toml
[auth.oauth_server]
# Enable OAuth 2.1 server
enabled = true

# Path where Supabase redirects users for consent approval
authorization_url_path = "/oauth/consent"

# Allow automated clients (Gemini, MCP tools) to register dynamically
allow_dynamic_registration = true
```

### Supabase Cloud Dashboard
1. Open **Authentication > OAuth Server**.
2. Enable **OAuth Server** and **Dynamic Client Registration**.
3. Set **Authorization URL Path** to `/oauth/consent`.

---

## 3. The GoTrue Asymmetric Key (ES256/RS256) Mandate

> [!CAUTION]
> **HTTP 500 `Error generating ID token` in GoTrue**:
> When clients like Google Gemini, Claude, or ChatGPT initiate OAuth, they mandate the `openid` scope, requiring GoTrue to issue an OIDC `id_token`.
> GoTrue source code strictly enforces that ID tokens **must be signed with asymmetric keys** (`ES256` or `RS256`). If the Supabase project uses legacy symmetric `HS256` (shared secret), GoTrue throws `HS256 is not supported for ID token signing` and aborts the token exchange with HTTP 500.

### Resolution
1. Open Supabase Dashboard: **Project Settings > JWT Signing Keys**.
2. Click **Migrate JWT secret** (generates a standby `ES256` key pair).
3. Click **Rotate keys** to promote `ES256` to the active signing key.
4. Verify by checking `/.well-known/jwks.json`:
   ```bash
   curl https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
   ```
   Must return an array containing `{"kty": "EC", "crv": "P-256", "alg": "ES256", ...}`.

---

## 4. Stateless Token Client & `AsyncLocalStorage`

### A. The Stateless Token Client Factory
Unlike browser or SSR server clients that read cookies, an MCP server operates on explicit Bearer JWTs.

```typescript
// lib/supabase/token-client.ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export const createTokenClient = (accessToken: string) => {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
};
```

**Why this works:**
- Passing `Authorization: Bearer <token>` in `global.headers` sets `hasCustomAuthorizationHeader = true` in GoTrueClient.
- `supabase.auth.getUser(token)` and PostgREST RLS queries (`auth.uid()`, `is_admin()`) automatically authenticate against this Bearer token.
- Disabling session persistence prevents illegal cookie write attempts in stateless route handlers.

### B. Zero-Duplication Server Action Reuse (`AsyncLocalStorage`)
Instead of duplicating database queries and validations inside MCP tool definitions, wrap the MCP handler with Node's native `AsyncLocalStorage` (`node:async_hooks`):

```typescript
// lib/supabase/storage.ts
import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

const mcpSupabaseStorage = new AsyncLocalStorage<SupabaseClient>();

export function runWithMcpSupabase<T>(
  client: SupabaseClient,
  fn: () => Promise<T>,
): Promise<T> {
  return mcpSupabaseStorage.run(client, fn);
}

export function getMcpSupabase(): SupabaseClient | undefined {
  return mcpSupabaseStorage.getStore();
}
```

In your standard server client factory:
```typescript
// lib/supabase/server.ts
import { cookies } from "next/headers";
import { getMcpSupabase } from "./storage";

export const createClient = async () => {
  // If running inside an MCP request, return the request's bound client!
  const mcpClient = getMcpSupabase();
  if (mcpClient) return mcpClient;

  // Otherwise, standard Next.js cookie session
  const cookieStore = await cookies();
  return createServerClient(...);
};
```

---

## 5. Token Verifier & Dual-Mode Auth (`lib/mcp/auth.ts`)

Support both unauthenticated Guest users and authenticated Users/Admins over a single route:

```typescript
// lib/mcp/auth.ts
import { type AuthInfo, OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import { createClient } from "@/lib/supabase/server";
import { createTokenClient } from "@/lib/supabase/token-client";

export async function verifyMcpToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  // Case 1: Bearer token provided
  if (bearerToken) {
    const supabase = createTokenClient(bearerToken);
    const { data: { user }, error } = await supabase.auth.getUser(bearerToken);

    if (error || !user) {
      // Must throw OAuthError to return HTTP 401 with WWW-Authenticate challenge.
      // Returning undefined would silently downgrade the caller to Guest!
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid or expired bearer token");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "user";

    return {
      clientId: user.id,
      token: bearerToken,
      scopes: role === "admin" ? ["user", "admin"] : ["user"],
      extra: { userId: user.id, role, supabase },
    };
  }

  // Case 2: Cookie session fallback (browser testing)
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return {
          clientId: user.id,
          token: "cookie-session",
          scopes: ["user"],
          extra: { userId: user.id, role: "user", supabase },
        };
      }
    } catch {
      // Fall through to guest
    }
  }

  // Case 3: On-demand 401 challenge (?auth=required)
  let isAuthRequired = false;
  try {
    isAuthRequired = new URL(req.url).searchParams.get("auth") === "required";
  } catch {
    // Relative URL in test environment
  }

  if (isAuthRequired) {
    throw new OAuthError(OAuthErrorCode.InvalidToken, "Authentication required");
  }

  // Case 4: Unauthenticated Guest access
  return undefined;
}
```

---

## 6. Route Handler & MCP Server Setup

### A. MCP Server Setup (`lib/mcp/server.ts`)
```typescript
// lib/mcp/server.ts
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "./auth";
import { registerAllTools } from "./register-tools";
import { runWithMcpSupabase } from "@/lib/supabase/storage";
import { createPublicClient } from "@/lib/supabase/public";

const baseHandler = createMcpHandler(
  (server) => registerAllTools(server),
  { serverInfo: { name: "my-app-mcp", version: "1.0.0" } }
);

const scopedHandler = async (req: Request): Promise<Response> => {
  const authContext = req.auth?.extra as { supabase?: SupabaseClient } | undefined;
  const client = authContext?.supabase ?? createPublicClient();
  return runWithMcpSupabase(client, () => baseHandler(req));
};

export const mcpHandler = withMcpAuth(scopedHandler, verifyMcpToken, {
  required: false,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});
```

### B. Next.js Route Handler (`app/api/mcp/route.ts`)
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
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
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

## 7. Next.js Consent Screen (`/oauth/consent`)

Supabase redirects the user to `/oauth/consent?authorization_id=<uuid>`.

```typescript
// hooks/use-oauth-consent.ts
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export function useOAuthConsent(authorizationId: string | null) {
  const router = useRouter();
  const [details, setDetails] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error">("loading");

  useEffect(() => {
    if (!authorizationId) {
      setStatus("error");
      return;
    }

    const supabase = createBrowserClient();

    async function load() {
      // 1. Ensure user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const returnUrl = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        router.push(`/sign-in?redirect=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // 2. Fetch authorization details
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) {
        setStatus("error");
        return;
      }

      // If user previously granted consent, auto-redirect immediately:
      if ("redirect_url" in data) {
        window.location.assign(data.redirect_url);
        return;
      }

      setDetails(data);
      setStatus("ready");
    }

    load();
  }, [authorizationId, router]);

  const handleApprove = async () => {
    setStatus("submitting");
    const supabase = createBrowserClient();
    const { data } = await supabase.auth.oauth.approveAuthorization(authorizationId!, {
      skipBrowserRedirect: true,
    });
    if (data?.redirect_url) window.location.assign(data.redirect_url);
  };

  const handleDeny = async () => {
    setStatus("submitting");
    const supabase = createBrowserClient();
    const { data } = await supabase.auth.oauth.denyAuthorization(authorizationId!, {
      skipBrowserRedirect: true,
    });
    if (data?.redirect_url) window.location.assign(data.redirect_url);
  };

  return { details, status, handleApprove, handleDeny };
}
```

---

## 8. Preserving Redirect Parameters & Open Redirect Defense

When an unauthenticated user hits `/oauth/consent?authorization_id=<uuid>`, they navigate to `/sign-in`.
If the redirect query string is interpolated raw (e.g. `redirectTo: ${siteUrl}/auth/callback?redirect=${redirect}`), nested query parameters like `?authorization_id=...` get dropped.

Always sanitize and URL-encode:
```typescript
// lib/route/safe-redirect.ts
export function getSafeRedirectPath(redirectParam: string | null | undefined, fallback = "/"): string {
  if (!redirectParam) return fallback;
  const clean = redirectParam.trim();
  // Disallow external or protocol-relative redirects
  if (!clean.startsWith("/") || clean.startsWith("//") || /[\s\\]/.test(clean)) {
    return fallback;
  }
  return clean;
}
```

In your sign-in / OAuth callback links:
```typescript
const returnUrl = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
const signInUrl = `/sign-in?redirect=${encodeURIComponent(returnUrl)}`;
```

---

## 9. Common Pitfalls & Gotchas

| Pitfall | Root Cause | Solution |
| :--- | :--- | :--- |
| **GoTrue HTTP 500 `Error generating ID token`** | Supabase project uses symmetric `HS256` keys. GoTrue strictly mandates asymmetric keys for OIDC `id_token`. | Migrate and rotate to `ES256` or `RS256` in Supabase Dashboard (**Project Settings > JWT Signing Keys**). |
| **"Account linking is required" in Gemini** | Discovery endpoints omitted `"offline_access"` scope, so GoTrue omitted the `refresh_token`. | Advertise `"offline_access"` in `scopes_supported` in RFC 9728 and RFC 8414 metadata. |
| **Silent Auth Downgrade on Invalid Bearer Tokens** | `verifyToken` returned `undefined` on invalid bearer token with `{ required: false }`. | Throw `OAuthError(OAuthErrorCode.InvalidToken, "...")` when a bearer token is invalid or expired. |
| **WAF blocks MCP requests with 403** | Arcjet `detectBot` challenges automated CLI clients (`curl`, `mcp-remote`, Gemini). | In `proxy.ts`, bypass bot checks for `/api/mcp` and `/.well-known/*` while keeping WAF `shield` active. |
| **Server Component SSR crash (`buttonVariants`)** | Exporting pure CVA helper functions from a `"use client"` file imported by 404/error Server Components. | Extract pure helper functions to a directive-free file (e.g. `button-variants.ts`). |
| **Cookie operations in stateless MCP routes** | Calling `cookies()` or standard `createServerClient()` inside Streamable HTTP route handlers. | Use the stateless token client (`createTokenClient`) scoped to the request's Bearer token. |

