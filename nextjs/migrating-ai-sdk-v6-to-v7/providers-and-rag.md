# Providers, RAG Embeddings, MCP, File Parts

## 1. `@ai-sdk/openai` (v4) — embeddings rename

```ts
// v6 (deprecated in v4, still compiles with a warning)
resolved.sdkProvider.textEmbeddingModel(modelId);

// v7
resolved.sdkProvider.embeddingModel(modelId); // preferred
// or: resolved.sdkProvider.embedding(modelId);
```

`createOpenAI({ baseURL, apiKey, headers })` signature is **unchanged**. `.chat(modelId)` unchanged. Per-user base URLs, decrypted API keys, and custom headers keep working.

## 2. `@ai-sdk/anthropic` (v4), `@ai-sdk/google` (v4), `@openrouter/ai-sdk-provider` (v3)

- **`@ai-sdk/anthropic` (4.x)**: `createAnthropic({ apiKey, headers, baseURL })` factory signature is unchanged. Model invocations like `anthropic("claude-sonnet-4-5")` work seamlessly.
- **`@ai-sdk/google` (4.x)**: `createGoogleGenerativeAI({ apiKey })` and `createGoogle({ apiKey })` both work. Model invocations like `google("gemini-2.0-flash")` work as expected.
- **`@openrouter/ai-sdk-provider` (3.x)**: Upgrade to `3.0.0` for full `ai@7.x` compatibility. `createOpenRouter({ apiKey })` factory signature is unchanged.

## 3. Background Job & Workflow Executors (`generateText` / `step.ai.wrap`)

For durable background jobs (e.g. Inngest `step.ai.wrap`, Temporal, BullMQ) or server-side workflows:

```ts
// v6
const { steps } = await step.ai.wrap("generate-text", generateText, {
  model: anthropic("claude-sonnet-4-5"),
  system: systemPrompt,
  prompt: userPrompt,
  experimental_telemetry: {
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true,
  },
});

// v7
const { steps } = await step.ai.wrap("generate-text", generateText, {
  model: anthropic("claude-sonnet-4-5"),
  instructions: systemPrompt, // renamed from system
  prompt: userPrompt,
  telemetry: {                // renamed from experimental_telemetry
    isEnabled: true,
    recordInputs: true,
    recordOutputs: true,
  },
});
```

- When accessing text output from steps: `steps[0].content[0].type === "text" ? steps[0].content[0].text : ""` remains valid in v7. Alternatively, `result.text` is directly available on the `generateText` result.

## 4. MCP (`@ai-sdk/mcp` v2)

- `createMCPClient` and the client methods used in discovery (`tools()`, `close()`, `listTools`, `listResources`, `listResourceTemplates`, `callTool`) are **unchanged**.
- **`redirect` default flipped `'follow'` → `'error'`** (SSRF hardening). A transport config with explicit `redirect: "error"` needs no change — keep it as documentation of intent. If any MCP server legitimately redirects, set `redirect: "follow"` explicitly.
- `name` option deprecated → `clientName` (only if used).
- Streamable-HTTP transport shape `{ type: "http", url, redirect, headers? }` unchanged.

## 5. File parts (attachments / multimodal messages)

v7 file parts carry a **tagged `data` union** and **`mediaType`** — there is **no `mimeType` field**. The codemod's `replace-image-message-part-with-file` output is wrong (emits `mimeType` + bare `data`); correct it.

User-message content part:

```ts
// v6 (deprecated)
{ type: "image", image: url, mimeType: "image/png" }

// v7 — ModelMessage FilePart
{ type: "file", data: { type: "url", url }, mediaType: "image" }
// data union: { type: "data", data } | { type: "url", url } |
//             { type: "reference", reference } | { type: "text", text }
// mediaType accepts full IANA type ('image/png') or top-level segment ('image')
```

Note: the streamText reference page shows `FilePart.data` as a bare `string | Uint8Array | Buffer | ArrayBuffer | URL` in places — the provider layer (`LanguageModelV4FilePart`) uses the tagged union. The tagged form is the verified-correct choice for `ModelMessage` content in ai@7.0.79 (typechecks and runs). If unsure, check `node_modules/@ai-sdk/provider/dist/index.d.ts` for the installed pin.

Tool-result content parts: `image-*` / legacy `file-*` / `media` variants collapse into the single `file` variant with the tagged `data` union (runtime auto-migration exists; migrate explicitly). New `reasoning-file` content type — add to exhaustive part handling if the app switches on part types.

## 6. Tool results in assembled history

`tool-result` parts in model messages keep the shape `{ type: "tool-result", toolCallId, toolName, output: { type: "json", value } }` — **no legacy `result` field**, unchanged v6→v7. In `steps[].toolResults`, the payload read `(tr as any).result ?? (tr as any).output` remains a valid defensive read.
