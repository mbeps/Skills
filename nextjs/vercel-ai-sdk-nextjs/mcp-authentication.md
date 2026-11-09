# MCP Authentication Modes

The Model Context Protocol supports three primary authentication modes for HTTP transports: **Anonymous (`none`)**, **Custom Headers / Static Tokens (`headers`)**, and **OAuth 2.1 with PKCE (`oauth`)**.

---

## 1. Authentication Types Overview

| Auth Type | Common Protocol | Best For | Transport Mechanism |
|---|---|---|---|
| `none` | No credentials | Local servers, public read-only registries | Standard HTTP transport |
| `headers` | Bearer token, `X-API-Key`, Basic Auth | SaaS tools with user API keys, internal microservices | Injected into HTTP transport `headers` option |
| `oauth` | OAuth 2.1 + PKCE (RFC 7636) | Multi-tenant services (GitHub, Google, Slack, Notion) | `@ai-sdk/mcp` `OAuthClientProvider` + `auth()` |

---

## 2. Type `headers`: Custom Headers & Static Tokens

For providers requiring fixed tokens or API keys:
1. Encrypt header values at rest using AES-256-GCM before persisting in the database.
2. Decrypt immediately before initializing the MCP HTTP transport.
3. Automatically infer `authType: "headers"` if headers are supplied but `authType` was omitted.

### Schema with Auto-Inference:

```typescript
import { z } from "zod";

const mcpAuthTypeSchema = z.enum(["none", "headers", "oauth"]);

export const mcpServerSchema = z.preprocess((val: any) => {
  if (val && typeof val === "object") {
    if (!val.authType && val.headers && val.headers !== "") {
      return { ...val, authType: "headers" };
    }
  }
  return val;
}, z.object({
  url: z.string().url(),
  authType: mcpAuthTypeSchema.default("none"),
  headers: z.record(z.string(), z.string()).optional(),
  isPublic: z.boolean(),
}));
```

### Transport Construction with Decryption:

```typescript
import { decrypt } from "@/lib/encryption";

let headers: Record<string, string> | undefined;

if (server.headers) {
  const rawHeaders = decrypt(server.headers);
  headers = JSON.parse(rawHeaders);
}

const transport = {
  type: "http" as const,
  url: server.url,
  fetch: safeMcpFetch,
  ...(headers && { headers }),
};
```

---

## 3. Type `oauth`: OAuth 2.1 with PKCE

`@ai-sdk/mcp` provides built-in OAuth 2.1 support via the `OAuthClientProvider` interface and the `auth()` function. It manages Dynamic Client Registration (RFC 7591), PKCE code challenges/verifiers, and automatic token refresh.

### Implementing `OAuthClientProvider`

The provider stores encrypted tokens, client metadata, authorization server details, and PKCE verifiers in your application database:

