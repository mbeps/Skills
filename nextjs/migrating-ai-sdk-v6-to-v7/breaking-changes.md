# AI SDK v6 → v7 Breaking Changes Catalogue

Compiled 2026-08-26 from the official migration guide (ai-sdk.dev), the published packages (`ai@7.0.79`, `@ai-sdk/react@4.0.82`, `@ai-sdk/mcp@2.0.37`, `@ai-sdk/openai@4.0.47`), and the v6.0.168 type declarations. Every entry is either confirmed against the installed dist or flagged.

Legend: 🔴 removed · 🟠 renamed (alias works in 7.0.79, removed in v8) · 🟡 deprecated in v7 · 🔵 behaviour change (silent — the dangerous ones).

## 1. Rename map (mechanical)

| v6 | v7 | Applies to |
|---|---|---|
| `system:` option | `instructions:` 🟠 | `generateText`, `streamText`, `generateObject`, `streamObject`, `streamUI`, `prepareStep` returns, `experimental_repairToolCall`, lifecycle event fields |
| `{ role: "system" }` in `prompt`/`messages` | **REJECTED** 🔵 | runtime `InvalidPromptError` — see §2.1 |
| `onFinish` | `onEnd` 🟠 | `generateText`, `streamText`, agents, `ToolLoopAgent`, `createUIMessageStream`, `toUIMessageStream` |
| `onStepFinish` | `onStepEnd` 🟠 | same set |
| `stepCountIs(n)` | `isStepCount(n)` 🟠 | `stopWhen` helpers |
| `fullStream` | `stream` 🟡 (alias) | `streamText` result |
| `result.toUIMessageStream()` | stateless `toUIMessageStream({ stream: result.stream, ... })` 🟡 | result method deprecated; top-level helper |
| `experimental_onStart` / `experimental_onStepStart` | `onStart` / `onStepStart` 🟠 | `generateText`/`streamText` |
| `experimental_telemetry` | `telemetry` 🟠 | all calls; **OTel moved to `@ai-sdk/otel`** 🔵 (see §2.8) |
| `experimental_context` | `context` 🟠 + `runtimeContext`/`toolsContext` split 🔵 | tool callbacks |
| `needsApproval` on `tool()` | `toolApproval` config 🟡 | call/agent-level |
| `experimental_output` | `output` 🔴 | removed |
| `experimental_customProvider` | `customProvider` 🔴 | removed |
| `experimental_generateImage` | `generateImage` 🔴 | removed |
| `experimental_transcribe` / `experimental_generateSpeech` | `transcribe` / `generateSpeech` 🟠 | aliases kept |
| `experimental_activeTools` | `activeTools` 🔴 | removed |
| `ToolCallOptions` | `ToolExecutionOptions` 🔴 | type removed |
| `isToolOrDynamicToolUIPart` | `isToolUIPart` 🔴 | removed; new `isDynamicToolUIPart` |
| `includeRawChunks` / `experimental_include` | `include: { rawChunks, requestBody, ... }` 🟠 | `streamText` options |
| `usage` (final step) / `totalUsage` (all) | `usage` = **all steps** 🔵; `totalUsage` 🟡 | see §2.2 |
| `usage.cachedInputTokens` / `usage.reasoningTokens` | `usage.inputTokenDetails.cacheReadTokens` / `outputTokenDetails.reasoningTokens` 🔴 | removed top-level fields |
| `step.response.messages` (accumulated) | **that step's messages only** 🔵 | use `result.responseMessages` |
| `textEmbeddingModel` | `embeddingModel` (also `embedding`) 🟡 | `@ai-sdk/openai` provider |
| MCP `redirect` default | `'follow'` → **`'error'`** 🔵 | `@ai-sdk/mcp` HTTP/SSE transports |
| `callSettings` type | `LanguageModelCallOptions` + `RequestOptions` 🟠 | custom wrappers only |
| `experimental_onToolCallStart/Finish` | `onToolExecutionStart/End` 🟠 | tool lifecycle |

Deprecated aliases **still work in 7.0.79** — that is the trap: everything compiles, and the semantics change is the only thing that bites immediately. Do not defer renames; they are removed in v8.

## 2. Behavioural changes (silent — audit every read)

### 2.1 System messages rejected

`generateText`/`streamText` throw `InvalidPromptError: System messages are not allowed` when `messages[]` contains `{ role: "system" }`. Move system text to `instructions:`. Do **NOT** set `allowSystemInMessages: true` as a "fix" — it is a prompt-injection vector if users can influence messages. Grep the whole repo for `role: "system"` in message arrays (agentic loops like run-steps commonly hide one).

### 2.2 Multi-step result shape — THE critical audit

| v7 top-level result read | Semantics | v6 behaviour | Fix for v6 semantics |
|---|---|---|---|
| `result.text` | **final step only** (unchanged) | final step only | none |
| `result.reasoningText` | final step only (deprecated) | final step only | `finalStep.reasoningText` |
| `result.reasoning` | final step only (deprecated) | final step only | `finalStep.reasoning` |
| `result.toolCalls` | **ALL steps** 🔵 | final step only | `finalStep.toolCalls` |
| `result.toolResults` | **ALL steps** 🔵 | final step only | `finalStep.toolResults` |
| `result.content` / `files` / `sources` / `warnings` | **ALL steps** 🔵 | final step only | `finalStep.*` |
| `result.usage` | **ALL steps** 🔵 | final step only | `finalStep.usage` |
| `result.steps` | per-step, unchanged | per-step | — |
| `result.finalStep` | new accessor = last step | n/a | — |

