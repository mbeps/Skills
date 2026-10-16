# Universal MCP OAuth 2.1 & OpenID Connect Guide

This guide details how to implement zero-configuration **OAuth 2.1 authentication with Dynamic Client Registration (RFC 7591)** and **OpenID Connect (OIDC)** discovery for Next.js MCP servers using Supabase Auth (GoTrue).

---

## 1. Architecture Overview

Modern AI clients (Google Gemini, Claude Desktop/Web, Cursor, VS Code Copilot, ChatGPT) implement different revisions of the MCP authorization specification (`2025-03-26`, `2025-06-18`, and `2026-07-28`).

```mermaid
sequenceDiagram
    autonumber
    participant Client as MCP Client (Gemini / Claude / Cursor)
    participant Next as Next.js App (your-domain.com)
    participant Auth as Authorization Server (Supabase GoTrue)

    Note over Client,Auth: 1. Discovery & Registration (RFC 9728 / RFC 8414 / RFC 7591)
    Client->>Next: GET /.well-known/oauth-protected-resource(/api/mcp)
    Next-->>Client: 200 OK (authorization_servers, scopes_supported including offline_access)
    Client->>Next: GET /.well-known/oauth-authorization-server (or openid-configuration)
    Next-->>Client: 200 OK (endpoints, registration_endpoint)
    Client->>Next: POST /api/oauth/register (RFC 7591 DCR)
    Next->>Auth: Forward registration or create client
    Next-->>Client: 201 Created (client_id, redirect_uris)

    Note over Client,Auth: 2. Authorization Code + PKCE & Consent Screen
    Client->>Auth: Browser Redirect -> /auth/v1/oauth/authorize
    Auth->>Next: Redirect -> /oauth/consent?authorization_id=<uuid>
    Next->>Auth: supabase.auth.oauth.getAuthorizationDetails(authorizationId)
    Next->>Next: Render consent card; user clicks "Allow Access"
    Next->>Auth: supabase.auth.oauth.approveAuthorization(authorizationId)
    Auth-->>Next: { redirect_url: "<callback>?code=...&state=..." }
    Next->>Client: Browser Redirect -> <callback>

    Note over Client,Auth: 3. Token Exchange & ID Token Verification
    Client->>Next: POST /api/oauth/token (code + code_verifier)
    Next->>Auth: Forward to /auth/v1/oauth/token
    Auth-->>Client: 200 OK (access_token, refresh_token, id_token signed with ES256)
    Client->>Next: GET /.well-known/jwks.json (verify id_token)
    Next-->>Client: 200 OK (public keys)

    Note over Client,Next: 4. Authenticated MCP Tool Invocation
    Client->>Next: POST /api/mcp (Authorization: Bearer <access_token>)
    Next-->>Client: 200 OK (Full User & Admin capabilities unlocked)
```

---

## 2. Supabase OAuth 2.1 Server Configuration

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

## 4. Metadata & Discovery Route Handlers

Modern clients query multiple discovery specs. Use Next.js optional catch-all routes `[[...resource]]` to support both origin and path-scoped queries.

### A. RFC 9728 Protected Resource Metadata
```typescript
// app/.well-known/oauth-protected-resource/[[...resource]]/route.ts
import { generateProtectedResourceMetadata, getPublicUrl, metadataCorsOptionsRequestHandler } from "mcp-handler";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

export async function GET(req: Request) {
  const publicUrl = getPublicUrl(req);
  publicUrl.pathname = publicUrl.pathname.replace(/^\/\.well-known\/[^/]+/, "");
  const resource = publicUrl.pathname === "/"
    ? publicUrl.toString().replace(/\/$/, "")
    : publicUrl.toString();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");

  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [`${supabaseUrl}/auth/v1`],
    resourceUrl: resource,
    additionalMetadata: {
      // offline_access is MANDATORY for Google Gemini to issue a refresh_token
      scopes_supported: ["openid", "email", "profile", "offline_access"],
      bearer_methods_supported: ["header"],
    },
  });

  return new Response(JSON.stringify(metadata), {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
```

