# Universal MCP OAuth 2.1 & OpenID Connect Guide

This guide details how to implement zero-configuration **OAuth 2.1 authentication with Dynamic Client Registration (RFC 7591)**, **Client ID Metadata Documents (CIMD)**, and **OpenID Connect (OIDC)** discovery for Next.js MCP servers.

Two architecture options are supported:
- **Option 1: Better Auth (Native)** — Fully integrated, TypeScript-first OAuth 2.1 server with Drizzle/Prisma schemas, CIMD profile support, and `@better-auth/mcp`.
- **Option 2: Supabase GoTrue** — External headless OAuth 2.1 server using Supabase Auth.

---

## 1. Architecture Overview

Modern AI clients (Google Gemini, Claude Desktop/Web, Cursor, VS Code Copilot, ChatGPT) implement different revisions of the MCP authorization specification (`2024-11-05`, `2025-03-26`, and `2026-07-28`).

```mermaid
sequenceDiagram
    autonumber
    participant Client as MCP Client (Gemini / Claude / Cursor / ChatGPT)
    participant Next as Next.js App (your-domain.com)
    participant Auth as OAuth 2.1 Provider (Better Auth / GoTrue)
    participant DB as Database (PostgreSQL / Drizzle)

    Note over Client,Auth: 1. Discovery & Registration (RFC 9728 / RFC 8414 / RFC 7591 / CIMD)
    Client->>Next: GET /.well-known/oauth-protected-resource(/api/mcp)
    Next-->>Client: 200 OK (authorization_servers, scopes_supported with offline_access)
    Client->>Next: GET /.well-known/oauth-authorization-server (or /api/auth path)
    Next-->>Client: 200 OK (endpoints, registration_endpoint, jwks_uri)
    Client->>Next: POST /api/auth/oauth2/register (DCR or CIMD fetch)
    Next->>Auth: Register client metadata
    Next-->>Client: 201 Created (client_id, redirect_uris)

    Note over Client,Auth: 2. Authorization Code + PKCE & Consent Screen
    Client->>Auth: Browser Redirect -> /api/auth/oauth2/authorize
    Auth->>Next: Redirect -> /oauth/consent?id=<consent_id>
    Next->>Auth: authClient.oauth2.getConsent({ id })
    Next->>Next: Render consent card; user clicks "Allow Access"
    Next->>Auth: authClient.oauth2.consent({ accept: true, scope })
    Auth-->>Client: Browser Redirect -> <callback>?code=...&state=...

    Note over Client,Auth: 3. Token Exchange & ID Token Verification
    Client->>Next: POST /api/auth/oauth2/token (code + code_verifier)
    Next->>Auth: Validate PKCE & issue tokens
    Auth-->>Client: 200 OK (access_token, refresh_token, id_token signed with asymmetric key)

    Note over Client,Next: 4. Authenticated MCP Tool Invocation
    Client->>Next: POST /api/mcp (Authorization: Bearer <access_token>)
    Next->>Auth: requireMcpAuth verifies JWT signature against /api/auth/jwks
    Next->>DB: Execute tool queries scoped by tokenClaims.sub
    Next-->>Client: 200 OK (User-scoped tool results)
```

---

## 2. Option 1: Native Better Auth OAuth 2.1 & MCP Provider

Better Auth provides native plugins to turn your Next.js application into a fully compliant OAuth 2.1 Authorization Server and protected resource host.

### Required Packages
```bash
npm install better-auth @better-auth/mcp @better-auth/cimd @better-auth/oauth-provider @modelcontextprotocol/server
```

### Server Configuration (`lib/auth/auth.ts`)
```typescript
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { getSiteUrl, getMcpResourceUrl } from "@/lib/auth/auth-url";

export const auth = betterAuth({
  baseURL: getSiteUrl(),
  plugins: [
    jwt(), // Required for asymmetric RS256/ES256 JWKS signing
    mcp({
      loginPage: "/auth/login",
      consentPage: "/oauth/consent",
      resource: getMcpResourceUrl(),
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      // offline_access is mandatory for Gemini refresh tokens
      scopes: ["openid", "profile", "email", "offline_access"],
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28", // Pins MCP draft CIMD profile
    }),
  ],
  // database adapter (e.g. drizzleAdapter)...
});
```

