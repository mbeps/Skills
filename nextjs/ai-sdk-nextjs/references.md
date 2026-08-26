# References: official docs & real projects

## Official docs

| Topic                       | URL                                                           |
| --------------------------- | ------------------------------------------------------------- |
| v7 migration guide          | https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0  |
| Streaming data (UI)         | https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data              |
| useChat reference           | https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat          |
| Chatbot message persistence | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence |
| LangChain adapter streaming | https://ai-sdk.dev/providers/adapters/langchain               |

## Real-project references

### ai-client (streaming chat + tools + MCP)
- `app/api/chat/route.ts` — `streamText` with `instructions`, `messages`, conditional `tools`, `stopWhen: isStepCount(env.CHAT_MAX_STEPS)`, `abortSignal: req.signal`, `onAbort({ steps })`, `onEnd` filling a `FinishRef`.
- Custom stream wrapper `createChatStream` — `createUIMessageStream` with custom `start` chunk + `toUIMessageStream({ sendStart: false })`; sanitising `onError`; abort persistence.
- `useChat` with `DefaultChatTransport({ api: '/api/chat', prepareSendMessagesRequest })`; `sendMessage({ text }, { body })`; `status` drives loading; abort on unmount.
- MCP via `createMCPClient` + `client.tools()` merged with `Promise.allSettled`, SSRF-guarded base URLs, `finally` close.

### ai-workflow-automations (server-only, durable)
- `generateText` wrapped in Inngest `step.ai.wrap("id", generateText, { model, instructions, prompt, telemetry })` for durable memoised execution.
- Handlebars-compiled system/user prompts; per-user decrypted API key → `createOpenAI({ apiKey })` per execution.
- `telemetry: { isEnabled: true, recordInputs: true, recordOutputs: true }`.
- Extraction reads `steps[0].content[0]`; progress via Inngest Realtime, not the AI SDK streaming protocol.

## Versions (verified)

`ai@7.0.79`, `@ai-sdk/react@4.0.82`, `@ai-sdk/openai@4.0.47`, `@ai-sdk/anthropic@4.0.42`, `@ai-sdk/google@4.0.51`, `@ai-sdk/mcp@2.0.37`.
