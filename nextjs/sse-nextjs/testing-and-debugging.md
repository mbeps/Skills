# Testing & Debugging Server-Sent Events

This guide provides testing strategies with Vitest, unit tests for Route Handlers and React hooks, mock implementations, and command-line debugging techniques.

---

## 1. Unit Testing App Router SSE Route Handlers

When testing Next.js Route Handlers with Vitest, read chunks directly from the returned `Response.body` `ReadableStreamDefaultReader`:

```typescript
// __tests__/api/sse-route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/sse/route";
import { NextRequest } from "next/server";

describe("GET /api/sse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct SSE headers", async () => {
    const request = new NextRequest("http://localhost:3000/api/sse");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("streams initial connected event and heartbeat ping", async () => {
    const request = new NextRequest("http://localhost:3000/api/sse");
    const response = await GET(request);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial frame
    const firstChunk = await reader.read();
    expect(decoder.decode(firstChunk.value)).toContain(": connected");

    // Advance fake timers by 15s to trigger heartbeat
    vi.advanceTimersByTime(15_000);

    const secondChunk = await reader.read();
    expect(decoder.decode(secondChunk.value)).toContain(": ping");

    // Cleanup
    await reader.cancel();
  });
});
```

---

## 2. Unit Testing React Client Hooks (`useSSE`)

To test `useSSE` in a jsdom environment with `@testing-library/react`, mock `window.EventSource`:

```typescript
// __tests__/hooks/use-sse.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSSE } from "@/hooks/use-sse";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  listeners: Record<string, ((ev: MessageEvent) => void)[]> = {};
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (ev: MessageEvent) => void) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (ev: MessageEvent) => void) {
    this.listeners[type] = (this.listeners[type] || []).filter((l) => l !== listener);
  }

  emitMessage(data: unknown) {
    const event = new MessageEvent("message", {
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
    this.onmessage?.(event);
  }

  emitNamedEvent(name: string, data: unknown) {
    const event = new MessageEvent(name, {
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
    this.listeners[name]?.forEach((fn) => fn(event));
  }
}

describe("useSSE Hook", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  it("connects and updates state on incoming message", () => {
    const { result } = renderHook(() => useSSE<{ value: number }>("/api/sse"));

    expect(MockEventSource.instances).toHaveLength(1);
    const instance = MockEventSource.instances[0];

    // Simulate connection open
    act(() => {
      instance.onopen?.();
    });
    expect(result.current.status).toBe("OPEN");

    // Simulate incoming message
    act(() => {
      instance.emitMessage({ value: 42 });
    });
    expect(result.current.data).toEqual({ value: 42 });
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useSSE("/api/sse"));
    const instance = MockEventSource.instances[0];

    unmount();
    expect(instance.close).toHaveBeenCalledTimes(1);
  });
});
```

---

## 3. Command Line & Network Debugging

### Debugging with `curl`

Test your SSE endpoint from the terminal using `-N` (`--no-buffer`):

```bash
# Basic SSE stream inspection (unbuffered)
curl -N -v http://localhost:3000/api/sse

# Include custom headers or cookies
curl -N -v -H "Accept: text/event-stream" \
  -H "Cookie: session_token=abc123xyz" \
  http://localhost:3000/api/sse

# Test Last-Event-ID reconnection backfill
curl -N -v -H "Last-Event-ID: evt-105" http://localhost:3000/api/sse
```

### Inspecting in Chrome / Firefox DevTools

1. Open **DevTools** (`F12`) → **Network** tab.
2. Filter requests by **Fetch/XHR** or **Doc**.
3. Select the SSE endpoint request.
4. Click on the **EventStream** tab (next to Headers/Payload/Response).
5. Inspect individual SSE frames, including `Data`, `Event`, `Id`, and `Time`.

```
┌─────────────────────────────────────────────────────────────┐
│ Network > /api/events > EventStream                         │
├───────┬──────────────┬──────────────┬───────────────────────┤
│ Id    │ Event        │ Data         │ Time                  │
├───────┼──────────────┼──────────────┼───────────────────────┤
│       │ (comment)    │ connected    │ 12:00:01.102          │
│ 1001  │ order-status │ {"id":1001}  │ 12:00:03.450          │
│       │ (comment)    │ ping         │ 12:00:18.452          │
└───────┴──────────────┴──────────────┴───────────────────────┘
```

---

## 4. Troubleshooting Diagnostic Checklist

- [ ] **Are events arriving in bursts instead of in real time?** Check if NGINX or a CDN is buffering; verify `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform`.
- [ ] **Does the connection drop exactly every 60 seconds?** Check your reverse proxy (ELB / Cloudflare) idle socket timeout; reduce heartbeat ping interval to 15s.
- [ ] **Are there unhandled promise rejections on client disconnect?** Ensure `request.signal.addEventListener('abort')` cancels timers and closes stream controllers gracefully.
- [ ] **Is the browser stalling additional HTTP requests?** Ensure the site is running on HTTP/2 (HTTPS) to prevent exhausting the HTTP/1.1 6-connection per-host limit.

