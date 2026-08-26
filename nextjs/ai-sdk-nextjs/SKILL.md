---
name: ai-sdk-nextjs
description: Use when building or modifying AI chat, streaming, or tool-calling features in a Next.js App Router TypeScript app with Vercel AI SDK v7 — useChat, streamText, generateText, generateObject, streamObject, embeddings, MCP tools, multi-step agentic flows, UI Message Stream protocol, route handlers, providers, and v6 to v7 migration.
---

# AI SDK v7 × Next.js App Router

Vercel AI SDK v7 streaming, structured output, tool calling, and multi-step agentic flows in Next.js App Router (TypeScript). The v7 wire protocol is the **UI Message Stream** (SSE with JSON parts); the v6 data-stream protocol is removed.

**Core principle:** `streamText` for streaming UIs via `useChat`, `generateText` for non-streaming calls. Client and server `onFinish` differ — only the server function renamed it to `onEnd`.

## When to Use
- Adding or changing AI chat routes, `useChat` UI, streaming, or tool calling in a Next.js App Router app.
- Structured generation (`generateObject`/`streamObject`), embeddings, or multi-step agentic flows (`stopWhen`/`isStepCount`).
- Wiring providers (OpenAI, Anthropic, Google, OpenAI-compatible), model registries, or MCP tools.
- Debugging v6→v7 renames, stream protocol errors, or client `onFinish` vs server `onEnd` confusion.

## When NOT to Use
- v6 codebases still on the data-stream protocol — read `migrating-ai-sdk-v6-to-v7` first.
- Non-Next.js servers: the SDK functions are the same, but transports and route handlers differ.

## Quick Reference

| API | Purpose |
|---|---|
| `streamText` | Streaming generation; `result.toUIMessageStream()` for the UI wire format |
| `generateText` | Non-streaming generation; `result.steps` / `result.finalStep` |
| `generateObject` / `streamObject` | Structured output via `output` + `mode` |
| `useChat` | React chat hook; `sendMessage`, `status`, `parts` |
| `DefaultChatTransport` | Transport wired to `/api/chat`; options passed to `useChat` |
| `createUIMessageStreamResponse` | Returns the UI Message Stream response from a route handler |
| `tool()` | Define a callable tool with `inputSchema`/`execute` |
| `createMCPClient` | Expose MCP server tools to the SDK |
| `isStepCount` + `stopWhen` | Multi-step control (replaces removed `maxSteps`) |
| `createProviderRegistry` / `customProvider` | Model registry and provider composition |

## Reference Files

Read [setup.md](./setup.md) for install, providers, env vars, and model selection.
Read [streaming.md](./streaming.md) for route handlers, the UI Message Stream protocol, custom stream wrappers, and `useChat`.
Read [generate-and-structured.md](./generate-and-structured.md) for `generateText`, `generateObject`/`streamObject`, and embeddings.
Read [tools-and-agentic.md](./tools-and-agentic.md) for `tool()`, MCP, `activeTools`, and multi-step agentic flows.
Read [migration-v6-to-v7.md](./migration-v6-to-v7.md) for the v6→v7 rename table and gotchas.
Read [references.md](./references.md) for official docs and real-project references.