### Client Configuration (`lib/auth/auth-client.ts`)
```typescript
import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  plugins: [
    oauthProviderClient(),
  ],
});
```

### Database Tables (Drizzle ORM)
Better Auth OAuth Provider requires:
- `jwks`: Key store for asymmetric token signing.
- `oauth_client`: Registered clients (supports RFC 7591 dynamic client registration).
- `oauth_access_token` & `oauth_refresh_token`: Stored token grants.
- `oauth_consent`: User consent decisions per client and scope set.
- `oauth_resource` & `oauth_client_resource`: Protected resource bindings.

Run `npx @better-auth/cli generate` or sync schemas to create PostgreSQL migration tables.

---

## 3. Option 2: Supabase OAuth 2.1 Server Configuration

Supabase includes a native, headless OAuth 2.1 server in GoTrue.

### `supabase/config.toml`
```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = true
```

In Supabase Cloud Dashboard:
- Navigate to **Authentication > OAuth Server**.
- Enable **OAuth Server** and **Dynamic Client Registration**.
- Set **Authorization URL Path** to `/oauth/consent`.

---

## 3. The GoTrue Asymmetric Key (ES256/RS256) Mandate

> [!CAUTION]
> **HTTP 500 `Error generating ID token` in GoTrue**:
> When clients like Google Gemini or Claude request the `openid` scope, GoTrue is required to mint and sign an OIDC `id_token`. GoTrue source code explicitly enforces that ID tokens **must** be signed with asymmetric keys (`ES256` or `RS256`).
> If your Supabase project uses the legacy symmetric `HS256` shared secret, token exchange fails with internal error `HS256 is not supported for ID token signing` and returns HTTP 500.

### Resolution
1. Open Supabase Dashboard: **Project Settings > JWT Signing Keys**.
2. Click **Migrate JWT secret** (creates a standby `ES256` key pair).
3. Click **Rotate keys** to promote `ES256` to the active signing key.
4. Verify by curling the JWKS endpoint:
   ```bash
   curl https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
   ```
   Must return an array containing the public key `keys: [{ "kty": "EC", "crv": "P-256", "alg": "ES256", ... }]`.

---

## 4. Metadata & Discovery Route Handlers & URL Normalization

Modern AI clients query multiple discovery specifications:
- **RFC 9728**: Protected resource metadata (`/.well-known/oauth-protected-resource`)
- **RFC 8414 Section 3**: Authorization server metadata (`/.well-known/oauth-authorization-server/api/auth`)
- **Root OIDC / RFC 8414**: Root fallback queries (`/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server`)

### A. Centralized URL Normalization (`lib/auth/auth-url.ts`)

> [!CAUTION]
> **Vercel HTTP 308 Redirect Discovery Failure**:
> When `BETTER_AUTH_URL` or environment variables contain a trailing slash (`https://example.com/`), string concatenation yields double slashes (`https://example.com//api/mcp`).
> When `@better-auth/oauth-provider` generates `WWW-Authenticate: Bearer resource_metadata="..."`, it advertises the double-slash URL. Vercel issues an **HTTP 308 Permanent Redirect**.
> Google Gemini, Claude `mcp-remote`, and ChatGPT reject redirects on metadata endpoints and abort the connection. Always strip trailing slashes:

```typescript
// lib/auth/auth-url.ts
export function getSiteUrl(): string {
  return (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function getMcpResourceUrl(): string {
  return `${getSiteUrl()}/api/mcp`;
}

export function sanitizeUrl(url: string): string {
  return url.replace(/([^:]\/)\/+/g, "$1").replace(/\/+$/, "");
}
```

