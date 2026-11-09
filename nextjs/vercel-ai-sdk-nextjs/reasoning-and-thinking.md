# Reasoning & Thinking Streams

Modern reasoning models (OpenAI o1/o3-mini, Anthropic Claude 3.7 Sonnet with extended thinking, DeepSeek-R1, and OSS models on OpenRouter/vLLM) produce internal chain-of-thought tokens. However, providers expose reasoning using incompatible schemas, proprietary SSE deltas, or inline text delimiters.

This reference provides production patterns to normalize reasoning parameters, intercept provider streams, parse inline tags safely, and coalesce tokens for smooth real-time delivery.

---

## 1. Provider Reasoning Format Matrix

| Provider / Format | Target Field | Config Format | Token Budgets / Values |
|---|---|---|---|
| **OpenAI (`openai`)** | `reasoning_effort` | `"low" \| "medium" \| "high"` | Set on request root; omit or delete when `"off"` |
| **OpenRouter (`openrouter`)** | `reasoning` | `{ effort: "low" \| "medium" \| "high" }` | `{ enabled: false }` when `"off"` |
| **Anthropic (`anthropic`)** | `thinking` | `{ type: "enabled", budget_tokens: number }` | `low: 1024`, `medium: 4096`, `high: 16384`; `{ type: "disabled" }` when `"off"` |
| **DeepSeek / vLLM / Ollama** | Provider-specific | SSE `reasoning_content` delta or inline tags | Handled by normalizing fetch and inline parser |

---

## 2. Request Body Transformation

Before sending a chat completion payload to an OpenAI-compatible gateway, transform outgoing parameters according to the provider's expected format:

```typescript
export type ReasoningEffort = "off" | "low" | "medium" | "high";
export type ReasoningEffortFormat = "openai" | "openrouter" | "anthropic" | "none";

const ANTHROPIC_BUDGET_TOKENS: Record<Exclude<ReasoningEffort, "off">, number> = {
  low: 1024,
  medium: 4096,
  high: 16384,
};

export function transformChatCompletionRequestBody(
  rawBody: Record<string, unknown>,
  config: {
    reasoningEffortFormat?: ReasoningEffortFormat;
    reasoningEffort?: ReasoningEffort;
    modelOptions?: Record<string, unknown> | null;
  },
): Record<string, unknown> {
  const transformed = {
    ...rawBody,
    ...(config.modelOptions && typeof config.modelOptions === "object"
      ? config.modelOptions
      : {}),
  };

  const { reasoningEffortFormat: format, reasoningEffort: effort } = config;

  if (!format || format === "none" || !effort) {
    return transformed;
  }

  switch (format) {
    case "openai": {
      if (effort === "off") {
        delete transformed.reasoning_effort;
      } else {
        transformed.reasoning_effort = effort;
      }
      break;
    }
    case "openrouter": {
      if (effort === "off") {
        transformed.reasoning = { enabled: false };
      } else {
        transformed.reasoning = { effort };
      }
      break;
    }
    case "anthropic": {
      if (effort === "off") {
        transformed.thinking = { type: "disabled" };
      } else {
        transformed.thinking = {
          type: "enabled",
          budget_tokens: ANTHROPIC_BUDGET_TOKENS[effort],
        };
      }
      break;
    }
  }

  return transformed;
}
```

---

## 3. Intercepting Normalizing Fetch Wrapper

When using `@ai-sdk/openai` (`createOpenAI`) with diverse gateways, pass a custom `fetch` wrapper to normalize both outgoing request payloads and incoming SSE deltas:

