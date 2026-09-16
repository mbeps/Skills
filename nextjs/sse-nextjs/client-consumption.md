client-consumption
---
# Client-Side SSE Consumption & React Hooks

This reference covers consuming Server-Sent Events in React and Next.js applications, comparing native `EventSource` with `fetch-event-source`, handling reconnects, building resilient React hooks, and integrating with global state managers (e.g. Zustand).

---

## 1. Native `EventSource` vs `@microsoft/fetch-event-source`

| Capability            | Native `window.EventSource`                                   | `@microsoft/fetch-event-source` / Custom `fetch`             |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| **HTTP Method**       | `GET` only                                                    | `GET`, `POST`, `PUT`, `DELETE`                               |
| **Request Headers**   | Cannot send custom headers (e.g. `Authorization: Bearer ...`) | Full control over custom request headers                     |
| **Request Body**      | No request payload                                            | Supports JSON / text request bodies                          |
| **Reconnection**      | Built-in browser automatic reconnect                          | Configurable custom exponential backoff                      |
| **Cookies**           | Supports cookies via `{ withCredentials: true }`              | Standard `credentials: 'include'` support                    |
| **Connection Access** | Read-only state; no manual signal abort                       | Full `AbortController` cancellation                          |
| **When to use**       | Public feeds, cookie-authenticated sessions                   | Bearer token auth, POST filters, fine-grained retry controls |

---

## 2. Production Ready React Hook (`useSSE`)

A robust custom hook handling typed payloads, named event listeners, automatic reconnect with exponential backoff, and strict React StrictMode cleanup.

```typescript
// hooks/use-sse.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionStatus = "CONNECTING" | "OPEN" | "CLOSED" | "ERROR";

export interface UseSSEOptions<T> {
  /** Event name to listen to. Defaults to standard 'message' event. */
  event?: string;
  /** Pass true to send credentials (cookies) in cross-origin requests. */
  withCredentials?: boolean;
  /** Initial fallback data before first event arrives. */
  initialData?: T;
  /** Callback fired whenever a new message is received. */
  onMessage?: (data: T) => void;
  /** Callback fired on connection error. */
  onError?: (error: Event) => void;
  /** Callback fired when connection opens. */
  onOpen?: () => void;
  /** Whether the stream is actively enabled. */
  enabled?: boolean;
}

export function useSSE<T>(url: string | null, options: UseSSEOptions<T> = {}) {
  const {
    event = "message",
    withCredentials = false,
    initialData,
    onMessage,
    onError,
    onOpen,
    enabled = true,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [status, setStatus] = useState<ConnectionStatus>("CLOSED");
  const [error, setError] = useState<Event | null>(null);

  // Store callbacks in refs to avoid restarting the EventSource on every render
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    if (!url || !enabled) {
      setStatus("CLOSED");
      return;
    }

    let isMounted = true;
    setStatus("CONNECTING");

    const es = new EventSource(url, { withCredentials });

    es.onopen = () => {
      if (!isMounted) return;
      setStatus("OPEN");
      setError(null);
      onOpenRef.current?.();
    };

    const handlePayload = (msgEvent: MessageEvent) => {
      if (!isMounted) return;
      try {
        const parsed: T = JSON.parse(msgEvent.data);
        setData(parsed);
        onMessageRef.current?.(parsed);
      } catch {
        const raw = msgEvent.data as unknown as T;
        setData(raw);
        onMessageRef.current?.(raw);
      }
    };

    if (event === "message") {
      es.onmessage = handlePayload;
    } else {
      es.addEventListener(event, handlePayload);
    }

    es.onerror = (err) => {
      if (!isMounted) return;
      // Browser EventSource automatically attempts to reconnect on error
      if (es.readyState === EventSource.CONNECTING) {
        setStatus("CONNECTING");
      } else {
        setStatus("CLOSED");
      }
      setError(err);
      onErrorRef.current?.(err);
    };

    return () => {
      isMounted = false;
      if (event !== "message") {
        es.removeEventListener(event, handlePayload);
      }
      es.close();
      setStatus("CLOSED");
    };
  }, [url, event, withCredentials, enabled]);

  return { data, status, error };
}
```

---

## 3. Advanced Fetch-Based SSE with Bearer Auth

When you need custom headers (e.g. `Authorization: Bearer <jwt>`) or `POST` requests, consume the stream via native `fetch` and `ReadableStreamDefaultReader`:

```typescript
// lib/sse/fetch-sse.ts
export interface FetchSSEOptions {
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  method?: "GET" | "POST";
  signal?: AbortSignal;
  onMessage: (event: { event?: string; data: string; id?: string }) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export async function fetchSSE(options: FetchSSEOptions) {
  const { url, headers = {}, body, method = "GET", signal, onMessage, onError, onClose } = options;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE stream failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      // Keep incomplete segment in the buffer
      buffer = messages.pop() ?? "";

      for (const rawMessage of messages) {
        if (!rawMessage.trim() || rawMessage.startsWith(":")) {
          continue; // Skip comments and empty pings
        }

        const lines = rawMessage.split("\n");
        let eventName: string | undefined;
        let eventId: string | undefined;
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("id:")) {
            eventId = line.slice(3).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }

        onMessage({
          event: eventName,
          id: eventId,
          data: dataLines.join("\n"),
        });
      }
    }

    onClose?.();
  } catch (err: unknown) {
    if ((err as Error).name === "AbortError") {
      onClose?.();
      return;
    }
    onError?.(err as Error);
  }
}
```

---

## 4. Global State Integration with Zustand

For application-wide real-time updates (e.g. global alert notifications, real-time inventory), manage the SSE connection in a centralized Zustand store rather than re-opening multiple connections per component.

```typescript
// stores/realtime-store.ts
import { create } from "zustand";

interface RealtimeState {
  isConnected: boolean;
  alerts: Array<{ id: string; message: string; timestamp: string }>;
  eventSource: EventSource | null;
  connect: (url: string) => void;
  disconnect: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  isConnected: false,
  alerts: [],
  eventSource: null,

  connect: (url: string) => {
    // Avoid duplicate connections
    if (get().eventSource) return;

    const es = new EventSource(url);

    es.onopen = () => {
      set({ isConnected: true });
    };

    es.addEventListener("alert", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        set((state) => ({
          alerts: [payload, ...state.alerts.slice(0, 49)], // keep last 50
        }));
      } catch (e) {
        console.error("Failed to parse alert event:", e);
      }
    });

    es.onerror = () => {
      set({ isConnected: false });
    };

    set({ eventSource: es });
  },

  disconnect: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      set({ eventSource: null, isConnected: false });
    }
  },
}));
```

---

## 5. Handling React 18 / 19 StrictMode

In development, React StrictMode mounts, unmounts, and re-mounts components immediately to detect side effects.

**Correct cleanup ensures no zombie connections:**
1. Always call `eventSource.close()` or `abortController.abort()` in the `useEffect` cleanup return function.
2. Maintain an `isMounted` boolean flag inside `useEffect` to discard callbacks that fire after unmount.
3. Consolidate subscriptions so only one `EventSource` per topic exists globally.

