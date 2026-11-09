# Structured Outputs & Agentic Tool Calling

The Vercel AI SDK provides first-class support for strongly typed outputs using Zod schemas and autonomous multi-step tool calling.

---

## 1. Structured Outputs with Zod

### Defining Schemas with LLM Hints (`.describe()`)

LLMs rely heavily on field descriptions to know what values to produce. Always use `.describe()`:

```typescript
import { z } from "zod";

export const workflowExtractionSchema = z.object({
  name: z.string().describe("Descriptive name of the automation workflow"),
  triggerType: z.enum(["WEBHOOK", "SCHEDULE", "MANUAL"]).describe("The event mechanism triggering this workflow"),
  scheduleCron: z.string().optional().describe("Standard 5-part cron syntax if triggerType is SCHEDULE"),
  nodes: z.array(
    z.object({
      id: z.string().describe("Unique node identifier, e.g. node_1"),
      type: z.enum(["OPENAI", "ANTHROPIC", "DISCORD", "SLACK", "EMAIL"]),
      config: z.record(z.any()).describe("Node specific parameters"),
    })
  ).min(1).describe("List of workflow execution steps"),
});
```

### Generating Strictly Validated Objects

Use `zodSchema()` to wrap schemas for the SDK's `FlexibleSchema`. Configure `output` (`'object' | 'array' | 'enum' | 'no-schema'`) and `mode` (`'auto' | 'json' | 'tool'`):

```typescript
import { generateObject, zodSchema } from "ai";
import { openai } from "@ai-sdk/openai";
import { workflowExtractionSchema } from "@/schemas/workflows/generator";

export async function extractWorkflowFromPrompt(userRequest: string) {
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: zodSchema(workflowExtractionSchema),
    output: "object",
    mode: "auto", // Automatically selects structured outputs if supported by provider
    prompt: `Parse the following workflow description into our node format: "${userRequest}"`,
  });

  return object; // Fully typed as z.infer<typeof workflowExtractionSchema>
}
```

---

## 2. Defining Tools with `tool()`

Tools give LLMs the ability to execute code, query databases, or call external APIs during generation.

### Tool Definition Structure

`tool()` accepts the following configuration fields:
- `inputSchema`: `FlexibleSchema` — pass a Zod schema directly or wrap with `zodSchema()`.
- `outputSchema`: Optional schema for tool output validation (required when there is no `execute` function).
- `execute(input, { abortSignal })`: Async function or generator returning `OUTPUT | AsyncIterable<OUTPUT>`.
- `toModelOutput`: Function transforming the raw execution return into a concise string/payload for the LLM context.
- `strict`: Enforce provider structured outputs on tool input schema.
- `inputExamples`: Representative input payloads guiding model parameter generation.
- `onInputStart`, `onInputDelta`, `onInputAvailable`: Callbacks for streaming tool argument deltas.
- `contextSchema`: Context schema when passing execution context.

For dynamically configured tools at runtime (e.g. MCP tools or dynamic database introspection), use `dynamicTool()`.

```typescript
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/db";

export const getWorkflowMetricsTool = tool({
  description: "Retrieve execution count and success rate for a specific workflow",
  inputSchema: z.object({
    workflowId: z.string().describe("The UUID of the workflow to query"),
    days: z.number().int().min(1).max(90).default(30).describe("Number of past days to aggregate"),
  }),
  execute: async ({ workflowId, days }) => {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const executions = await prisma.execution.findMany({
      where: {
        workflowId,
        createdAt: { gte: sinceDate },
      },
      select: { status: true },
    });

    const total = executions.length;
    const successful = executions.filter((e) => e.status === "COMPLETED").length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return { totalExecutions: total, successRate: `${successRate.toFixed(1)}%` };
  },
});
```

---

## 3. Multi-Step Agentic Loops (`stopWhen: isStepCount`)

By default, an LLM halts after outputting a tool call. Supplying `stopWhen: isStepCount(maxSteps)` enables autonomous iterative loops:
1. LLM decides to call a tool.
2. AI SDK invokes `tool.execute()`.
3. AI SDK feeds tool output back to the LLM.
4. LLM evaluates result and either calls another tool or generates the final text response.

