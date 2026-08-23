# Inngest Testing Patterns

## Overview

Testing Inngest v4 durable functions requires collapsing the entire event-driven runtime into synchronous execution via mocks. The key insight: `step.run()` callbacks execute immediately, `step.ai.wrap()` calls through directly, and `publish()` is an identity function by default.

## When to Use

- Testing node executors (AI, HTTP, messaging nodes) that run inside Inngest functions
- Testing workflow execution logic (topological sort, context passing, error handling)
- Testing realtime status channel publishing
- Verifying credential decryption at execution time

**Not for:** end-to-end workflow runs (use Inngest test client), webhook integration tests, or retry/failure lifecycle testing.

## Core Mock Structure

### Global Mock (`__tests__/__mocks__/inngest.ts`)

```typescript
export const stepMock = {
  run: vi.fn((id, cb) => cb()),          // SYNCHRONOUS — collapses durable step
  ai: {
    wrap: vi.fn((id, fn, args) => fn(args)), // CALLS THROUGH — no memoisation
  },
};

export const publishMock = vi.fn().mockImplementation((val) => val); // Identity

vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}));

vi.mock('@/inngest/utils', () => ({
  sendWorkflowExecution: vi.fn(),
}));
```

| Export                  | Purpose                                     | Behaviour                                                                                                                      |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `stepMock.run`          | Replaces `step.run("checkpoint", asyncFn)`  | Synchronously invokes callback. No retry, no checkpoint persistence. Returns `undefined` unless `.mockResolvedValue()` called. |
| `stepMock.ai.wrap`      | Replaces `step.ai.wrap("key", fn, args)`    | Calls `fn(args)` directly. No caching, no replay protection.                                                                   |
| `publishMock`           | Replaces `publish()` passed to executors    | Identity by default. Tests spy on it to verify realtime status publishing.                                                     |
| `inngest.send`          | Replaces `inngest.send({ name, data, id })` | Plain `vi.fn()`. Rarely asserted.                                                                                              |
| `sendWorkflowExecution` | Replaces the event-sending utility          | Plain `vi.fn()`. Asserted in router tests.                                                                                     |

### Executor Test Template

Every executor test follows this pattern:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { stepMock, publishMock } from "../../../../__mocks__/inngest";
import { someExecutor } from "./executor";

describe("someExecutor", () => {
  const baseParams = {
    nodeId: "node_1",
    userId: "user_123",
    context: {},
    step: stepMock,
    publish: publishMock,
  };

  beforeEach(() => vi.clearAllMocks());

  it("throws if required field is missing", async () => {
    await expect(someExecutor({ ...baseParams, data: {} }))
      .rejects.toThrow("Variable name is missing");
  });

  it("executes successfully", async () => {
    stepMock.run.mockResolvedValue({ value: "encrypted_key" });
    // mock external deps (generateText, ky, etc.)

    const result = await someExecutor({ ...baseParams, data: { apiKey: "sk-xxx" } });

    expect(result).toEqual({ v1: { text: "response" } });
    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ status: "success" }) }),
    );
  });
});
```

## What to Assert

| Assertion Type                 | Example                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Input validation errors        | `.rejects.toThrow("Variable name is missing")`                                                          |
| Successful output shape        | `expect(result).toEqual(expectedContext)`                                                               |
| Realtime status published      | `expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ payload: { status: "success" } }))` |
| External API called correctly  | `expect(ky).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET" }))`                      |
| Handlebars templating resolved | `expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ prompt: "hello World" }))`         |
| Credential lookup failure      | `stepMock.run.mockResolvedValue(null)` → `.rejects.toThrow("Credential not found")`                     |
| Non-JSON response handling     | `expect(result.v1.httpResponse.data).toBe("raw text")`                                                  |

### Non-AI Trigger Executors

Trigger nodes (Manual, Google Form, Stripe) follow the same `stepMock`/`publishMock` pattern but without AI SDK or credential decryption:

```typescript
import { stepMock, publishMock } from "../../../../__mocks__/inngest";
import { manualTriggerExecutor } from "./executor";

it("passes through context unchanged", async () => {
  const result = await manualTriggerExecutor({
    nodeId: "node_1",
    userId: "user_123",
    context: { v1: { text: "hello" } },
    step: stepMock,
    publish: publishMock,
    data: {},
  });

  expect(result).toEqual({ v1: { text: "hello" } });
  expect(publishMock).toHaveBeenCalledWith(
    expect.objectContaining({ payload: expect.objectContaining({ status: "success" }) }),
  );
});
```

Stripe trigger executors additionally assert webhook signature validation and event parsing. Google Form triggers assert form field extraction into the workflow context.

## Realtime Channels

Each node type gets its own channel:

```typescript
// Channel definition (source)
import { channel, topic } from "@inngest/realtime";

export const OPENAI_CHANNEL_NAME = "openai-execution";

export const openAiChannel = channel(OPENAI_CHANNEL_NAME)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>(),
  );
```

Global mock in `vitest.setup.ts`:

```typescript
vi.mock("@inngest/realtime", () => ({
  channel: vi.fn(() => ({
    addTopic: vi.fn(() => vi.fn(() => ({
      status: vi.fn((payload) => ({ payload })),
    }))),
  })),
  topic: vi.fn(() => ({
    type: vi.fn(() => ({})),
  })),
}));
```

## Gotchas

1. **No checkpoint/retry simulation** — the mock collapses everything to sync. Retry logic and `onFailure` hooks are tested only implicitly via router tests.
2. **`step.ai.wrap` does not memoise** — each call executes the function. If you need to simulate cached results, use `.mockReturnValueOnce()` / `.mockResolvedValueOnce()`.
3. **`publishMock` is identity by default** — it returns whatever you pass in. To test error publishing, call `publishMock.mockImplementation((val) => val)` explicitly or rely on the default.
4. **Channels are often no-ops** — in many projects the `publish` function in `executeWorkflow` is a placeholder (`const publish = () => {};`). Verify before writing channel assertions.

## References

- [Inngest Durable Functions](https://www.inngest.com/docs/functions/index)
- [Inngest Step Tools](https://www.inngest.com/docs/reference/inngest/step)
- [Inngest Realtime](https://www.inngest.com/docs/reference/inngest/step/publish)
- [Vercel AI SDK — step.ai.wrap](https://ai-sdk.dev/docs/agents/inngest#using-stepaiwrap)
