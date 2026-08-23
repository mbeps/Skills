# AI SDK Testing Patterns

## Overview

Testing Vercel AI SDK integrations requires mocking both the core `ai` package (`generateText`, `streamText`) and each provider factory (`createOpenAI`, `createAnthropic`, etc.). The pattern collapses async inference into synchronous returns.

## When to Use

- Testing node executors that call LLM providers (OpenAI, Anthropic, Gemini, OpenRouter)
- Testing credential decryption for API keys at execution time
- Testing Handlebars templating resolution before passing prompts to models
- Testing structured output / tool calling from AI responses

**Not for:** end-to-end model inference testing, streaming response testing, or cost/usage tracking.

## Core Mock Structure

### Global Mock (`__tests__/__mocks__/ai.ts`)

```typescript
vi.mock("ai", () => ({ generateText: vi.fn() }));

vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: vi.fn(() => vi.fn()) }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: vi.fn(() => vi.fn()) }));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: vi.fn(() => vi.fn()) }));
vi.mock("@openrouter/ai-sdk-provider", () => ({ createOpenRouter: vi.fn(() => vi.fn()) }));
```

| Mock                       | Purpose                                         | Return Shape                                      |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `generateText`             | Replaces `generateText({ model, prompt })`      | `undefined` by default — must be stubbed per-test |
| `createOpenAI`             | Replaces `createOpenAI({ apiKey })`             | No-op `vi.fn()` — the LLM client itself           |
| `createAnthropic`          | Replaces `createAnthropic({ apiKey })`          | No-op `vi.fn()`                                   |
| `createGoogleGenerativeAI` | Replaces `createGoogleGenerativeAI({ apiKey })` | No-op `vi.fn()`                                   |
| `createOpenRouter`         | Replaces `createOpenRouter({ apiKey })`         | No-op `vi.fn()`                                   |

### Executor Test Template

Every AI executor test follows this pattern:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { stepMock, publishMock } from "../../../../__mocks__/inngest";
import { generateText } from "ai"; // uses global mock
import { openAiExecutor } from "./executor";

vi.mocked(generateText).mockResolvedValueOnce({
  text: "Hello from GPT",
  finishReason: "stop",
  usage: { promptTokens: 10, completionTokens: 20 },
});

describe("openAiExecutor", () => {
  const baseParams = {
    nodeId: "node_1",
    userId: "user_123",
    context: {},
    step: stepMock,
    publish: publishMock,
  };

  beforeEach(() => vi.clearAllMocks());

  it("throws if apiKey is missing", async () => {
    await expect(openAiExecutor({ ...baseParams, data: {} }))
      .rejects.toThrow("API key is missing");
  });

  it("calls the model and returns the response", async () => {
    stepMock.run.mockResolvedValueOnce({ value: "sk-encrypted-key" });

    const result = await openAiExecutor({
      ...baseParams,
      data: { variableName: "apiKey", model: "gpt-4o", prompt: "Say hello" },
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.anything(), // model constructor built from decrypted key
        prompt: "Say hello",
      }),
    );
    expect(result).toEqual({ v1: { text: "Hello from GPT" } });
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ status: "success" }) }),
    );
  });

  it("handles AI error", async () => {
    stepMock.run.mockResolvedValueOnce({ value: "sk-encrypted-key" });
    vi.mocked(generateText).mockRejectedValueOnce(new Error("Rate limit exceeded"));

    await expect(openAiExecutor({ ...baseParams, data: { apiKey: "sk-xxx", model: "gpt-4o", prompt: "Hi" } }))
      .rejects.toThrow("Rate limit exceeded");
  });
});
```

## What to Assert

| Assertion Type                   | Example                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Input validation errors          | `.rejects.toThrow("API key is missing")`                                                                |
| Model called with correct prompt | `expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ prompt: "expected text" }))`       |
| Credential decrypted correctly   | `stepMock.run.mockResolvedValueOnce({ value: "sk-xxx" })` → verify model receives key                   |
| Response shape returned          | `expect(result).toEqual({ v1: { text: "response" } })`                                                  |
| Realtime status published        | `expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ payload: { status: "success" } }))` |
| AI error propagated              | `.rejects.toThrow("Error message")`                                                                     |
| Handlebars resolved              | `expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ prompt: "resolved text" }))`       |

## Provider Factory Pattern

Each provider factory returns an LLM client constructor. The executor passes options to it:

```typescript
// Typical executor pattern
const openai = createOpenAI({ apiKey: decryptedKey, compatibility: "strict" });
const model = openai("gpt-4o");
const { text } = await generateText({ model, prompt });
```

Since `createOpenAI` returns `vi.fn()` (a no-op function), calling `.("gpt-4o")` on it returns `undefined`. The actual model instance is never constructed — only the `generateText` call is asserted.

## Structured Output / Tool Calling

For executors that use `experimental_generateImage` or tool calling:

```typescript
import { experimental_generateImage } from "ai";

vi.mocked(experimental_generateImage).mockResolvedValueOnce({
  image: { url: "https://example.com/img.png", format: "png" as any },
});
```

## Gotchas

1. **Provider factories return no-op functions** — `createOpenAI()` returns `vi.fn()`. Calling `.("model-name")` on it returns `undefined`. The model instance is never real; only `generateText` assertions matter.
2. **`generateText` returns undefined by default** — every test must stub it with `.mockResolvedValueOnce()`. Missing stubs cause silent failures or `Cannot read properties of undefined`.
3. **No `.text()` method on mocked models** — since the factory returns a no-op, any code calling `.text()` on the model will get `undefined`. This is fine because executors pass the model to `generateText`, not call methods on it directly.
4. **Mock duplication risk** — the global AI mock exists, but some executor tests also locally mock `ai` or individual providers. Prefer the global mock; remove local duplicates.
5. **Only 4 providers mocked** — OpenAI, Anthropic, Gemini, OpenRouter. HTTP, Discord, Slack, and trigger nodes don't use AI SDK, which is correct. But if you add a new AI node type, ensure its provider is mocked.
6. **`step.ai.wrap` does not memoise** — the Inngest mock calls through immediately. If you need to simulate cached results, use `.mockReturnValueOnce()` on `stepMock.ai.wrap`.

## References

- [Vercel AI SDK — generateText](https://ai-sdk.dev/docs/tools/generate-text)
- [Vercel AI SDK — Model Providers](https://ai-sdk.dev/docs/providers/openai)
- [Inngest — step.ai.wrap](https://www.inngest.com/docs/reference/inngest/step/ai-wrap)
