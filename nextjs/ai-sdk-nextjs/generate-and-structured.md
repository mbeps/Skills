# Generate & structured output

## generateText

Non-streaming generation:

```ts
const result = await generateText({
  model,
  instructions,        // preferred over deprecated `system`
  prompt,              // or `messages`
  tools,
  stopWhen: isStepCount(20), // default for generateText
});
result.text; // .reasoning, .steps, .response
```

Options: `model`, `prompt | messages | instructions`, `tools`, `maxRetries`, `abortSignal`, `stopWhen`, `output`, `allowSystemInMessages`.

Sampling: `maxOutputTokens` (NOT `maxTokens`), `temperature`, `topP`, `topK`, `presencePenalty`, `frequencyPenalty`, `stopSequences`, `seed`, `reasoning`. There is no `streaming:` boolean — streaming is `streamText` vs `generateText`.

Pass provider-specific options without the `experimental_` prefix: `providerOptions: { openai: { reasoningEffort: 'high' } }`.

## generateObject / streamObject

Structured output with `output` (`'object' | 'array' | 'enum' | 'no-schema'`) and `mode` (`'json' | 'tool' | 'auto'`). Throws on schema validation failure.

```ts
const { object } = await generateObject({
  model,
  schema: zodSchema(z.object({ summary: z.string() })),
  prompt: 'Summarise the doc',
  mode: 'json',
});
```

`zodSchema()` wraps a zod schema for the SDK's `FlexibleSchema`. Use `streamObject` when you need token streaming of the structured result.

## Embeddings

```ts
const { embedding } = await embed({ model, value });
const { embeddings } = await embedMany({ model, values });
```

Model via `sdkProvider.embeddingModel(modelId)` from a factory (see setup.md).

## Durable generateText (from ai-workflow-automations)

`generateText` is wrapped in an Inngest `step.ai.wrap` for durable, memoised execution — retries reuse the stored result instead of re-running the model call:

```ts
const result = await step.ai.wrap("llm-call", generateText, {
  model,
  instructions: compiledSystem, // Handlebars-compiled from workflow node data
  prompt: compiledUser,
  telemetry: { isEnabled: true, recordInputs: true, recordOutputs: true }, // no experimental_ prefix
});
```

Extraction reads `steps[0].content[0]` for single-step text (v7-valid: steps include the final step). Progress is streamed via Inngest Realtime, not the AI SDK streaming protocol.
