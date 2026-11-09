# Telemetry & Vitest Testing Patterns

This guide covers production observability for LLM executions and unit/integration testing strategies using Vitest.

---

## 1. Telemetry & OpenTelemetry

The Vercel AI SDK provides native OpenTelemetry instrumentation. It captures span events for model requests, token counts, and latency.

### Enabling Telemetry in Inferences

```typescript
import { generateText } from "ai";

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "Synthesize user activity logs",
  telemetry: {
    isEnabled: true,
    recordInputs: true,  // Records prompt text in span attributes (disable if handling sensitive PII)
    recordOutputs: true, // Records model response in span attributes
    functionId: "workflow-activity-summary",
    metadata: {
      userId: "usr_12345",
      workflowId: "wf_67890",
    },
  },
});
```

### Inngest AI Dashboard Integration

When invoked through `step.ai.wrap()`, Inngest automatically extracts token counts, cost estimations, and latency graphs into the Inngest Dev Server and Cloud dashboard.

---

## 2. Centralized Vitest Mocks

To prevent actual HTTP requests to AI providers during test suites, mock the packages in `__tests__/__mocks__/ai.ts`:

```typescript
// __tests__/__mocks__/ai.ts
import { vi } from "vitest";

export const mockStreamText = vi.fn();
export const mockGenerateText = vi.fn();
export const mockGenerateObject = vi.fn();
export const mockStreamObject = vi.fn();
export const mockEmbed = vi.fn();
export const mockEmbedMany = vi.fn();
export const mockIsStepCount = vi.fn((count: number) => ({ isStepCount: true, maxSteps: count }));

vi.mock("ai", () => ({
  streamText: mockStreamText,
  generateText: mockGenerateText,
  generateObject: mockGenerateObject,
  streamObject: mockStreamObject,
  embed: mockEmbed,
  embedMany: mockEmbedMany,
  isStepCount: mockIsStepCount,
  tool: vi.fn((def) => def),
  ToolLoopAgent: vi.fn(),
  readUIMessageStream: vi.fn(),
  toUIMessageStream: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => ({
    chat: vi.fn((modelId: string) => `mocked-openai-${modelId}`),
    embeddingModel: vi.fn((modelId: string) => `mocked-openai-embedding-${modelId}`),
  })),
  openai: vi.fn((modelId: string) => `mocked-openai-${modelId}`),
}));
```

---

## 3. Testing Streaming Pipelines (`streamText` & `fullStream`)

When testing functions that consume `streamText({ ... })`, mock `fullStream` using an **`async function*` generator** and provide resolved promises for `finishReason` and `usage`:

```typescript
// __tests__/lib/inngest/chat-response.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateChatResponse } from "@/lib/inngest/functions/chat-response";
import { inngest } from "@/lib/inngest/client";

const mockStreamText = vi.hoisted(() => vi.fn());
const mockIsStepCount = vi.hoisted(() => vi.fn(() => ({ isStepCount: true })));

vi.mock("ai", () => ({
  streamText: mockStreamText,
  isStepCount: mockIsStepCount,
  tool: vi.fn((def) => def),
}));

describe("generateChatResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup async generator stream simulating model deltas
    mockStreamText.mockReturnValue({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "Hello " };
        yield { type: "text-delta", text: "there!" };
      })(),
      finishReason: Promise.resolve("stop"),
      usage: Promise.resolve({ promptTokens: 12, completionTokens: 8 }),
    });
  });

  it("streams text tokens and publishes to Inngest Realtime", async () => {
    const fn = (generateChatResponse as any).fn;

    await fn({
      event: {
        data: {
          chatId: "chat-123",
          userId: "user-456",
          userMessageId: "msg-789",
          model: "gpt-4o",
        },
      },
    });

    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "start" }),
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "text-delta", text: "Hello " },
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "text-delta", text: "there!" },
    );
  });
});
```

---

## 4. Testing Multi-Agent Tool Scoping & Architectural Invariants

Ensure worker subagents strictly adhere to the 2-layer hierarchy by testing tool exclusions and system prompt reporting contracts:

