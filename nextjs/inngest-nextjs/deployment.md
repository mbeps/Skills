# Inngest Deployment — Reference

## Serve vs Connect

| Model                                 | How It Works                                                   | Best For                                          |
| ------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| **`serve()`** (Hosted)                | HTTP endpoint at `/api/inngest`; Inngest Cloud calls your app  | Vercel, Netlify, Cloudflare Pages, any serverless |
| **`connect()`** (Self-hosted Workers) | Persistent WebSocket outbound to Inngest; long-running process | Kubernetes, ECS, Render, Fly.io, containers       |
| **Self-hosted Inngest**               | Single binary (`inngest start`) with SQLite/Postgres + Redis   | Full control, data privacy, on-prem               |

### Serve Handler (Next.js App Router)

```typescript
// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/functions";

export const maxDuration = 300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
  serveOrigin: process.env.INNGEST_SERVE_ORIGIN || undefined,
});
```

Export `maxDuration`, `runtime = "nodejs"`, and `dynamic = "force-dynamic"` to allow long-running execution checks without Next.js caching or prematurely terminating serverless invocations.

When hosting behind reverse proxies, container networks, or custom public origins, configure `serveOrigin` so Inngest execution callbacks route to the reachable external host instead of internal container IPs.

### Connect Worker (Long-Running Process)

```typescript
import { Inngest } from "inngest";
import { connect } from "inngest/connect";

const inngest = new Inngest({ id: "my-app" });

const connection = await connect({
  apps: [{ client: inngest, functions: [handleSignupFunction] }],
  instanceId: process.env.MY_CONTAINER_ID,
  maxWorkerConcurrency: 10,
});

console.log("Connected to Inngest");
```

## Environment Variables

```bash
# Required for production (not needed with INNGEST_DEV=1)
INNGEST_EVENT_KEY="your-event-key"
INNGEST_SIGNING_KEY="your-signing-key"

# Optional: custom base URL for self-hosted Inngest
INNGEST_BASE_URL="https://custom-inngest.example.com"

# Development mode
INNGEST_DEV=1
```

## Client Configuration

```typescript
// inngest/client.ts
import { Inngest } from "inngest";
import { env } from "@/config/env";

const isDev = Boolean(
  env.INNGEST_DEV === "1" ||
    env.INNGEST_DEV === "true" ||
    env.NODE_ENV !== "production" ||
    !env.INNGEST_SIGNING_KEY ||
    env.INNGEST_SIGNING_KEY === "local",
);

export const inngest = new Inngest({
  id: "my-app",
  isDev,
  baseUrl:
    env.INNGEST_BASE_URL || (isDev ? "http://127.0.0.1:8288" : undefined),
  eventKey:
    env.INNGEST_EVENT_KEY && env.INNGEST_EVENT_KEY !== "local"
      ? env.INNGEST_EVENT_KEY
      : undefined,
  signingKey:
    env.INNGEST_SIGNING_KEY && env.INNGEST_SIGNING_KEY !== "local"
      ? env.INNGEST_SIGNING_KEY
      : undefined,
});
```

> [!NOTE]
> In local development, passing dummy keys like `"local"` to `signingKey` or `eventKey` causes the Inngest SDK to attempt signature verification. Treat `"local"` placeholders as `undefined` so the client runs cleanly against the local dev server without auth headers.

## Inngest REST API v2 & Run Management

When querying or canceling background runs from your application backend or admin dashboard:

### Uniform REST v2 Endpoints
Inngest Cloud and local dev server (engine v1.45+) expose runs under `/v2/runs`. **There are no `/v1/runs` or `/v1/cancellations` endpoints**; calling them returns HTTP 404.

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| List runs | `GET /v2/runs` | Supports `query` (CEL), `limit`, `status` |
| Get run details | `GET /v2/runs/{runId}` | Returns run object |
| Cancel run | `POST /v2/runs/{runId}/cancel` | Returns 200 or 409 if already finished |

### Base URL Sanitization
Always sanitize `INNGEST_BASE_URL` before forming REST API calls:
```typescript
export function resolveInngestApiBaseUrl(): string {
  const base =
    env.INNGEST_BASE_URL ||
    (isDevMode() ? "http://127.0.0.1:8288" : "https://api.inngest.com");
  return base
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api\/inngest$/, "")
    .replace(/\/+$/, "");
}
```
Stripping accidental `/api/inngest` suffixes prevents routing requests to Next.js route handlers instead of the Inngest engine.

### Query Invariants
- `GET /v2/runs` supports filtering by status (`status=RUNNING`) and Common Expression Language queries: `query=event.data.userId == "user-123"`.
- **Do NOT pass `include=output`**: `GET /v2/runs` rejects `include=output` with HTTP 400 (`unsupported include value "output"`). Output is returned directly on run objects.

### Cloud Trigger Event Dereferencing
On Inngest Cloud, `/v2/runs` responses return `v2FunctionRun` structures containing `trigger.eventIds: string[]` rather than inline `trigger.data`. To retrieve the triggering event payload:
```typescript
const res = await fetch(`${baseUrl}/v1/events/${eventId}`, { headers });
const { data } = await res.json();
```
Deduplicate event fetch requests in-flight using a `Map<string, Promise<...>>` cache during batch run listings.

### Fail-Closed Run Cancellation
When allowing users to cancel runs, verify tenant ownership on the triggering payload before dispatching `POST /v2/runs/{runId}/cancel`:
```typescript
if (!payloadData?.userId || payloadData.userId !== requestingUserId) {
  throw new Error("Unauthorized or mismatched run owner");
}

const res = await fetch(`${baseUrl}/v2/runs/${runId}/cancel`, {
  method: "POST",
  headers,
  body: JSON.stringify({}),
});

// Treat 409 or "already ended" as idempotent success
if (res.ok || res.status === 409) return { success: true };
const errorText = await res.text();
if (errorText.toLowerCase().includes("already")) return { success: true };
```

## Production Checklist

- [ ] `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` set in production env
- [ ] `/api/inngest` route accessible from Inngest Cloud (not behind auth)
- [ ] Functions registered in `serve()` call
- [ ] Retries configured appropriately per function
- [ ] `onFailure` handlers set for critical paths
- [ ] Step IDs are stable across deploys (for replay compatibility)
- [ ] No mutable state stored in closures or module scope
- [ ] Database connections handled inside `step.run()` (not outside)
- [ ] Rate limits respected for external API calls
- [ ] Realtime channels have proper access controls (token minting validates ownership)

## Deploying to Vercel

```json
// vercel.json
{
  "functions": {
    "app/api/inngest/route.ts": {
      "maxDuration": 60
    }
  }
}
```

Set environment variables in Vercel dashboard. The `/api/inngest` route must be publicly accessible.

## Migrating Between Environments

1. Export functions from a shared `inngest/functions/` directory
2. Create separate client instances per environment (dev/prod)
3. Use different Inngest app IDs to isolate runs
4. Event names should be consistent across environments