### B. RFC 9728 Protected Resource Metadata Handler
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

  const metadata = {
    resource,
    authorization_servers: [`${siteUrl}/api/auth`],
    // offline_access is MANDATORY for Google Gemini to issue a refresh_token
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    bearer_methods_supported: ["header"],
  };

  return NextResponse.json(metadata, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
```

### C. RFC 8414 Section 3 Path Insertion Proxy
When an authorization server URL has a path component (e.g. `https://host/api/auth`), **RFC 8414 Section 3** requires clients to insert `/.well-known/oauth-authorization-server` between host and path:
`/.well-known/oauth-authorization-server/api/auth`

Clients also query the root fallback `/.well-known/oauth-authorization-server`. Forward both to Better Auth:

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

### D. Root OpenID Configuration Forwarder
Forward root `/.well-known/openid-configuration` queries to Better Auth's handler:

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

---

## 5. Dynamic Client Registration (RFC 7591) & CIMD

Automated MCP clients register dynamically or identify via Client ID Metadata Documents (CIMD):
- In **Better Auth**, enabling `allowDynamicClientRegistration: true` and the `cimd()` plugin automatically handles both RFC 7591 `POST /api/auth/oauth2/register` and URL-based client identities.
- In **Supabase GoTrue**, forward `POST /api/oauth/register` to GoTrue DCR or the Supabase Admin API.

---

## 6. Next.js OAuth 2.1 Consent UI (`/oauth/consent`)

When an AI client requests access, the OAuth provider redirects the user to the consent screen (`/oauth/consent`).

### Better Auth Consent Screen (`app/oauth/consent/page.tsx`)

> [!IMPORTANT]
> **Consent Response Shape**: `authClient.oauth2.consent()` returns `{ redirect: boolean, url: string }` (`OAuthRedirectResult`). Read `res.data?.url` for the redirection destination.
> **Suspense Boundary**: In Next.js App Router, wrap components reading `useSearchParams()` in `<Suspense>` to prevent build-time prerender bailouts.

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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!session.isPending && !session.data) {
      redirect(`/auth/login?redirect=${encodeURIComponent(`/oauth/consent?${searchParams.toString()}`)}`);
    }
  }, [session.isPending, session.data, searchParams]);

  useEffect(() => {
    async function load() {
      if (consentId) {
        const res = await authClient.oauth2.getConsent({ query: { id: consentId } });
        if (res.data) setDetails(res.data);
      }
    }
    if (session.data) load();
  }, [consentId, session.data?.user?.id]);

  const handleDecision = async (accept: boolean) => {
    setIsLoading(true);
    try {
      const res = await authClient.oauth2.consent({
        accept,
        scope: details?.scopes?.join(" "),
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2>Authorise {details?.client?.name || "AI Assistant"}</h2>
      <p>Requested scopes: {details?.scopes?.join(", ")}</p>
      <button disabled={isLoading} onClick={() => handleDecision(true)}>Allow</button>
      <button disabled={isLoading} onClick={() => handleDecision(false)}>Deny</button>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<div>Loading authorization request...</div>}>
      <ConsentContent />
    </Suspense>
  );
}
```

---

## 7. Client Quirks & Troubleshooting

| Client / Failure | Root Cause | Fix / Configuration |
| :--- | :--- | :--- |
| **"Account linking is required" in Gemini** | Discovery metadata omitted `"offline_access"` scope, so no `refresh_token` was returned. | Add `"offline_access"` to `scopes_supported` in RFC 9728 and RFC 8414 discovery endpoints. |
| **HTTP 308 Permanent Redirect on Discovery** | Trailing slash in `BETTER_AUTH_URL` created double slashes (`//api/mcp`). Vercel redirects, which Gemini/Claude reject. | Use `getSiteUrl()` to strip trailing slashes from base and resource URLs. |
| **HTTP 404 on Gemini Discovery** | Issuer has path (`/api/auth`). Gemini queries RFC 8414 Section 3 path `/.well-known/oauth-authorization-server/api/auth`. | Create `app/.well-known/oauth-authorization-server/[[...path]]/route.ts` proxying to `auth.handler()`. |
| **HTTP 404 on ChatGPT Discovery** | ChatGPT queries root `/.well-known/openid-configuration`. | Create `app/.well-known/openid-configuration/route.ts` proxying to `auth.handler()`. |
| **HTTP 500 `Error generating ID token` in GoTrue** | Legacy Supabase uses symmetric `HS256`. OIDC requires asymmetric keys. | Migrate JWT keys to `ES256` or `RS256` in Supabase Project Settings. |
| **Claude Desktop / Claude Web** | Connects without auth by default; runs public tools cleanly. | Guard endpoint with `requireMcpAuth` or dual-mode auth. Support `/api/mcp?auth=required` to challenge on demand. |
| **Consent Page prerender bailout build error** | `useSearchParams()` called without Suspense boundary in App Router. | Wrap search-param consuming component inside `<Suspense>`. |