```typescript
export function extractReasoningFromDelta(delta: unknown): string | null {
  if (!delta || typeof delta !== "object") return null;
  const d = delta as Record<string, unknown>;

  if (typeof d.reasoning_content === "string" && d.reasoning_content.length > 0) {
    return d.reasoning_content;
  }
  if (typeof d.reasoning === "string" && d.reasoning.length > 0) {
    return d.reasoning;
  }
  if (Array.isArray(d.reasoning_details)) {
    const texts = d.reasoning_details
      .map((item: any) => item?.text ?? item?.summary ?? "")
      .filter((str: string) => typeof str === "string" && str.length > 0);
    if (texts.length > 0) return texts.join("\n");
  }
  return null;
}

export function createReasoningNormalizingFetch(options: {
  reasoningEffortFormat?: ReasoningEffortFormat;
  reasoningEffort?: ReasoningEffort;
  modelOptions?: Record<string, unknown> | null;
  baseFetch?: typeof fetch;
}) {
  const { reasoningEffortFormat, reasoningEffort, modelOptions, baseFetch = fetch } = options;

  return async function reasoningNormalizingFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    let activeEffort = reasoningEffort;

    // Allow per-request header override
    const effortHeader = headers.get("x-reasoning-effort");
    if (effortHeader && ["off", "low", "medium", "high"].includes(effortHeader)) {
      activeEffort = effortHeader as ReasoningEffort;
      headers.delete("x-reasoning-effort");
    }

    let modifiedBody = init?.body;
    if (typeof modifiedBody === "string" && modifiedBody.startsWith("{")) {
      try {
        const parsed = JSON.parse(modifiedBody);
        const transformed = transformChatCompletionRequestBody(parsed, {
          reasoningEffortFormat,
          reasoningEffort: activeEffort,
          modelOptions,
        });
        modifiedBody = JSON.stringify(transformed);
      } catch {
        // Fallback to original body if parsing fails
      }
    }

    const response = await baseFetch(input, { ...init, headers, body: modifiedBody });

    if (!response.ok || !response.body) return response;

    const contentType = response.headers.get("content-type") || "";

    // Intercept SSE and normalize vendor reasoning deltas
    if (contentType.includes("text/event-stream")) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let isReasoningOpen = false;
      let lineBuffer = "";

      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (isReasoningOpen) {
                controller.enqueue(
                  encoder.encode('data: {"choices":[{"index":0,"delta":{"content":"</think>"}}]}\n\n'),
                );
                isReasoningOpen = false;
              }
              controller.close();
              return;
            }

            lineBuffer += decoder.decode(value, { stream: true });
            const blocks = lineBuffer.split("\n\n");
            lineBuffer = blocks.pop() as string;

            for (const block of blocks) {
              if (!block.trim()) continue;
              const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
              if (!dataLine) {
                controller.enqueue(encoder.encode(`${block}\n\n`));
                continue;
              }

              const dataStr = dataLine.slice(6).trim();
              if (dataStr === "[DONE]") {
                if (isReasoningOpen) {
                  controller.enqueue(
                    encoder.encode('data: {"choices":[{"index":0,"delta":{"content":"</think>"}}]}\n\n'),
                  );
                  isReasoningOpen = false;
                }
                controller.enqueue(encoder.encode(`${block}\n\n`));
                continue;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta;

                if (delta) {
                  const reasoning = extractReasoningFromDelta(delta);
                  if (reasoning) {
                    const prefix = isReasoningOpen ? "" : "<think>";
                    isReasoningOpen = true;
                    delta.content = `${prefix}${reasoning}`;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                    continue;
                  }

                  if (delta.content !== undefined && delta.content !== null && isReasoningOpen) {
                    delta.content = `</think>${delta.content}`;
                    isReasoningOpen = false;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                    continue;
                  }
                }
                controller.enqueue(encoder.encode(`${block}\n\n`));
              } catch {
                controller.enqueue(encoder.encode(`${block}\n\n`));
              }
            }
          }
        },
        async cancel(reason) {
          await reader.cancel(reason);
        },
      });

      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  };
}
```

---

## 4. Stateful Inline Reasoning Parser

When models stream reasoning inline (e.g. `<think>...</think>` or `[THINK]...[/THINK]`), parse tags using a stateful streaming parser.

