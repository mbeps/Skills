# SSE Architecture, Scaling & Multi-Instance Broadcasting

This reference covers scaling Server-Sent Events in production Next.js environments, comparing single-instance in-memory broadcasters against horizontally scaled distributed architectures (Redis Pub/Sub, Upstash), and navigating serverless hosting constraints.

---

## 1. Architecture Patterns

### Pattern A: In-Memory Broadcaster (Single Instance / Container)

When running Next.js as a standalone Node.js server (Docker container, single VM, AWS ECS task), route handlers share the same Node.js runtime process. A singleton in-memory manager can store connected client stream controllers and broadcast events directly.

```typescript
// lib/sse/in-memory-broadcaster.ts

interface ConnectedClient {
  id: string;
  controller: ReadableStreamDefaultController;
  cleanup: () => void;
}

class InMemorySSEBroadcaster {
  private clients = new Map<string, ConnectedClient>();

  /** Register client controller */
  public addClient(id: string, controller: ReadableStreamDefaultController, cleanup: () => void) {
    const client: ConnectedClient = { id, controller, cleanup };
    this.clients.set(id, client);
    return client;
  }

  /** Remove client controller */
  public removeClient(id: string) {
    const client = this.clients.get(id);
    if (client) {
      this.clients.delete(id);
      client.cleanup();
    }
  }

  /** Broadcast payload to all active clients; silently prune dead streams */
  public broadcast<T>(event: string, data: T) {
    if (this.clients.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = new TextEncoder().encode(payload);
    const deadClientIds: string[] = [];

    for (const [id, client] of this.clients.entries()) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        // Stream closed or broken on client side
        deadClientIds.push(id);
      }
    }

    for (const id of deadClientIds) {
      this.removeClient(id);
    }
  }

  public get size(): number {
    return this.clients.size;
  }
}

// Export singleton instance
export const sseBroadcaster = new InMemorySSEBroadcaster();
```

---

### Pattern B: Horizontally Scaled with Redis Pub/Sub

When scaling Next.js across multiple container instances, Kubernetes pods, or serverless workers, clients are distributed across different processes. An event emitted on Node A must reach clients connected to Node B via a shared message broker like Redis.

```typescript
// lib/sse/redis-broadcaster.ts
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Publisher connection
export const redisPub = new Redis(redisUrl);

// Subscriber connection (dedicated for listening)
export const createRedisSub = () => new Redis(redisUrl);

/**
 * Publishes an event to a specific channel across all Next.js instances.
 */
export async function publishSSEEvent<T>(channel: string, eventName: string, data: T) {
  const message = JSON.stringify({ event: eventName, data, timestamp: Date.now() });
  await redisPub.publish(channel, message);
}
```

```typescript
// app/api/channels/[channelId]/route.ts
import { NextRequest } from "next/server";
import { createRedisSub } from "@/lib/sse/redis-broadcaster";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const encoder = new TextEncoder();
  const redisSub = createRedisSub();

  const stream = new ReadableStream({
    async start(controller) {
      // 1. Initial connection ack
      controller.enqueue(encoder.encode(": connected\n\n"));

      // 2. Subscribe to Redis channel
      await redisSub.subscribe(channelId);

      redisSub.on("message", (channel, message) => {
        if (channel !== channelId) return;
        try {
          const parsed = JSON.parse(message);
          const ssePayload = `event: ${parsed.event}\ndata: ${JSON.stringify(parsed.data)}\n\n`;
          controller.enqueue(encoder.encode(ssePayload));
        } catch {
          // Ignore malformed payload
        }
      });

      // 3. Heartbeat ping
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // 4. Handle client disconnect
      request.signal.addEventListener("abort", async () => {
        clearInterval(heartbeat);
        redisSub.disconnect();
        try {
          controller.close();
        } catch {}
      });
    },

    cancel() {
      redisSub.disconnect();
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

## 2. Serverless & Hosting Constraints

### Execution Duration Caps

| Platform                       | Typical Serverless Timeout        | SSE Strategy                                                                                     |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Vercel Hobby**               | 10s–60s max execution             | Stream closes after timeout. Client `EventSource` automatically reconnects with `Last-Event-ID`. |
| **Vercel Pro / Enterprise**    | Up to 300s (Fluid Compute) / 900s | Extended stream duration. Gracefully send reconnect signals before hard timeout.                 |
| **AWS Lambda**                 | 15 minutes max                    | Lambda response streaming (`awslabs/aws-lambda-web-adapter`).                                    |
| **Node.js Docker / ECS / K8s** | Indefinite (hours/days)           | Full persistent SSE connections with standard heartbeats.                                        |

### Graceful Serverless Reconnection Pattern

To avoid unhandled 504 Gateway Timeouts when a serverless function reaches its maximum runtime limit, proactively terminate the stream 5 seconds before the hard limit and instruct the client to reconnect immediately:

```typescript
// Auto-recycle connection before Vercel execution timeout (e.g. 55s limit)
const MAX_STREAM_DURATION_MS = 50_000;

setTimeout(() => {
  try {
    // Advise client to reconnect immediately (0ms retry)
    controller.enqueue(encoder.encode("retry: 0\n\n"));
    controller.close();
  } catch {}
}, MAX_STREAM_DURATION_MS);
```

---

## 3. HTTP/1.1 vs HTTP/2 Connection Multiplexing

### The 6-Connection Browser Bottleneck (HTTP/1.1)

In HTTP/1.1, browsers enforce a strict limit of **6 concurrent TCP connections per origin**. If a user opens multiple browser tabs or a single page opens multiple SSE streams over HTTP/1.1, the 7th request blocks all subsequent HTTP requests (including image loads and API fetches) until one connection closes.

### Solutions:
1. **Always enable HTTP/2 in production (HTTPS):** HTTP/2 multiplexes hundreds of concurrent requests and streams over a single TCP socket.
2. **Consolidate multi-topic subscriptions:** Rather than opening separate SSE connections for notifications, chat, and status updates, open one global stream passing a query parameter (`/api/events?topics=notifications,status,chat`) and route incoming events by event name (`event: notifications`).