### B. RFC 8414 Authorization Server Metadata
```typescript
// app/.well-known/oauth-authorization-server/[[...resource]]/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  return NextResponse.json({
    issuer: `${supabaseUrl}/auth/v1`,
    authorization_endpoint: `${supabaseUrl}/auth/v1/oauth/authorize`,
    token_endpoint: `${supabaseUrl}/auth/v1/oauth/token`,
    registration_endpoint: `${siteUrl}/api/oauth/register`,
    jwks_uri: `${siteUrl}/.well-known/jwks.json`,
    userinfo_endpoint: `${supabaseUrl}/auth/v1/oauth/userinfo`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: ["openid", "email", "profile", "offline_access"],
    id_token_signing_alg_values_supported: ["ES256", "RS256"],
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

### C. Domain JWKS Proxy
Clients frequently query `/.well-known/jwks.json` on the Next.js host domain to verify ID token signatures:

```typescript
// app/.well-known/jwks.json/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");
  const res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 600 },
  });

  const data = await res.json();
  return NextResponse.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=600",
    },
  });
}
```

---

## 5. Dynamic Client Registration (RFC 7591)

Automated MCP clients register via `POST /api/oauth/register`:

```typescript
// app/api/oauth/register/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");

  // 1. Forward to Supabase GoTrue public DCR
  try {
    const upstreamRes = await fetch(`${supabaseUrl}/auth/v1/oauth/clients/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    if (upstreamRes.ok) {
      const data = await upstreamRes.json();
      return NextResponse.json(data, { status: 201, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  } catch {
    // Fallback to Admin API if public DCR endpoint is unreachable
  }

  // 2. Admin client fallback
  const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!);
  const { data, error } = await adminClient.auth.admin.oauth.createClient({
    client_name: body.client_name ?? "MCP Client",
    redirect_uris: body.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "openid email profile offline_access",
  });

  if (error || !data) {
    return NextResponse.json({ error: "registration_failed" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201, headers: { "Access-Control-Allow-Origin": "*" } });
}
```

---

## 6. Next.js OAuth 2.1 Consent UI (`/oauth/consent`)

Supabase redirects the user to `/oauth/consent?authorization_id=<uuid>`.

### Client Consent Hook (`useOAuthConsent`)
```typescript
// hooks/use-oauth-consent.ts
import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function useOAuthConsent(authorizationId: string | null) {
  const [details, setDetails] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "error">("loading");

  useEffect(() => {
    if (!authorizationId) return;
    const supabase = createBrowserClient();

    async function load() {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error || !data) {
        setStatus("error");
        return;
      }

      // If user already granted consent, redirect immediately
      if ("redirect_url" in data) {
        window.location.assign(data.redirect_url);
        return;
      }

      setDetails(data);
      setStatus("ready");
    }

    load();
  }, [authorizationId]);

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

## 7. Client Quirks & Troubleshooting

| Client | Behavior & Requirement | Fix / Configuration |
| :--- | :--- | :--- |
| **Google Gemini (Connected Apps)** | Proactively executes discovery and mandates a `refresh_token` in the token response. | Must advertise `offline_access` in RFC 9728 & RFC 8414 `scopes_supported`. If missing, Gemini fails with *"Account linking is required to use this custom app."* |
| **Claude Desktop / Claude Web** | Connects without auth by default; runs public tools cleanly. | Keep `required: false` on `withMcpAuth` so unauthenticated requests succeed as Guest. |
| **mcp-remote / Cursor** | Probes endpoint and triggers browser login only upon receiving HTTP 401. | Support `/api/mcp?auth=required` to return a 401 challenge on demand. |
| **Multi-hop Sign-In Loss** | Unauthenticated user hits `/oauth/consent?authorization_id=...`, gets redirected to `/sign-in`. | Always URL-encode nested query parameters (`encodeURIComponent(redirect)`) and sanitize with `getSafeRedirectPath` to prevent open redirects. |