Verified in `ai@7.0.79` dist: top-level `text`/`reasoning`/`reasoningText` getters read `this.finalStep.*`; `toolCalls`/`toolResults`/`content`/`files`/`sources`/`warnings` flatMap over `steps`. The official migration guide's aggregation list is `content, toolCalls, toolResults, files, sources, warnings` (+ `usage`) — **`text` is NOT in it**. If a design doc claims "text aggregates across steps", it is wrong for this pin — verify against `node_modules/ai/dist/index.js` before acting.

**For `streamText`, `finalStep` is a PromiseLike** — `await result.finalStep` (or `Promise.resolve(...)` wrap with `.catch`).

**`onEnd` event**: same semantics — `event.text`/`event.reasoning` final-step; `event.toolCalls`/`event.toolResults`/`event.usage` all steps; **`event.finalStep` is synchronous** (StepResult). Route `onEnd`-driven persistence through `event.finalStep.toolCalls` when you need the v6 final-step-only tool calls in the message tree.

### 2.3 `onChunk` receives ALL parts

`streamText.onChunk` now fires for every `TextStreamPart` including lifecycle/boundary/terminal parts (`start`, `start-step`, `text-start/end`, `reasoning-start/end`, `tool-input-end`, `finish-step`, `finish`, `abort`, `error`). Guard `chunk.type` before processing.

### 2.4 Request/response bodies excluded by default

`result.request.body` / `step.request.body` (and `result.response.body` for `generateText`) are `undefined` unless opted in: `include: { requestBody: true }` (and `include: { responseBody: true }` for `generateText` — both under the `include` object).

### 2.5 `NoOutputGeneratedError`

`streamText` **rejects** if the model stream ends with no output (v6 resolved with an empty step). Route-level `onError` sanitisation (a generic message) already covers this — verify, don't add raw error leakage.

### 2.6 `streamText` generics

`StreamTextResult` takes **3** generic args in v7: `StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>` — `StreamTextResult<any, any>` breaks compilation; use `StreamTextResult<any, any, any>`.

### 2.7 `createUIMessageStream` — no `abortSignal` option

Signature: `{ execute, onError, originalMessages?, onStepEnd?, onFinish? (alias), onEnd?, generateId? }`. If the project passes `abortSignal` to it, remove the option — the manual `addEventListener('abort', ...)` wiring on the signal is the sole abort path and stays.

### 2.8 Telemetry → `@ai-sdk/otel`

OTel is no longer built into `ai`. If the project uses `experimental_telemetry`, install `@ai-sdk/otel`, `registerTelemetry(new OpenTelemetry())` once (`instrumentation.ts` in Next.js), rename to `telemetry`, drop redundant `isEnabled: true` (telemetry is now opt-out once registered). **Projects with zero telemetry usage need no `@ai-sdk/otel`** — verified case: grep for `telemetry|@opentelemetry`; if empty, skip.

### 2.9 `ChatStatus` gained `'error'`

`@ai-sdk/react` v4 `useChat` returns `status: 'submitted' | 'streaming' | 'ready' | 'error'`. `isLoading = submitted || streaming` is unaffected; any other branch that treats non-`ready` as "streaming" now also treats `'error'` as streaming — add `|| status === "error"` guards where content is derived.

### 2.10 `useChat` HTTP options moved to the transport

`api` / `credentials` / `headers` / `body` / `fetch` / `prepareSendMessagesRequest` / `prepareReconnectToStreamRequest` are **no longer `useChat` options** — they live on `DefaultChatTransport` (exported from `ai`). `useChat({ transport })` only. Standalone `addMessage`/`removeMessage` helpers were also removed from `@ai-sdk/react` — if the app's `addMessage` is a store action (Zustand etc.), it is unaffected.

### 2.11 File parts (attachments)

`{ type: "image", image, mediaType? }` user-message parts are deprecated → `{ type: "file", data, mediaType }`. Tool-result `image-*`/legacy `file-*` content parts collapse into one canonical `file` variant with a tagged `data` union (runtime auto-migration exists, but migrate explicitly). Exact shapes in `providers-and-rag.md`.

### 2.12 Reasoning normalisation stays

Docs are inconsistent about the reasoning shape: the guide shows the `onEnd` event `reasoning` as `Array<ReasoningDetail>` (`{ type: 'text', text, signature? } | { type: 'redacted', data }`), but the `ai@7.0.79` dist sets `event.reasoning = finalStep.reasoning`, which is the `StepResult` union `Array<ReasoningPart | ReasoningFilePart>`; top-level result reasoning is `Array<ReasoningOutput | ReasoningFileOutput>`. **`ReasoningFilePart`/`ReasoningFileOutput` has no `.text`** — the defensive normaliser must cast `(p as any).text` (or filter `p.type === 'reasoning'`). Keep whatever normaliser the project already has; do not "simplify" it into `p.text`.

### 2.13 Provider behaviour notes

- **OpenAI Responses**: `reasoningSummary` defaults to `'detailed'` when `reasoning`/`reasoningEffort` ≠ `'none'`; set `providerOptions.openai.reasoningSummary: null` to disable. Only relevant if using the Responses API.
- **xAI**: `xai(modelId)` now uses the Responses API; `xai.chat()` keeps Chat Completions.
- **Anthropic**: `providerMetadata.anthropic.cacheCreationInputTokens` removed → `usage.inputTokenDetails.cacheWriteTokens` / `cacheReadTokens`.
- **Google**: `GoogleGenerativeAI*` names → `Google*` (aliases kept).