```typescript
// __tests__/lib/subagents/subagent-dispatch-tool.test.ts
import { describe, it, expect } from "vitest";
import { getSubagentTools } from "@/lib/subagents/get-subagent-tools";
import { constructSubagentPrompt } from "@/lib/subagents/construct-subagent-prompt";

describe("subagent isolation invariants", () => {
  it("strictly excludes delegate_task, manage_artifact, and skill mutations", () => {
    const mockTools = {
      delegate_task: { description: "delegate" },
      manage_artifact: { description: "canvas" },
      create_skill: { description: "create skill" },
      update_skill: { description: "update skill" },
      write_skill_file: { description: "write skill" },
      read_skill_file: { description: "read skill" },
      search_knowledge_base: { description: "kb" },
    };

    const workerTools = getSubagentTools(mockTools);

    // Permitted tools
    expect(workerTools).toHaveProperty("read_skill_file");
    expect(workerTools).toHaveProperty("search_knowledge_base");

    // Strictly forbidden tools
    expect(workerTools).not.toHaveProperty("delegate_task");
    expect(workerTools).not.toHaveProperty("manage_artifact");
    expect(workerTools).not.toHaveProperty("create_skill");
    expect(workerTools).not.toHaveProperty("update_skill");
  });

  it("enforces reporting contracts and depth limit d=1 in worker prompt", () => {
    const prompt = constructSubagentPrompt({
      isSubagent: true,
      agentRole: "researcher",
      runId: "run-abc",
    });

    expect(prompt).toContain("Role: RESEARCHER");
    expect(prompt).toContain("depth limit d=1");
    expect(prompt).toContain("cannot manipulate the user's canvas");
    expect(prompt).toContain("REPORTING CONTRACT");
    expect(prompt).toContain("STATUS: DONE");
  });
});
```

---

## 5. Testing AI Executors with `step.ai.wrap`

This unit test verifies that an AI executor validates required parameters, decrypts credentials, invokes `step.ai.wrap`, and maps generated text correctly:

```typescript
// __tests__/features/executions/components/openai/executor.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { openAiExecutor } from "@/features/executions/components/openai/executor";
import { generateText } from "ai";
import { NonRetriableError } from "inngest";
import { stepMock, publishMock } from "@/__tests__/__mocks__/inngest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}));

describe("openAiExecutor", () => {
  const baseParams = {
    nodeId: "node_ai_1",
    userId: "usr_test_123",
    context: { inputVar: "hello world" },
    step: stepMock,
    publish: publishMock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NonRetriableError when variableName is missing", async () => {
    await expect(
      openAiExecutor({ ...baseParams, data: { userPrompt: "test" } })
    ).rejects.toThrow(NonRetriableError);

    expect(publishMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "error" }) })
    );
  });

  it("throws NonRetriableError when credential is missing", async () => {
    await expect(
      openAiExecutor({
        ...baseParams,
        data: { variableName: "output", userPrompt: "test" },
      })
    ).rejects.toThrow(NonRetriableError);
  });

  it("executes successfully and stores output text in context", async () => {
    const data = {
      variableName: "aiResult",
      credentialId: "cred_123",
      userPrompt: "Process: {{ inputVar }}",
    };

    // Mock credential retrieval
    stepMock.run.mockResolvedValue({
      id: "cred_123",
      value: "mock_encrypted_secret",
    });

    // Mock AI SDK generation response through step.ai.wrap
    (generateText as any).mockResolvedValue({
      steps: [
        {
          content: [
            { type: "text", text: "Successfully synthesized data" },
          ],
        },
      ],
    });

    const result = await openAiExecutor({ ...baseParams, data });

    // Verify context contains output variable
    expect(result).toEqual({
      inputVar: "hello world",
      aiResult: {
        text: "Successfully synthesized data",
      },
    });

    // Verify step.ai.wrap called with correct parameters
    expect(stepMock.ai.wrap).toHaveBeenCalledWith(
      "openai-generate-text",
      generateText,
      expect.objectContaining({
        prompt: "Process: hello world",
      })
    );
  });
});
```

---

## 4. Testing Route Handler Streaming Responses

Test App Router streaming route handlers using Vitest by inspecting the returned Response:

```typescript
// __tests__/app/api/chat/route.test.ts
import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { streamText } from "ai";

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: vi.fn(() => new Response("0:\"Hello world\"\n", { status: 200 })),
  })),
}));

describe("POST /api/chat", () => {
  it("returns streaming response for authenticated request", async () => {
    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Hello world");
  });
});
```