```typescript
import type {
  OAuthClientProvider,
  OAuthClientMetadata,
  OAuthTokens,
  OAuthClientInformation,
  OAuthAuthorizationServerInformation,
} from "@ai-sdk/mcp";
import crypto from "crypto";
import { isBlockedUrl } from "@/lib/mcp/url-guard";

export class McpOAuthProvider implements OAuthClientProvider {
  constructor(
    private server: { id: string; url: string; oauthClientId?: string; oauthClientSecret?: string; oauthScope?: string },
    private userId: string,
    private db: Database,
    public onRedirect?: (authUrl: URL) => void,
  ) {}

  get redirectUrl(): string {
    return `${process.env.APP_URL}/api/mcp/oauth/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "AI Client",
      client_uri: `${process.env.APP_URL}/api/mcp/oauth/client-metadata`,
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.server.oauthClientSecret ? "client_secret_post" : "none",
      ...(this.server.oauthScope && { scope: this.server.oauthScope }),
    };
  }

  // --- Token Retrieval & Storage ---
  async tokens(): Promise<OAuthTokens | undefined> {
    const cred = await this.db.getMcpOAuthCredential({ userId: this.userId, serverId: this.server.id });
    if (!cred?.accessToken) return undefined;

    const expiresIn = cred.accessTokenExpiresAt
      ? Math.max(0, Math.floor((cred.accessTokenExpiresAt.getTime() - Date.now()) / 1000))
      : undefined;

    return {
      access_token: cred.accessToken,
      token_type: cred.tokenType ?? "Bearer",
      refresh_token: cred.refreshToken ?? undefined,
      expires_in: expiresIn,
      scope: cred.scope ?? undefined,
    };
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    await this.db.saveMcpOAuthCredential({
      userId: this.userId,
      serverId: this.server.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenType: tokens.token_type ?? "Bearer",
      scope: tokens.scope ?? null,
      accessTokenExpiresAt: expiresAt,
    });
  }

  // --- PKCE Code Verifier ---
  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.db.saveMcpOAuthCredential({
      userId: this.userId,
      serverId: this.server.id,
      codeVerifier,
    });
  }

  async codeVerifier(): Promise<string> {
    const cred = await this.db.getMcpOAuthCredential({ userId: this.userId, serverId: this.server.id });
    if (!cred?.codeVerifier) throw new Error("No code verifier found for MCP server");
    return cred.codeVerifier;
  }

  // --- Dynamic Client Registration or Pre-configured Credentials ---
  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const cred = await this.db.getMcpOAuthCredential({ userId: this.userId, serverId: this.server.id });
    if (cred?.clientInformation?.client_id) {
      return cred.clientInformation as OAuthClientInformation;
    }
    if (this.server.oauthClientId) {
      return {
        client_id: this.server.oauthClientId,
        ...(this.server.oauthClientSecret && { client_secret: this.server.oauthClientSecret }),
      };
    }
    return undefined;
  }

  async saveClientInformation(clientInformation: OAuthClientInformation): Promise<void> {
    await this.db.saveMcpOAuthCredential({
      userId: this.userId,
      serverId: this.server.id,
      clientInformation,
    });
  }

  // --- Authorization Server Metadata ---
  async authorizationServerInformation(): Promise<OAuthAuthorizationServerInformation | undefined> {
    const cred = await this.db.getMcpOAuthCredential({ userId: this.userId, serverId: this.server.id });
    return cred?.authorizationServerInfo;
  }

  async saveAuthorizationServerInformation(info: OAuthAuthorizationServerInformation): Promise<void> {
    await this.db.saveMcpOAuthCredential({
      userId: this.userId,
      serverId: this.server.id,
      authorizationServerInfo: info,
    });
  }

  // --- State Parameter (CSRF Defense with Expiry) ---
  async state(): Promise<string> {
    return crypto.randomUUID();
  }

  async saveState(state: string): Promise<void> {
    const stateExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
    await this.db.saveMcpOAuthCredential({
      userId: this.userId,
      serverId: this.server.id,
      oauthState: state,
      stateExpiresAt,
    });
  }

  async storedState(): Promise<string | undefined> {
    const cred = await this.db.getMcpOAuthCredential({ userId: this.userId, serverId: this.server.id });
    return cred?.oauthState ?? undefined;
  }

  // --- Redirection Handler ---
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    if (this.onRedirect) this.onRedirect(authorizationUrl);
  }

  // --- Security Guards against SSRF ---
  async validateAuthorizationServerURL(_serverUrl: string | URL, authServerUrl: string | URL): Promise<void> {
    const urlStr = typeof authServerUrl === "string" ? authServerUrl : authServerUrl.href;
    if (await isBlockedUrl(urlStr)) {
      throw new Error(`SSRF Blocked: OAuth server points to internal address: ${urlStr}`);
    }
  }

  async validateResourceURL(_serverUrl: string | URL, resource?: string): Promise<URL | undefined> {
    if (!resource) return undefined;
    if (await isBlockedUrl(resource)) {
      throw new Error(`SSRF Blocked: Resource points to internal address: ${resource}`);
    }
    return new URL(resource);
  }

  // --- Scoped Invalidation ---
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier"): Promise<void> {
    if (scope === "all") await this.db.deleteMcpOAuthCredential({ userId: this.userId, serverId: this.server.id });
    if (scope === "tokens") await this.db.clearMcpOAuthTokens({ userId: this.userId, serverId: this.server.id });
  }
}
```

---

## 4. The Two-Step OAuth Flow in Next.js

### Step 1: Initiating OAuth (`initiateMcpOAuth` Server Action)

```typescript
// actions/mcp/initiate-oauth.ts
"use server";

import { auth as mcpAuth } from "@ai-sdk/mcp";
import { McpOAuthProvider } from "@/lib/mcp/oauth/provider";
import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";

