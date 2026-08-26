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

## finalStep aggregation

`result.finalStep` exists on both result types and is `PromiseLike`. ai-client's chat `onEnd` aggregates the final-step-only shape for persistence:

```ts
onEnd: (finish) => {
  finishRef.current = {
    text: finish.text,
    toolCalls: finish.finalStep.toolCalls ?? [],
    toolResults: finish.finalStep.toolResults ?? [],
    finishReason: finish.finishReason,
  };
},
```

For run-step analysis, `generateText` then iterate `result.steps` for per-step `toolCalls`/`toolResults`, tolerating v6/v7 dual shapes: `tc.args ?? tc.input`, `tr.result ?? tr.output`.

## Error handling

`streamText` accepts `onError` and `onEnd({ isError, isAbort, finishReason })`. Detect aborts with `isAbortError` from `@ai-sdk/provider-utils` — there is no `AbortError` class. For the full `AISDKError` subclass list and client best practice (`status`/`error`/`clearError` + `onError`), see streaming.md.