### Key Edge Cases Handled:
1. **Split Tag Boundaries**: A tag like `<think>` split across chunks (`<th` in chunk 1, `ink>` in chunk 2).
2. **Markdown Code Fences**: Do NOT treat `<think>` inside ` ```markdown ` blocks as active reasoning tags.
3. **Stream Abort**: Unclosed open tags flushed cleanly on stream cancellation.

```typescript
export const REASONING_DELIMITER_PAIRS = [
  { open: "<think>", close: "</think>" },
  { open: "<thinking>", close: "</thinking>" },
  { open: "<thought>", close: "</thought>" },
  { open: "<reasoning>", close: "</reasoning>" },
  { open: "[THINK]", close: "[/THINK]" },
  { open: "◁think▷", close: "◁/think▷" },
] as const;

export type StreamContentPart = {
  type: "text" | "reasoning";
  text: string;
};

function findPotentialTagPrefix(text: string, tags: readonly string[]): number | null {
  const maxPrefixLen = Math.max(...tags.map((t) => t.length)) - 1;
  const start = Math.max(0, text.length - maxPrefixLen);

  for (let i = start; i < text.length; i++) {
    const suffix = text.slice(i);
    if (tags.some((t) => t.startsWith(suffix) && t !== suffix)) {
      return i;
    }
  }
  return null;
}

export function createInlineReasoningParser() {
  let activeCloseTag: string | null = null;
  let buffer = "";
  let inCodeFence = false;

  const openTags = REASONING_DELIMITER_PAIRS.map((p) => p.open);

  function push(chunk: string): StreamContentPart[] {
    buffer += chunk;
    const parts: StreamContentPart[] = [];

    while (buffer.length > 0) {
      if (activeCloseTag !== null) {
        const closeIdx = buffer.indexOf(activeCloseTag);
        if (closeIdx !== -1) {
          const reasoningText = buffer.slice(0, closeIdx);
          if (reasoningText.length > 0) {
            parts.push({ type: "reasoning", text: reasoningText });
          }
          buffer = buffer.slice(closeIdx + activeCloseTag.length);
          if (buffer.startsWith("\n")) buffer = buffer.slice(1);
          activeCloseTag = null;
          continue;
        }

        const prefixIdx = findPotentialTagPrefix(buffer, [activeCloseTag]);
        if (prefixIdx !== null) {
          const toEmit = buffer.slice(0, prefixIdx);
          buffer = buffer.slice(prefixIdx);
          if (toEmit.length > 0) parts.push({ type: "reasoning", text: toEmit });
          break;
        }

        parts.push({ type: "reasoning", text: buffer });
        buffer = "";
        break;
      }

      // Normal text mode: check code fences
      const fenceIdx = buffer.indexOf("```");
      let earliestTagIdx = -1;
      let matchedPair: (typeof REASONING_DELIMITER_PAIRS)[number] | null = null;

      if (!inCodeFence) {
        for (const pair of REASONING_DELIMITER_PAIRS) {
          const idx = buffer.indexOf(pair.open);
          if (idx !== -1 && (earliestTagIdx === -1 || idx < earliestTagIdx)) {
            earliestTagIdx = idx;
            matchedPair = pair;
          }
        }
      }

      if (fenceIdx !== -1 && (earliestTagIdx === -1 || fenceIdx < earliestTagIdx)) {
        const textBefore = buffer.slice(0, fenceIdx + 3);
        parts.push({ type: "text", text: textBefore });
        buffer = buffer.slice(fenceIdx + 3);
        inCodeFence = !inCodeFence;
        continue;
      }

      if (earliestTagIdx !== -1 && matchedPair !== null) {
        const textBefore = buffer.slice(0, earliestTagIdx);
        if (textBefore.length > 0) parts.push({ type: "text", text: textBefore });
        buffer = buffer.slice(earliestTagIdx + matchedPair.open.length);
        if (buffer.startsWith("\n")) buffer = buffer.slice(1);
        activeCloseTag = matchedPair.close;
        continue;
      }

      if (!inCodeFence) {
        const prefixIdx = findPotentialTagPrefix(buffer, openTags);
        if (prefixIdx !== null) {
          const toEmit = buffer.slice(0, prefixIdx);
          buffer = buffer.slice(prefixIdx);
          if (toEmit.length > 0) parts.push({ type: "text", text: toEmit });
          break;
        }
      }

      parts.push({ type: "text", text: buffer });
      buffer = "";
      break;
    }

    return parts;
  }

  function flush(): StreamContentPart[] {
    const parts: StreamContentPart[] = [];
    if (buffer.length > 0) {
      parts.push({
        type: activeCloseTag !== null ? "reasoning" : "text",
        text: buffer,
      });
      buffer = "";
    }
    return parts;
  }

  return { push, flush };
}
```

---

## 5. Delta Coalescing & Throttling

High-velocity LLM streams (especially fast reasoning models) can generate 80-120 small chunks per second. Emitting every single character to WebSocket or SSE saturates the connection and causes UI jank. Coalesce deltas with a 40ms sliding window:

```typescript
export const DELTA_COALESCE_INTERVAL_MS = 40;

