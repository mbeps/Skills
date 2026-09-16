# SSE Authentication, Authorization & Security

This reference covers authentication strategies, tenant isolation, Cross-Origin Resource Sharing (CORS), Cross-Site Request Forgery (CSRF), and DoS protection for Server-Sent Events in Next.js.

---

## 1. Authentication Strategies Comparison

| Strategy                                |  Native `EventSource` Compatible?   |  Security Level  | Best Use Case                                                                                          |
| --------------------------------------- | :---------------------------------: | :--------------: | ------------------------------------------------------------------------------------------------------ |
| **HttpOnly Session Cookies**            |  **Yes** (`withCredentials: true`)  |       High       | Same-origin or trusted subdomain web apps with NextAuth, Better Auth, Supabase, or custom sessions.    |
| **Short-Lived Ticket / Token Exchange** | **Yes** (Ticket in URL query param) |       High       | Web apps with JWTs where tickets expire in 30–60s and are single-use.                                  |
| **Bearer Token in Query Param**         |   **Yes** (`/api/sse?token=xyz`)    | **Low (Unsafe)** | Discouraged — sensitive tokens get leaked in browser history, proxy access logs, and referrer headers. |
| **Custom Header via `fetch` Stream**    |  **No** (Requires `fetch` or SDK)   |       High       | SPA/Mobile clients already using Bearer tokens in memory.                                              |

---

## 2. Cookie-Based Authentication Pattern (Recommended for Same-Origin)

Because standard browser cookies are automatically attached by `EventSource` (or with `withCredentials: true` for cross-site credentials), validate the session cookie inside the Route Handler:

```typescript
// app/api/secure-stream/route.ts
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Verify user session from incoming cookies
  const user = await getSessionUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Authorize channel / tenant permissions
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  if (!user.tenants.includes(tenantId)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Initiate SSE stream for verified user
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`: connected user=${user.id}\n\n`)
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

---

## 3. One-Time Ticket Exchange Pattern

For architectures where the client holds an in-memory Bearer token and needs to use standard browser `EventSource`, use a short-lived single-use ticket pattern:

```
Client (has JWT)                Next.js API                          SSE Endpoint
      │                              │                                    │
      │── 1. POST /api/sse/ticket ───▶│ (Verifies JWT, generates ticket)   │
      │   (Authorization: Bearer)    │ (Stores in Redis with 30s TTL)     │
      │◀── 2. { ticket: "tkt_123" } ─│                                    │
      │                              │                                    │
      │── 3. new EventSource("/api/sse?ticket=tkt_123") ─────────────────▶│
      │                                                                   │ (Consumes & deletes ticket)
      │                                                                   │ (Starts streaming)
      │◀────────────────── 4. SSE Events Stream ──────────────────────────│
```

```typescript
// app/api/sse/ticket/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/auth/jwt";
import { redis } from "@/lib/redis";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  const payload = await verifyJwt(token);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticket = crypto.randomBytes(24).toString("hex");
  // Store user context in Redis with 30-second single-use TTL
  await redis.set(`sse_ticket:${ticket}`, JSON.stringify(payload), "EX", 30);

  return NextResponse.json({ ticket });
}
```

```typescript
// app/api/sse/route.ts
import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket");
  if (!ticket) {
    return new Response("Missing ticket", { status: 401 });
  }

  // Atomically get and delete ticket (single-use guarantee)
  const userData = await redis.getdel(`sse_ticket:${ticket}`);
  if (!userData) {
    return new Response("Invalid or expired ticket", { status: 401 });
  }

  const user = JSON.parse(userData);
  // Continue opening stream for authorized user...
}
```

---

## 4. CORS & Cross-Origin Configuration

When streaming to a client hosted on a different domain or mobile app, configure explicit CORS headers and handle preflight `OPTIONS` requests:

```typescript
// app/api/public-events/route.ts
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || "https://app.example.com";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Last-Event-ID",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(": connected\n\n"));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
```

---

## 5. DoS Prevention & Connection Limits

Persistent connections consume server memory and file descriptors. Protect your application against resource exhaustion:

1. **Per-User Connection Rate Limiting:** Enforce a maximum number of concurrent open SSE connections per user ID or IP (e.g. max 5 connections).
2. **Client Heartbeat Inactivity Pruning:** If a client stream fails to acknowledge or the TCP socket enters a half-open state, ensure server heartbeat write failures immediately invoke `controller.close()` and free resources.
3. **Payload Compression Avoidance:** Never enable gzip/deflate on continuous SSE streams (`Content-Encoding: none`); compression algorithms buffer tokens waiting for large blocks, breaking real-time delivery and multiplying memory usage.

