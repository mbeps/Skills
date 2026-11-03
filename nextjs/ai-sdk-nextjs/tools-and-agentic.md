# Tools & agentic flows

## tool()

`inputSchema` is a `FlexibleSchema` — pass a zod schema directly or wrap with `zodSchema()`. `outputSchema` is required when there is no `execute`. `execute(input, { abortSignal })` returns `OUTPUT | AsyncIterable<OUTPUT>`.

```ts
import { tool } from 'ai';
import { z } from 'zod';

const getFileUrlTool = tool({
  description: 'Get a temporary download URL for a file.',
  inputSchema: z.object({ fileName: z.string().min(1) }),
  execute: async ({ fileName }) => { /* ... */ return { url }; },
});
```

Other fields: `contextSchema`, `metadata`, `providerOptions`, `strict`, `inputExamples`, `onInputStart`, `onInputDelta`, `onInputAvailable`, `toModelOutput`. Use `dynamicTool()` for runtime-known tools (e.g. MCP).

**There is no per-tool `disabled` flag** — control tool availability with `activeTools` on `streamText`/`generateText`.

## MCP tools

```ts
import { createMCPClient } from '@ai-sdk/mcp';

const client = createMCPClient({
  transport: { type: 'http', url, redirect: 'error', headers },
});
const tools = await client.tools();
// merge with Promise.allSettled across clients
try {
  /* streamText({ model, tools }) */
} finally {
  client.close();
}
```

ai-client SSRF-guards base URLs and closes clients in `finally`.

## Multi-step agentic

`maxSteps` is removed. Use `stopWhen` + `isStepCount`. Defaults: `streamText` → `isStepCount(1)`, `generateText` → `isStepCount(20)`.

```ts
const result = streamText({
  model,
  messages,
  tools,
  stopWhen: isStepCount(env.CHAT_MAX_STEPS),
  onStepStart: () => {},
  onStepEnd: ({ stepNumber, usage }) => {},
  onEnd: ({ text, steps }) => {},
  onError: () => {},
});
```

## Multi-step tool calls & finalStep aggregation

In AI SDK v7, `finish.toolCalls` and `finish.toolResults` aggregate across **all steps** in a multi-step turn, whereas `finish.finalStep.toolCalls` only reflects tool calls executed during the very last step. For turns where tools are called in step 1 and textual summary is generated in step 2 (`finalStep`), reading from `finalStep` discards the tool calls and results.

To persist the entire turn's tools:
```ts
onEnd: (finish) => {
  finishRef.current = {
    text: finish.text,
    toolCalls: finish.toolCalls ?? [],
    toolResults: finish.toolResults ?? [],
    finishReason: finish.finishReason,
  };
},
```

### Property Normalization & Historical Serialization
- **Zero-Compat Canonical Properties:** In AI SDK v7, stream chunks from `streamText().fullStream` strictly provide `chunk.input` for tool invocations and `chunk.output` for tool execution results. Legacy v6 properties (`chunk.args`, `chunk.result`) are removed. Rather than introducing perpetual `tc.args ?? tc.input` or `tr.result ?? tr.output` fallbacks throughout the application, canonicalize persisted database schemas via idempotent migration so runtime code operates on pure canonical properties (`input`/`output` in AI SDK parts, and consistent serialization in metadata).
- **Historical tool call & result parts:** Provider serializers (like OpenAI) reconstruct message history by reading `part.input` on `ToolCallPart` and `part.output` on `ToolResultPart`. Setting legacy `args` on historical `ToolCallPart` leaves `part.input` undefined, causing providers to serialize `{}` (empty object) into the prompt. Always set pure `input: parsedInput` on `ToolCallPart` and `output: { type: 'text' | 'json', value: parsedOutput }` on `ToolResultPart`.

## Error handling

`streamText` accepts `onError` and `onEnd({ isError, isAbort, finishReason })`. Detect aborts with `isAbortError` from `@ai-sdk/provider-utils` — there is no `AbortError` class. For the full `AISDKError` subclass list and client best practice (`status`/`error`/`clearError` + `onError`), see streaming.md.