export async function consumeModelStream(
  fullStream: AsyncIterable<any>,
  abortSignal: AbortSignal,
  emit: (event: any) => Promise<void>,
) {
  let accumulatedText = "";
  let accumulatedReasoning = "";
  let bufferedText = "";
  let bufferedReasoning = "";
  let lastTextFlush = 0;
  let lastReasoningFlush = 0;

  const flushReasoning = async () => {
    if (!bufferedReasoning) return;
    const toEmit = bufferedReasoning;
    bufferedReasoning = "";
    lastReasoningFlush = Date.now();
    await emit({ type: "reasoning-delta", reasoning: toEmit });
  };

  const flushText = async () => {
    if (!bufferedText) return;
    const toEmit = bufferedText;
    bufferedText = "";
    lastTextFlush = Date.now();
    await emit({ type: "text-delta", text: toEmit });
  };

  const inlineParser = createInlineReasoningParser();

  for await (const chunk of fullStream) {
    if (abortSignal.aborted) break;

    if (chunk.type === "text-delta") {
      const parts = inlineParser.push(chunk.text);
      for (const part of parts) {
        if (part.type === "reasoning") {
          accumulatedReasoning += part.text;
          if (bufferedText) await flushText();
          bufferedReasoning += part.text;
          if (Date.now() - lastReasoningFlush >= DELTA_COALESCE_INTERVAL_MS) {
            await flushReasoning();
          }
        } else {
          accumulatedText += part.text;
          if (bufferedReasoning) await flushReasoning();
          bufferedText += part.text;
          if (Date.now() - lastTextFlush >= DELTA_COALESCE_INTERVAL_MS) {
            await flushText();
          }
        }
      }
    } else if (chunk.type === "reasoning-delta") {
      accumulatedReasoning += chunk.text;
      if (bufferedText) await flushText();
      bufferedReasoning += chunk.text;
      if (Date.now() - lastReasoningFlush >= DELTA_COALESCE_INTERVAL_MS) {
        await flushReasoning();
      }
    } else {
      // Flush text and reasoning before emitting tool calls or other events
      await flushReasoning();
      await flushText();
      await emit(chunk);
    }
  }

  // Flush remaining buffer on completion
  const flushed = inlineParser.flush();
  for (const part of flushed) {
    if (part.type === "reasoning") bufferedReasoning += part.text;
    else bufferedText += part.text;
  }
  await flushReasoning();
  await flushText();

  return { accumulatedText, accumulatedReasoning };
}
```

---

## 4. Client Reasoning Stream Invariant

When calculating whether reasoning is actively streaming in custom client hooks or UI indicators:

```typescript
const isStreamingReasoning =
  isStreaming &&
  !!streamingReasoning &&
  !streamingContent &&
  activeToolCalls.length === 0;
```

> [!IMPORTANT]
> In tool-calling turns, the model often yields reasoning deltas followed immediately by tool invocations before any text content is generated. If `activeToolCalls.length === 0` is omitted, `streamingContent` remains empty during tool execution, falsely displaying an active "Thinking..." spinner while external tools are executing.
