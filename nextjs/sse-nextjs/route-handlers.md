# Next.js Route Handlers & SSE Engine

This reference guide covers implementing, configuring, and optimizing Server-Sent Events in Next.js App Router (13.4+ / 14 / 15+).

---

## 1. Route Handler Architecture

In App Router, SSE endpoints are created as standard HTTP `GET` (or `POST`) functions returning a `Response` containing a web-standard `ReadableStream`.

```typescript
// app/api/events/route.ts
import { NextRequest } from "next/server";

// CRITICAL: Prevent static generation and response caching
export const dynamic = "force-dynamic";

// Select runtime: 'nodejs' (default) or 'edge'
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Stream initialization logic
    },
    cancel(reason) {
      // Invoked when stream is cancelled or consumer closes connection
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disables response buffering in NGINX
      "Content-Encoding": "none", // Prevents GZIP/Brotli chunk accumulation
    },
  });
}
```

---

## 2. Mandatory HTTP Headers

| Header              | Value                              | Purpose                                                                          |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `Content-Type`      | `text/event-stream; charset=utf-8` | W3C MIME type instructing browser to invoke `EventSource` parser                 |
| `Cache-Control`     | `no-cache, no-transform`           | Prevents proxy caching and data transformation (e.g. compression buffers)        |
| `Connection`        | `keep-alive`                       | Informs HTTP/1.1 gateways not to terminate the socket                            |
| `X-Accel-Buffering` | `no`                               | Directs NGINX reverse proxies to bypass response buffering and flush immediately |
| `Content-Encoding`  | `none`                             | Prevents middleware or proxies from attempting to compress the infinite stream   |

---

## 3. Wire Protocol & Message Serialization

The SSE protocol requires UTF-8 text formatted with specific field keywords followed by a colon and space. Each event ends with a double newline (`\n\n`).

### Message Formatter Utility

```typescript
// lib/sse/format.ts

export interface SSEMessage<T = unknown> {
  id?: string | number;
  event?: string;
  data: T;
  retry?: number;
  comment?: string;
}

/**
 * Formats a message according to the SSE wire specification.
 */
export function formatSSEMessage<T>(msg: SSEMessage<T>): string {
  let output = "";

  if (msg.comment) {
    output += `: ${msg.comment.replace(/\n/g, "\n: ")}\n`;
  }
  if (msg.id !== undefined) {
    output += `id: ${msg.id}\n`;
  }
  if (msg.event) {
    output += `event: ${msg.event}\n`;
  }
  if (msg.retry !== undefined) {
    output += `retry: ${msg.retry}\n`;
  }

  // Handle data serialization and multiline splits
  const payload = typeof msg.data === "string" ? msg.data : JSON.stringify(msg.data);
  const lines = payload.split("\n");
  for (const line of lines) {
    output += `data: ${line}\n`;
  }

  output += "\n"; // Trailing newline to terminate event block
  return output;
}
```

---

## 4. Heartbeat / Keep-Alive Implementation

Without active traffic, intermediary reverse proxies (AWS ALB, Cloudflare, NGINX, corporate firewalls) drop idle TCP sockets after 30–60 seconds. Keep sockets alive by sending periodic SSE comments (`: ping\n\n`) every 15 to 25 seconds.

```typescript
// app/api/live-data/route.ts
import { NextRequest } from "next/server";
import { formatSSEMessage } from "@/lib/sse/format";

export const dynamic = "force-dynamic";

const HEARTBEAT_INTERVAL_MS = 20_000;

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let isStreamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial confirmation comment
      controller.enqueue(encoder.encode(": connected\n\n"));

      // 2. Start heartbeat interval
      heartbeatTimer = setInterval(() => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (err) {
          clearInterval(heartbeatTimer!);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // 3. Listen to client abort
      request.signal.addEventListener("abort", () => {
        isStreamClosed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {}
      });
    },

    cancel() {
      isStreamClosed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

---

## 5. Resuming Streams with `Last-Event-ID`

When a client loses connection, `EventSource` automatically passes the last received `id` in the `Last-Event-ID` HTTP request header on reconnection (or custom query param `?lastEventId=...`).

```typescript
// app/api/audit-stream/route.ts
import { NextRequest } from "next/server";
import { getMissedEventsSince } from "@/lib/db/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lastEventId =
    request.headers.get("last-event-id") ||
    request.nextUrl.searchParams.get("lastEventId");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Backfill missed events if client reconnected
      if (lastEventId) {
        const missed = await getMissedEventsSince(lastEventId);
        for (const evt of missed) {
          const payload = `id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        }
      }

      // 2. Continue with live event subscriptions...
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

## 6. Edge Runtime vs Node.js Runtime

| Feature              | Node.js Runtime (`export const runtime = 'nodejs'`)      | Edge Runtime (`export const runtime = 'edge'`)      |
| -------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| **Execution limits** | Subject to server/container runtime configuration        | Strict execution time caps on serverless hosts      |
| **Node.js APIs**     | Full access (`EventEmitter`, `net`, `crypto`, `Buffer`)  | Limited to Web Standards (`fetch`, `crypto.subtle`) |
| **Database Drivers** | Native TCP drivers (Postgres `pg`, Prisma, MySQL, Redis) | HTTP/WebSocket based drivers (Upstash, Neon)        |
| **Process State**    | In-memory singletons work across requests (single host)  | Ephemeral instances (no shared in-memory state)     |
| **Recommendation**   | **Recommended default** for persistent pub/sub           | Best for stateless AI proxying & light transforms   |

---

## 7. Handling Next.js Middleware & Buffering

If you use `middleware.ts` in your Next.js application, ensure you do not inadvertently buffer or rewrite SSE streaming responses:

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Bypass middleware response rewriting for SSE streaming routes
  if (request.nextUrl.pathname.startsWith("/api/sse")) {
    return NextResponse.next();
  }

  // Other middleware logic...
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