```typescript
import { generateText, isStepCount } from "ai";
import { openai } from "@ai-sdk/openai";
import { getWorkflowMetricsTool } from "@/features/executions/tools/metrics";

export async function askWorkflowAssistant(userPrompt: string) {
  const result = await generateText({
    model: openai("gpt-4o"),
    prompt: userPrompt,
    tools: {
      getWorkflowMetrics: getWorkflowMetricsTool,
    },
    // There is no per-tool `disabled` flag. Filter dynamically with activeTools:
    activeTools: ["getWorkflowMetrics"],
    stopWhen: isStepCount(5), // Modern SDK bounded multi-step loop
  });

  return {
    answer: result.text,
    steps: result.steps, // Inspect individual steps, tool arguments, and results
  };
}
```

---

## 4. Inspecting Execution Steps

```typescript
const { steps, text } = await generateText({ ... });

steps.forEach((step, index) => {
  console.log(`Step ${index + 1}:`);
  
  if (step.toolCalls.length > 0) {
    step.toolCalls.forEach((call) => {
      console.log(`  Called tool [${call.toolName}] with input:`, call.input);
    });
  }

  if (step.toolResults.length > 0) {
    step.toolResults.forEach((res) => {
      console.log(`  Tool [${res.toolName}] returned output:`, res.output);
    });
  }
});
```

---

## 5. Tool Error Handling & Output Transformation (`toModelOutput`)

### Defensive Error Handling
Never throw unhandled exceptions inside `tool.execute()` unless you want the entire inference call to crash. Return a structured error object so the LLM can recover or ask the user for clarification:

```typescript
export const lookupUserTool = tool({
  description: "Lookup a user by email",
  inputSchema: z.object({ email: z.string().email() }),
  execute: async ({ email }) => {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return { success: false, error: "User not found" };
      }
      return { success: true, user: { id: user.id, name: user.name } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
});
```

### Decoupling Large UI Payloads from LLM Context (`toModelOutput`)
When tools generate large payloads (e.g. rich canvas artifacts, spreadsheets, HTML tables), returning everything in `execute` bloats future conversational context. Use `toModelOutput` to send a token-efficient summary back into model context while retaining the full object for client/UI consumption:

```typescript
export const createReportTool = tool({
  description: "Generates a detailed statistical report and displays it on the canvas",
  parameters: z.object({ title: z.string(), data: z.array(z.record(z.any())) }),
  execute: async ({ title, data }) => {
    const reportId = crypto.randomUUID();
    return { success: true, reportId, title, data }; // Full payload persisted for UI rendering
  },
  toModelOutput: ({ output }: { output: any }) => ({
    type: "text",
    value: output.success
      ? `Report "${output.title}" generated successfully (ID: ${output.reportId}).`
      : `Failed to generate report: ${output.error}`,
  }),
});
```

---

## 6. Combining Internal Tools with External MCP Tools

When combining static internal tools (`tool()`) with dynamic remote MCP tools (`@ai-sdk/mcp`), merge them into a single record passed to `tools`. Ensure MCP tool names are sanitised to prevent naming collisions with internal tools:

```typescript
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import { lookupUserTool } from "@/features/users/tools/lookup";

const { tools: mcpTools, cleanup } = await getMcpTools(enabledServers);

const allTools = {
  lookup_user: lookupUserTool,
  ...mcpTools, // External tools discovered dynamically via HTTP
};
```

For advanced internal tool patterns (context-closing factories, dynamic conditional gating, subagent streaming generators with `readUIMessageStream`, and turn scratchpads), see [internal-tools-architecture.md](internal-tools-architecture.md).

---

## 7. Property Normalization & Historical Serialization Invariant

In modern SDK Core, stream chunks and messages strictly provide canonical properties:
- `chunk.input` for tool invocations (legacy `chunk.args` removed)
- `chunk.output` for tool execution results (legacy `chunk.result` removed)

### Provider Serializer Invariant
Provider serializers (like OpenAI) reconstruct message history by reading `part.input` on `ToolCallPart` and `part.output` on `ToolResultPart`.
- If legacy `args` is provided on a `ToolCallPart` instead of `input`, `part.input` remains `undefined`, causing providers to serialize `{}` (empty object) into the LLM prompt.
- Always map database metadata to pure `input: parsedInput` on `ToolCallPart` and `output: { type: 'text' | 'json', value: parsedOutput }` on `ToolResultPart`.
- Persist canonical `input` and `output` keys in metadata schemas to eliminate repetitive runtime fallback checks (`tc.args ?? tc.input`).
```
