# Better Auth OAuth 2.1 Provider & MCP Server Integration

Better Auth includes native plugins to transform your Next.js application into a fully compliant **OAuth 2.1 Authorization Server** with **Model Context Protocol (MCP)** support, Client ID Metadata Documents (CIMD), and Dynamic Client Registration (RFC 7591).

---

## 1. Overview & Architecture

Modern AI assistants (ChatGPT, Claude Desktop/Web, Google Gemini) can connect directly to your application without manual API key entry. Better Auth coordinates the entire OAuth 2.1 handshake:

```
AI Client (Gemini / Claude / ChatGPT)
  │
  ├─ 1. RFC 9728 / RFC 8414 Discovery ────► /.well-known/oauth-authorization-server/api/auth
  ├─ 2. Client Registration (DCR / CIMD) ──► POST /api/auth/oauth2/register
  ├─ 3. Authorization Code + PKCE ─────────► GET /api/auth/oauth2/authorize
  │                                                │
  │                                                ▼
  │                                       /oauth/consent (User Approves)
  │                                                │
  ├─ 4. Token Exchange (Asymmetric JWKS) ──► POST /api/auth/oauth2/token
  │                                                │
  └─ 5. Authenticated MCP Tool Invocation ─► POST /api/mcp (Bearer Token)
                                                   │
                                                   ▼
                                       requireMcpAuth() verifies JWT
```

---

## 2. Package Installation

```bash
npm install better-auth @better-auth/mcp @better-auth/cimd @better-auth/oauth-provider @modelcontextprotocol/server
```

> [!NOTE]
> Ensure all `@better-auth/*` plugin versions match your `better-auth` version (e.g. `^1.7.0` or matching latest release). If npm reports peer dependency resolution warnings across sub-plugins, install with `--legacy-peer-deps`.

---

## 3. Server Configuration (`lib/auth/auth.ts`)

Enable `jwt()`, `mcp()`, and `cimd()` on your Better Auth instance:

```typescript
// lib/auth/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { db } from "@/drizzle/db";
import { getSiteUrl, getMcpResourceUrl } from "@/lib/auth/auth-url";

export const auth = betterAuth({
  baseURL: getSiteUrl(),
  plugins: [
    jwt(), // Generates asymmetric JWKS keys required for signing tokens
    mcp({
      loginPage: "/auth/login",
      consentPage: "/oauth/consent",
      resource: getMcpResourceUrl(),
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // offline_access is MANDATORY for Google Gemini to issue a refresh_token
      scopes: ["openid", "profile", "email", "offline_access"],
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28", // Pins MCP draft CIMD profile
    }),
  ],
  database: drizzleAdapter(db, { provider: "pg" }),
});
```

---

## 4. Client Configuration (`lib/auth/auth-client.ts`)

Add `oauthProviderClient()` to keep the client instance in sync with the server:

```typescript
// lib/auth/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  plugins: [
    oauthProviderClient(),
  ],
});
```

---

## 5. URL Normalization Utility (`lib/auth/auth-url.ts`)

> [!CAUTION]
> **Avoid Trailing Slashes**: If `BETTER_AUTH_URL` contains a trailing slash (`https://example.com/`), string concatenation produces double slashes (`https://example.com//api/mcp`). Better Auth will output double-slash URLs in the `resource_metadata` challenge header, causing Vercel to issue an **HTTP 308 Permanent Redirect**. AI clients (Google Gemini, Claude `mcp-remote`) abort on redirects during discovery. Always sanitize base and resource URLs:

```typescript
// lib/auth/auth-url.ts
export function getSiteUrl(): string {
  return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function getMcpResourceUrl(): string {
  return `${getSiteUrl()}/api/mcp`;
}

export function sanitizeUrl(url: string): string {
  return url.replace(/([^:]\/)\/+/g, "$1").replace(/\/+$/, "");
}
```

---

## 6. Route Handlers & Discovery Forwarding

