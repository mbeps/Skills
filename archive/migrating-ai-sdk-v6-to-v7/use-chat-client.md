# `useChat` Client Hook + Transport

The `@ai-sdk/react` v4 client surface. The project typically already uses the v7-era pattern (`useChat` + `DefaultChatTransport`) — the upgrade mostly *removes* nothing here but adds one status value and one trap.

## v7 shape (already correct in most v6-era projects)

```ts
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai"; // exported from `ai`, not @ai-sdk/react

const [transport] = useState<any>(
  () =>
    new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async ({ body }) => ({ body: body ?? {} }),
    }),
);

const chat = useChat<UIMessage>({
  id: chatId,
  transport,
  onError: (error) => { ... },
  onFinish: async ({ message, isAbort, isError }) => {
    // chat-level callback STAYS `onFinish` in v7 — do NOT rename to onEnd
    if (isError || isAbort) return;
    // ... persist via the app's store action
  },
});
```

## What changed in v7

1. **`onFinish` stays `onFinish` at the chat level.** `ChatInit` (the `useChat` options) still declares `onFinish?: ChatOnFinishCallback` — the payload `{ message, messages, isAbort, isDisconnect, isError, finishReason? }` is identical v6→v7. Only `streamText`/`generateText`/`createUIMessageStream` renamed to `onEnd`. **The codemod wrongly renames `useChat`'s `onFinish` → `onEnd` — revert it.**
2. **HTTP options moved to the transport.** `api`/`headers`/`body`/`fetch`/`prepareSendMessagesRequest` as `useChat` options are gone — they only exist on `DefaultChatTransport`. If any call site still passes them to `useChat`, wrap them in a transport.
3. **`ChatStatus` gained `'error'`** (`'submitted' | 'streaming' | 'ready' | 'error'`). Check every derivation:
   - `isLoading = status === "submitted" || status === "streaming"` — unaffected.
   - `streamingContent = status === "ready" ? null : ...` — **bug**: `'error'` now falls into the streaming branch. Guard it: `status === "ready" || status === "error" ? null : ...`.
   - Any exhaustive `switch (status)` breaks at compile time.
4. **Standalone `addMessage`/`removeMessage` helpers removed** from `@ai-sdk/react`. If the app's `addMessage` is a Zustand/other store action (not an SDK import), zero migration cost — keep persisting via the store.
5. **`sendMessage(message, options)` two-arg shape unchanged** — `sendMessage({ text }, { body: {...} })` still works.

## Client part shapes (consumed via `any` in most apps)

- `dynamic-tool` part still in the `UIMessagePart` union; the streaming states (`input-available`, `output-available`, …) and `input`/`output` fields are unchanged. `output: { type, value }` on tool-result parts — no legacy `result` field.
- `ReasoningUIPart` / `TextUIPart` / `FileUIPart` shapes unchanged in v7.
- `isToolOrDynamicToolUIPart` is removed → use `isToolUIPart` (+ `isDynamicToolUIPart`).

## Duplicated-type-identity note

`@ai-sdk/react` bundles its own `ai` copy → strict typing across the transport boundary fights duplicate type identity. Mitigate by exact-version install + `npm ls ai` dedupe (see `versions-and-gates.md`). Keeping the transport boundary typed `any` with runtime-tested behaviour is an accepted `ponytail:` pattern.
