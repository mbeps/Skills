# Streaming: route handlers, UI Message Stream, useChat

## v7 wire protocol

`toDataStreamResponse`, `createDataStream`, and `formatDataStreamPart` are **removed** in v7. The protocol is the **UI Message Stream**: SSE carrying JSON parts. Constructors:

- `createUIMessageStreamResponse({ status, statusText, headers, stream, consumeSseStream })` — route handler return.
- `createUIMessageStream({ execute, onError })` — manual stream, low-level `writer.write`.
- `toUIMessageStream({ stream, tools, sendReasoning, sendSources, sendStart, sendFinish, onError })` — converts a `streamText` result stream.

## Route handler (official example)

```ts
// app/api/chat/route.ts
import { openai } from '@ai-sdk/openai';
import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'data-notification', data: { message: 'Started' }, transient: true });
      const result = streamText({ model: openai('gpt-5.4'), messages });
      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
  });
  return createUIMessageStreamResponse({ stream });
}
```

Pass `abortSignal: req.signal` to `streamText`/`generateText` to cancel on client disconnect.

## Custom stream wrapper (from ai-client)

`createChatStream` writes a custom `start` chunk with a server-assigned `messageId`, then merges with `sendStart: false` so the SDK's second start chunk is suppressed. `onError` sanitises (never leak provider errors); an abort listener persists partial results. To convert UI messages server-side, use `convertToModelMessages(messages, { tools })`.

```ts
createUIMessageStream({
  execute: ({ writer }) => {
    writer.write({ type: 'start', messageId: crypto.randomUUID() });
    const result = streamText({ model, instructions, messages, stopWhen });
    writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
  },
  onError: (error) => sanitised, // never leak provider errors
})
```

Returns `createUIMessageStreamResponse({ stream })`.

## Background Streaming (Surviving Page Navigation & Reloads)

Standard HTTP route handlers (`createUIMessageStreamResponse`) abort generation when the user navigates away or refreshes. For workflows, durable agent tasks, or generation that must survive navigation:
1. **Durable background execution:** Dispatch a background job (e.g. via Inngest or a durable worker queue).
2. **Server-side streaming:** The background function runs `streamText`, streams token and tool deltas over a WebSocket pub/sub channel (e.g. `inngest.realtime.publish`), and saves the final message to the database upon completion.
3. **Client-side subscription & hydration:** The client UI subscribes to the channel via WebSocket (`useRealtime`), receiving live tokens. When the user navigates away or reloads, server components hydrate the finished message from the database.
4. **Resilience fallback:** Pair client WebSocket subscriptions with an error & watchdog fallback: if the WebSocket drops or errors, query the database for the completed response to prevent infinite loading states.

## useChat (@ai-sdk/react)

Options take `chat: Chat | ChatInit` (`id`, `messages` — NOT `initialMessages`, `generateId`, `transport`, `messageMetadataSchema`, `dataPartSchemas`, `onError`, `onToolCall`, `onFinish`, `onData`, `sendAutomaticallyWhen`, `throttle`).

```tsx
const chat = useMemo(() => new DefaultChatTransport({
  api: '/api/chat',
  prepareSendMessagesRequest: async ({ body }) => ({ body: body ?? {} }),
}), []);

const { sendMessage, status, messages, stop } = useChat({
  chat,
  onFinish: ({ message, isAbort, isError }) => { /* client-side persist */ },
});

useEffect(() => () => void stop(), [stop]); // abort on unmount
```

Helpers: `sendMessage`, `regenerate`, `stop`, `resumeStream`, `addToolOutput` (was `addToolResult`), `addToolApprovalResponse`, `status`, `messages`, `error`, `clearError`, `setMessages`. No managed `input`/`handleSubmit` — use `useState`. `status` is `'submitted' | 'streaming' | 'ready' | 'error'`. `initialMessages` → `messages`; `append` → `sendMessage`; `reload` → `regenerate`.

**CRITICAL GOTCHA:** the client `useChat` callback stays `onFinish` (in `@ai-sdk/react` 4.x), receiving `{ message, isAbort, isError }`. Only the **server** `streamText`/`generateText` renamed `onFinish` → `onEnd`. Never rename the client `onFinish`.

## Rendering parts

A `UIMessage` is `{ id, role: 'system'|'user'|'assistant', metadata?, parts }`. Render by iterating `message.parts` and branching on `part.type` (`'text'`, `'reasoning'`, `'tool-call'`, `'tool-result'`, `'file'`). ai-client streams tool state via `p.type === 'dynamic-tool'` or `p.type.startsWith('tool-')`, reading `p.state` (`'input-available'`/`'output-available'`) and `p.input`/`p.output`.

## Error handling

Errors extend the base `AISDKError`. Catch specific subclasses: `APICallError` (not `APIError`), `InvalidPromptError`, `JSONParseError`, `LoadAPIKeyError`, `NoContentGeneratedError`, `NoSuchModelError`, `UnsupportedFunctionalityError`. There is **no** `AbortError` class — detect aborts with `isAbortError(error)` from `@ai-sdk/provider-utils`. Format messages with `getErrorMessage(error)` from `@ai-sdk/provider`.

- **PromiseLike Result Fields:** `result.finishReason` and `result.usage` implement `PromiseLike` rather than native `Promise`. Wrap with `Promise.resolve(result.finishReason).catch(...)` if attaching error handlers.
- **Client & Server Callbacks:** Client `useChat` exposes `status`, `error`, `clearError`, plus `onError`. Server `streamText` accepts `onError` and `onEnd({ isError, isAbort, finishReason })`; guard aborts with `isAbortError`.