Because Next.js App Router isolates route matching, external AI clients querying root or RFC-specific discovery endpoints must be routed to Better Auth.

### A. Main Auth Route
```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### B. RFC 8414 Section 3 Path Insertion Discovery Route
When the authorization server issuer has a path (e.g. `/api/auth`), **RFC 8414 Section 3** requires clients (notably **Google Gemini**) to query:
`/.well-known/oauth-authorization-server/api/auth`

Forward both root and path-inserted queries:

```typescript
// app/.well-known/oauth-authorization-server/[[...path]]/route.ts
import { auth } from "@/lib/auth/auth";
import { getSiteUrl } from "@/lib/auth/auth-url";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(res.status === 204 || res.status === 304 ? null : res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const siteUrl = getSiteUrl();

  const targetUrl = url.pathname.endsWith("/api/auth")
    ? req.url
    : `${siteUrl}/.well-known/oauth-authorization-server/api/auth${url.search}`;

  const res = await auth.handler(new Request(targetUrl, req));
  return withCors(res);
}
```

### C. Root OpenID Configuration Forwarder
ChatGPT queries root `/.well-known/openid-configuration`:

```typescript
// app/.well-known/openid-configuration/route.ts
import { auth } from "@/lib/auth/auth";
import { getSiteUrl } from "@/lib/auth/auth-url";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(res.status === 204 || res.status === 304 ? null : res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const siteUrl = getSiteUrl();
  const targetUrl = `${siteUrl}/api/auth/.well-known/openid-configuration${url.search}`;
  const res = await auth.handler(new Request(targetUrl, req));
  return withCors(res);
}
```

### D. RFC 9728 Protected Resource Metadata Route
```typescript
// app/.well-known/oauth-protected-resource/[[...resource]]/route.ts
import { NextResponse } from "next/server";
import { getSiteUrl, getMcpResourceUrl } from "@/lib/auth/auth-url";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const siteUrl = getSiteUrl();

  let resource = getMcpResourceUrl();
  const pathname = url.pathname.replace(/^\/\.well-known\/oauth-protected-resource\/?/, "");
  if (pathname) {
    resource = `${siteUrl}/${pathname.replace(/^\/+/, "")}`;
  }

  return NextResponse.json({
    resource,
    authorization_servers: [`${siteUrl}/api/auth`],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    bearer_methods_supported: ["header"],
  }, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
```

---

## 7. Consent Screen UI (`/oauth/consent`)

Better Auth directs users to the consent page during the authorization code flow.

> [!IMPORTANT]
> **Consent Return Shape**: `authClient.oauth2.consent()` returns `{ redirect: boolean, url: string }` (`OAuthRedirectResult`), NOT `redirect_uri`. Always read `res.data?.url` for the redirection target.
> **Suspense Boundary**: In Next.js App Router, wrap components reading `useSearchParams()` inside `<Suspense>` to avoid prerender bailout build errors.

```tsx
// app/oauth/consent/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, redirect } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";

function ConsentContent() {
  const searchParams = useSearchParams();
  const consentId = searchParams.get("id");
  const session = authClient.useSession();
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session.isPending && !session.data) {
      redirect(`/auth/login?redirect=${encodeURIComponent(`/oauth/consent?${searchParams.toString()}`)}`);
    }
  }, [session.isPending, session.data, searchParams]);

  useEffect(() => {
    async function loadConsent() {
      if (consentId) {
        const res = await authClient.oauth2.getConsent({ query: { id: consentId } });
        if (res.data) setDetails(res.data);
      }
    }
    if (session.data) loadConsent();
  }, [consentId, session.data?.user?.id]);

  const handleDecision = async (accept: boolean) => {
    setLoading(true);
    try {
      const res = await authClient.oauth2.consent({
        accept,
        scope: details?.scopes?.join(" "),
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } finally {
      setLoading(false);
    }
  };

  const clientName = details?.client?.name || "AI Assistant";

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold">Authorise {clientName}</h1>
      <p className="text-sm text-muted-foreground my-2">
        This application is requesting access to your account with scopes: {details?.scopes?.join(", ")}
      </p>
      <div className="flex gap-4 mt-6">
        <button disabled={loading} onClick={() => handleDecision(true)} className="btn-primary">
          Allow
        </button>
        <button disabled={loading} onClick={() => handleDecision(false)} className="btn-secondary">
          Deny
        </button>
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div>Loading authorization details...</div>}>
      <ConsentContent />
    </Suspense>
  );
}
```

---

## 8. Guarding the MCP Endpoint with `requireMcpAuth`

Wrap your Next.js route handler at `app/api/mcp/route.ts` with `requireMcpAuth` from `@better-auth/mcp`:

> [!IMPORTANT]
> **Protect Both GET & POST**:
> MCP clients (e.g. Claude `mcp-remote` and Gemini) send `GET` or `HEAD` probes before establishing connections. Route both `POST` and `GET` through `requireMcpAuth` so unauthenticated requests receive the RFC 9728 `401 Unauthorized` challenge with `WWW-Authenticate: Bearer resource_metadata="..."`.

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
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, mcp-session-id, DPoP",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function HEAD() {
  return new Response(null, { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const protectedMcpHandler = requireMcpAuth(
  auth,
  async (request, tokenClaims) => {
    // Normalize missing Content-Type or Accept headers
    const contentType = request.headers.get("content-type");
    const accept = request.headers.get("accept");
    let req = request;

    const needsContentType = !contentType || !contentType.toLowerCase().includes("application/json");
    const needsAccept = !accept || accept === "*/*" || accept.trim() === "";

    if (needsContentType || needsAccept) {
      const newHeaders = new Headers(request.headers);
      if (needsContentType) newHeaders.set("content-type", "application/json");
      if (needsAccept) newHeaders.set("accept", "application/json, text/event-stream");
      req = new Request(request, { headers: newHeaders });
    }

    // Pass tokenClaims (userId, sub, scopes) into tool context
    const authInfo = {
      userId: tokenClaims?.sub as string | undefined,
      sub: tokenClaims?.sub as string | undefined,
      clientId: tokenClaims?.client_id as string | undefined,
      scopes: tokenClaims?.scope ? String(tokenClaims.scope).split(" ") : [],
    };

    return await mcpServerHandler.fetch(req, { authInfo } as any);
  },
  { resource: getMcpResourceUrl() },
);

export async function POST(req: Request) {
  return withCors(await protectedMcpHandler(req));
}

export async function GET(req: Request) {
  return withCors(await protectedMcpHandler(req));
}
```

---

## 9. Common Pitfalls & Solutions

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"Account linking is required" in Gemini** | Missing `offline_access` scope in `mcp()` options, omitting `refresh_token`. | Ensure `scopes: ["openid", "profile", "email", "offline_access"]` in `mcp()` config. |
| **HTTP 308 Permanent Redirect on Discovery** | `BETTER_AUTH_URL` had trailing slash, resulting in double-slash URLs (`//api/mcp`). | Strip trailing slashes with `getSiteUrl()`. |
| **HTTP 404 on Gemini Discovery** | Missing RFC 8414 Section 3 route `/.well-known/oauth-authorization-server/api/auth`. | Add catch-all route at `app/.well-known/oauth-authorization-server/[[...path]]/route.ts`. |
| **HTTP 404 on ChatGPT Discovery** | Missing root `/.well-known/openid-configuration` route. | Add route at `app/.well-known/openid-configuration/route.ts`. |
| **Consent Page Build Error** | `useSearchParams()` used without `<Suspense>` boundary in App Router. | Wrap consent content in `<Suspense>`. |
| **Unauthenticated GET returns 405** | Only `POST` protected with `requireMcpAuth`, leaving `GET` unhandled. | Route both `GET` and `POST` through `requireMcpAuth`. |