export async function initiateMcpOAuth(serverId: string) {
  const session = await requireUserSession();
  const server = await db.getServer(serverId);

  let authorizationUrl: string | undefined;

  const provider = new McpOAuthProvider(server, session.user.id, db, (url) => {
    authorizationUrl = url.toString();
  });

  const authResult = await mcpAuth(provider, {
    serverUrl: server.url,
    scope: server.oauthScope,
    fetchFn: safeMcpFetch,
  });

  if (authResult === "AUTHORIZED") {
    return { alreadyAuthorized: true };
  }

  return { authorizationUrl };
}
```

### Step 2: Callback Route Handler (`/api/mcp/oauth/callback/route.ts`)

```typescript
// app/api/mcp/oauth/callback/route.ts
import { auth as mcpAuth } from "@ai-sdk/mcp";
import { NextResponse } from "next/server";
import { McpOAuthProvider } from "@/lib/mcp/oauth/provider";
import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const iss = url.searchParams.get("iss") ?? undefined;

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=missing_params", req.url));
  }

  // Verify state matches DB record and is not expired
  const credential = await db.getCredentialByState(state);
  if (!credential) {
    return NextResponse.redirect(new URL("/settings?error=invalid_or_expired_state", req.url));
  }

  const server = await db.getServer(credential.serverId);
  const provider = new McpOAuthProvider(server, credential.userId, db);

  try {
    // Exchange authorization code for tokens using stored PKCE verifier
    await mcpAuth(provider, {
      serverUrl: server.url,
      authorizationCode: code,
      callbackState: state,
      callbackIssuer: iss,
      fetchFn: safeMcpFetch,
    });

    // Clear one-time state
    await db.clearOAuthState(credential.id);

    return NextResponse.redirect(new URL(`/settings/connectors/${server.id}?status=connected`, req.url));
  } catch (error) {
    return NextResponse.redirect(new URL(`/settings/connectors/${server.id}?error=exchange_failed`, req.url));
  }
}
```

---

## 5. Attaching Auth Provider to Transport

When creating the client for an OAuth-enabled server, supply the instantiated `authProvider`:

```typescript
import { createMCPClient } from "@ai-sdk/mcp";
import { McpOAuthProvider } from "@/lib/mcp/oauth/provider";

export async function createConnectedClient(server: ServerConfig, userId: string) {
  const authProvider = server.authType === "oauth"
    ? new McpOAuthProvider(server, userId, db)
    : undefined;

  return createMCPClient({
    transport: {
      type: "http",
      url: server.url,
      fetch: safeMcpFetch,
      ...(authProvider && { authProvider }),
    },
  });
}
```

---

## 6. Edge Case: Cross-Origin `resource_metadata` Sanitisation

When an MCP server responds with HTTP 401 Unauthorized across redirected origins, `@ai-sdk/mcp`'s `assertResourceMetadataUrlSameOrigin` checks if `resource_metadata="..."` in the `WWW-Authenticate` header matches the initial request's origin. If origins differ (e.g. from a canonical domain redirect), `@ai-sdk/mcp` throws.

Strip cross-origin `resource_metadata` in your custom `fetch` wrapper so `@ai-sdk/mcp` falls back gracefully to discovering metadata through `validateResourceURL`:

```typescript
function sanitizeCrossOriginAuthResponse(
  response: Response,
  initialUrl: string,
  finalUrl: string,
): Response {
  if (response.status !== 401) return response;

  const initialOrigin = new URL(initialUrl).origin;
  const finalOrigin = new URL(finalUrl).origin;
  if (initialOrigin === finalOrigin) return response;

  const authHeader = response.headers.get("www-authenticate");
  if (!authHeader?.includes("resource_metadata")) return response;

  // Strip resource_metadata to prevent assertResourceMetadataUrlSameOrigin failure
  const cleanedHeader = authHeader
    .replace(/(?:^|[,\s])resource_metadata="?[^",]+"?(?=,|$|\s)/gi, "")
    .replace(/^\s*,\s*|,\s*$/g, "")
    .trim();

  const newHeaders = new Headers(response.headers);
  if (cleanedHeader) newHeaders.set("www-authenticate", cleanedHeader);
  else newHeaders.delete("www-authenticate");

  return new Proxy(response, {
    get(target, prop) {
      if (prop === "headers") return newHeaders;
      const val = Reflect.get(target, prop, target);
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}
```
