# Next.js App Router Streaming & Route Handlers

The Vercel AI SDK integrates natively with the Next.js App Router (`app/` directory). In Next.js, streaming can be implemented via direct HTTP data stream responses or decoupled background streaming.

---

## 1. Direct Route Handler vs Asynchronous Background Streaming

| Dimension | Route Handler (`toDataStreamResponse`) | Background Stream Dispatch (Inngest + Realtime) |
|---|---|---|
| **Best For** | Short, single-turn conversational chatbots | Complex agentic apps, subagent workflows, reasoning models |
| **Timeout Risk** | Hard 15–60s Vercel/proxy server timeouts | Zero timeout risk (runs in durable background workers) |
| **Connection Drop** | Connection lost on tab sleep, network glitch, or refresh | Survives tab sleep, page refresh, and reconnects seamlessly |
| **Concurrency** | Difficult to coordinate cross-device active turns | Database or queue concurrency locks (`concurrency: 1`) per chat |
| **Cancellation** | Browser closes TCP socket; server may run detached | Clean, guaranteed two-tier cancellation (`stop` route + worker abort) |

---

## 2. Direct Streaming Route Handler (`toDataStreamResponse`)

For standard chatbots without complex multi-step background tool pipelines:

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const maxDuration = 60; // Extend maximum function duration (seconds)
export const runtime = "nodejs"; // Recommended for database and encryption access
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, conversationId } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    instructions: "You are an intelligent assistant.",
    messages,
    temperature: 0.7,
  });

  return result.toDataStreamResponse({
    headers: {
      "X-Conversation-Id": conversationId ?? "",
    },
  });
}
```

---

## 3. UI Message Stream Protocol & Custom Stream Wrappers (`createUIMessageStreamResponse`)

When fine-grained control over the streamed SSE wire protocol is needed (e.g. injecting transient notifications, emitting custom `messageId` start chunks, or sanitizing error payloads), use the **UI Message Stream** constructors:

- `createUIMessageStream({ execute, onError })`: Manual stream builder providing a `writer` with `.write()` and `.merge()`.
- `createUIMessageStreamResponse({ status, statusText, headers, stream, consumeSseStream })`: Creates the HTTP SSE Response for App Router route handlers.
- `toUIMessageStream({ stream, tools, sendReasoning, sendSources, sendStart, sendFinish, onError })`: Converts a `streamText().stream` into UI Message Stream chunks.
- `convertToModelMessages(messages, { tools })`: Converts incoming client `UIMessage[]` to server `ModelMessage[]`.

```typescript
// app/api/chat/route.ts
import { openai } from "@ai-sdk/openai";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  convertToModelMessages,
} from "ai";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = convertToModelMessages(messages);

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      // 1. Emit server-assigned messageId immediately
      const messageId = crypto.randomUUID();
      writer.write({ type: "start", messageId });

      // 2. Stream generation with abort forwarding
      const result = streamText({
        model: openai("gpt-4o"),
        messages: modelMessages,
        abortSignal: req.signal,
      });

      // 3. Merge stream, suppressing default duplicate start event
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendStart: false,
          sendReasoning: true,
        }),
      );
    },
    onError: (error) => {
      // Never leak raw provider secrets or unhandled stack traces
      return "An unexpected error occurred while generating the response.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

---

## 4. Dispatched Background Streaming Route Handler

For production apps with tools, reasoning models, and subagents, dispatch from the route handler and return immediately:

```typescript
// app/api/chat/route.ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { chatId, userMessageId, model, reasoningEffort } = body;

  const rateLimit = checkRateLimit(`chat:${session.user.id}`, 20);
  if (!rateLimit.allowed) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Dispatch durable background generation
  await inngest.send({
    name: "chat/response.generate",
    data: {
      chatId,
      userId: session.user.id,
      userMessageId,
      model,
      reasoningEffort,
    },
  });

  // Return immediately; client listens via Inngest Realtime / SSE
  return Response.json({ success: true, chatId, userMessageId });
}
```

---

## 5. Immediate Stream Cancellation Endpoint

Provide a dedicated stop route that aborts the in-process fetch immediately and dispatches a background cancel event:

```typescript
// app/api/chat/stop/route.ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId } = await req.json();

  // 1. In-process abort (kills active ReadableStream immediately)
  chatAbortRegistry.abort(chatId);

  // 2. Publish Inngest cancel event (kills queue/worker execution across instances)
  await inngest.send({
    name: "chat/response.cancel",
    data: { chatId, userId: session.user.id },
  });

  return Response.json({ success: true });
}
```

---

## 6. Server Actions with `generateText` / `generateObject`

For workflows triggered by standard React Form Actions, use Server Actions:

```typescript
// app/actions/generate-title.ts
"use server";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function generateWorkflowTitleAction(description: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    instructions: "Generate a concise 3-5 word title for an automation workflow. Return ONLY the title.",
    prompt: description,
    maxTokens: 30,
  });

  return { title: text.trim().replace(/^["']|["']$/g, "") };
}
```

---

## 7. App Router Configuration Directives

Place these route segment configs at the top of route files:

```typescript
// Prevents Next.js default timeout on long generations
export const maxDuration = 60;

// Runtime selection:
// "nodejs" (recommended when accessing ORM, native crypto, or custom native modules)
export const runtime = "nodejs";

// Prevent Next.js from caching dynamic AI POST routes
export const dynamic = "force-dynamic";
```
