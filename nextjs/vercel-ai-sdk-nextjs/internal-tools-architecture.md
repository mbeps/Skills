# Internal Tools Architecture & Patterns

Internal tools allow Vercel AI SDK applications to safely expose server-side business logic, database queries, long-term memory, artifact generation, and subagent delegation to LLMs.

---

## 1. Context-Closing Tool Factories

In Next.js App Router and background workflow engines (e.g. Inngest), `tool.execute()` runs inside an asynchronous execution pipeline where request headers, cookies, and HTTP sessions may no longer be directly accessible.

**Factory Pattern**: Create tools via factory functions that close over the authenticated user, conversation identifiers, and database handles:

```typescript
// lib/chat/register-memory-tool.ts
import { tool } from "ai";
import { z } from "zod";
import { saveMemoryForUser } from "@/lib/memory";

export function registerMemoryTool(userId: string, selectedTools?: string[]) {
  // Respect user tool selection
  if (selectedTools && !selectedTools.includes("save_memory")) {
    return {};
  }

  return {
    save_memory: tool({
      description: "Saves a user preference or enduring convention to long-term memory across sessions.",
      inputSchema: z.object({
        content: z.string().min(1).describe("The preference or fact to remember"),
      }),
      execute: async ({ content }) => {
        try {
          const trimmed = content.trim();
          if (!trimmed) return { success: false, error: "Content cannot be empty" };

          // Authenticated userId is bound from the factory closure
          const result = await saveMemoryForUser(userId, trimmed);
          return { success: true, memoryId: result.id, message: `Remembered: "${result.content}"` };
        } catch (err: any) {
          return { success: false, error: err.message ?? "Failed to save memory" };
        }
      },
    }),
  };
}
```

---

## 2. Context Token Optimization with `toModelOutput`

When tools generate rich UI artifacts (such as multi-sheet spreadsheets, interactive HTML widgets, or large code documents), returning the entire object in `execute()` forces hundreds or thousands of tokens back into the LLM's conversational context for subsequent turns.

Use AI SDK's `toModelOutput` to decouple the **full data payload** (rendered by the UI or saved to the database) from the **concise summary** fed back into the model context:

```typescript
// lib/chat/register-artifact-tool.ts
import { tool } from "ai";
import { z } from "zod";

export function registerArtifactTool() {
  return {
    manage_artifact: tool({
      description: "Creates or updates an interactive document, spreadsheet, HTML card, or diagram on the canvas.",
      inputSchema: z.object({
        type: z.enum(["markdown", "spreadsheet", "html", "mermaid"]),
        title: z.string().describe("Title of the artifact"),
        content: z.string().describe("The full artifact body or serialized JSON"),
      }),
      execute: async ({ type, title, content }) => {
        // Full artifact payload returned to client & saved in message toolResults metadata
        return {
          success: true,
          artifact: {
            id: crypto.randomUUID(),
            type,
            title,
            content, // May be megabytes of tabular data or HTML
          },
        };
      },
      // Model context receives only a tiny, token-efficient confirmation
      toModelOutput: ({ output }: { output: any }) => {
        const title = output?.artifact?.title || "Artifact";
        const type = output?.artifact?.type || "document";
        return {
          type: "text",
          value: output?.success
            ? `Artifact "${title}" (${type}) created successfully and presented to the user on canvas.`
            : `Failed to create artifact: ${output?.error}`,
        };
      },
    }),
  };
}
```

---

## 3. Streaming Subagent Delegation via Generator Tools

Complex or context-heavy reasoning can be delegated to specialized worker agents. By defining `execute` as an **`async function*` generator**, tools can stream live intermediate progress (subagent steps, tool calls, reasoning) to the client UI using `readUIMessageStream` and `toUIMessageStream` from `ai`, while returning a synthesized final report to the parent orchestrator via `toModelOutput`.

For comprehensive details on the 2-layer boundary, roles, reporting contracts, and trace telemetry, see [subagents-and-orchestration.md](subagents-and-orchestration.md).

```typescript
// lib/subagents/create-subagent-dispatch-tool.ts
import { tool, ToolLoopAgent, isStepCount, readUIMessageStream, toUIMessageStream } from "ai";
import { z } from "zod";
import { constructSubagentPrompt } from "./construct-subagent-prompt";
import { getSubagentTools } from "./get-subagent-tools";
import { registerScratchpadTools } from "./register-subagent-tools";
import { sanitizeSubagentOutput } from "./subagent-dispatch-tool";

export function createSubagentDispatchTool({
  defaultModel,
  customWorkerModel,
  availableTools,
  maxSteps = 10,
  scratchpadContext,
}: {
  defaultModel: any;
  customWorkerModel?: any;
  availableTools: Record<string, any>;
  maxSteps?: number;
  scratchpadContext?: { chatId: string; messageId: string };
}) {
  return tool({
    description: "Delegates a complex, multi-step research or planning task to an isolated subagent.",
    inputSchema: z.object({
      role: z.enum(["researcher", "planner", "reviewer", "worker"]),
      taskBrief: z.string().describe("Self-contained requirements for the task"),
      inputData: z.string().optional().describe("Optional context pointers or scratchpad references"),
    }),
    execute: async function* ({ role, taskBrief, inputData }, { abortSignal }) {
      const selectedModel = customWorkerModel ?? defaultModel;
      // Strip recursive delegation and canvas tools to enforce depth limit d=1
      const baseTools = getSubagentTools(availableTools);
      const workerTools = scratchpadContext
        ? {
            ...baseTools,
            ...registerScratchpadTools({
              chatId: scratchpadContext.chatId,
              messageId: scratchpadContext.messageId,
              workerRole: role,
            }),
          }
        : baseTools;

      const runId = crypto.randomUUID();

      const workerAgent = new ToolLoopAgent({
        model: selectedModel,
        instructions: constructSubagentPrompt({ agentRole: role, runId }),
        tools: workerTools,
        stopWhen: isStepCount(maxSteps),
      });

      const streamResult = await workerAgent.stream({
        prompt: `TASK BRIEF:\n${taskBrief}\n\nINPUT DATA:\n${inputData ?? "None"}`,
        abortSignal,
      });

      let lastYieldTime = -Infinity;
      let lastChunk: any = null;
      let hasPendingUnyieldedChunk = false;

      // Stream intermediate UI message chunks to frontend (throttled to 150ms)
      for await (const chunk of readUIMessageStream({
        stream: toUIMessageStream({ stream: streamResult.stream }),
      })) {
        lastChunk = chunk;
        const now = Date.now();
        if (now - lastYieldTime >= 150) {
          lastYieldTime = now;
          hasPendingUnyieldedChunk = false;
          yield chunk;
        } else {
          hasPendingUnyieldedChunk = true;
        }
      }

      if (hasPendingUnyieldedChunk && lastChunk) {
        yield lastChunk;
      }
    },
    // Orchestrator model receives only a token-bounded, sanitized summary
    toModelOutput: ({ output }: { output: any }) => {
      return {
        type: "text",
        value: sanitizeSubagentOutput(output),
      };
    },
  });
}
```

---

## 4. Shared Ephemeral Scratchpad Pattern

When orchestrators and subagents collaborate on large problems, passing large drafts back and forth in chat messages causes exponential context consumption.

Instead, equip agents with **scratchpad tools** (`scratchpad_write`, `scratchpad_read`, `scratchpad_list`) scoped to the current turn (`chatId`, `messageId`) backed by PostgreSQL:

```typescript
// lib/subagents/register-scratchpad-tools.ts
import { tool } from "ai";
import { z } from "zod";

export function registerScratchpadTools({ chatId, messageId, workerRole }: ScratchpadContext) {
  return {
    scratchpad_write: tool({
      description: "Persists structured data, outlines, or draft code to the shared turn scratchpad.",
      inputSchema: z.object({
        filePath: z.string().describe("Relative path, e.g. 'notes/findings.md'"),
        content: z.string().max(2_000_000).describe("File content (up to 2MB)"),
      }),
      execute: async ({ filePath, content }) => {
        const result = await db.upsertScratchpad({ chatId, messageId, filePath, content, writtenByRole: workerRole });
        return { success: true, filePath: result.filePath, version: result.version, message: `Saved "${filePath}".` };
      },
    }),

    scratchpad_read: tool({
      description: "Reads a file from the turn scratchpad with optional line-level pagination.",
      inputSchema: z.object({
        filePath: z.string(),
        startLine: z.number().int().min(1).optional(),
        lineCount: z.number().int().min(1).max(500).optional(),
      }),
      execute: async ({ filePath, startLine, lineCount }) => {
        const file = await db.getScratchpadFile(messageId, filePath);
        if (!file) return { success: false, error: "File not found" };

        let content = file.content;
        // Apply line-based pagination to prevent context dump explosions
        if (startLine !== undefined) {
          const lines = content.split("\n");
          content = lines.slice(startLine - 1, (startLine - 1) + (lineCount ?? 200)).join("\n");
        } else if (content.length > 15000) {
          content = content.slice(0, 15000) + "\n\n[... Truncated at 15,000 characters. Use pagination.]";
        }
        return { success: true, filePath, content, version: file.version };
      },
    }),

    scratchpad_list: tool({
      description: "Lists all intermediate files currently stored in the shared scratchpad for this turn.",
      inputSchema: z.object({}),
      execute: async () => {
        const files = await db.listScratchpadFiles(messageId);
        return { success: true, files };
      },
    }),
  };
}
```

---

## 5. Dynamic Conditional Tool Gating

Never register all tools unconditionally. Dynamic gating prevents invalid API calls, conserves prompt instructions, and enforces security boundaries:

```typescript
export function buildOrchestratorToolSet(params: ToolSetParams) {
  // 1. Tool-Calling Capability Check
  if (!params.isToolCallingModel) {
    return { allTools: undefined };
  }

  const activeTools: Record<string, any> = {};

  // 2. Knowledge Base Retrieval: Only when KBs exist and are fully indexed
  if (params.targetKbIds.length > 0 && params.kbIsReady) {
    Object.assign(activeTools, registerKnowledgebaseTool(params.targetKbIds, params.userId));
  }

  // 3. User Attachments: Only register presigned URL generator if files are present
  if (params.fileAttachments.length > 0) {
    Object.assign(activeTools, registerFileUrlTool(params.fileAttachments));
  }

  // 4. Agent Skills: Only register skill loader if skills are configured in scope
  if (params.availableSkills.length > 0) {
    Object.assign(activeTools, registerSkillTool(params.userId, params.scopeContext));
  }

  // 5. Artifacts / Memory: Check user selections
  if (isToolAllowed("manage_artifact", params.selectedTools)) {
    Object.assign(activeTools, registerArtifactTool());
  }

  // 6. External MCP Tools: Merge sanitised remote tools
  Object.assign(activeTools, params.mcpTools);

  return { allTools: activeTools };
}
```

---

## 6. Defensive Argument Normalization

LLMs frequently add extraneous quotes, backticks, or bracket wrappers to tool arguments (e.g. passing `"[clean-code]"` or `"\"references/guide.md\""`). Sanitize string arguments before querying databases or file systems:

```typescript
function normaliseArg(value: string): string {
  return value.replace(/^["'[\]`]+|["'[\]`]+$/g, "").trim();
}

// In tool execute:
execute: async ({ skillName }) => {
  const cleanName = normaliseArg(skillName).toLowerCase();
  const skill = await db.findSkill(userId, cleanName);
  if (!skill) return { error: `Skill "${cleanName}" not found.` };
  return { instructions: skill.content };
}
```

---

## 7. Knowledge Base Retrieval Tool Pattern

The `search_knowledge_base` tool exposes domain documents to the agent. It enforces prerequisite readiness checks, normalizes inputs, queries hybrid retrieval, and maps chunk payloads into token-efficient responses:

```typescript
// lib/chat/register-knowledgebase-tool.ts
import { tool } from "ai";
import { z } from "zod";
import { hybridSearch } from "@/lib/rag/hybrid-search";

export function registerKnowledgebaseTool(
  targetKbIds: string[],
  kbIsReady: boolean,
  userId: string,
  selectedTools?: string[],
): Record<string, any> {
  // Gate registration on readiness and tool selection
  const isGated =
    targetKbIds.length > 0 &&
    kbIsReady &&
    (selectedTools === undefined ||
      selectedTools.includes("search_knowledge_base"));

  if (!isGated) return {};

  return {
    search_knowledge_base: tool({
      description:
        "Search attached knowledge bases for domain documentation, technical specs, policies, or company data. ALWAYS call this first for domain-specific questions.",
      inputSchema: z.object({
        query: z.string().describe("Specific keyword or semantic query to search"),
      }),
      execute: async ({ query }) => {
        const normalized = (query || "").trim();
        if (!normalized) {
          return {
            success: false,
            error: "Missing mandatory 'query' parameter.",
          };
        }

        const results = await hybridSearch(targetKbIds, normalized, userId, 5);

        if (results.length === 0) {
          return {
            success: true,
            results: [],
            resultCount: 0,
            message: `No results found for '${normalized}'. Try broader search terms.`,
          };
        }

        return {
          success: true,
          results: results.map((r) => ({
            content: r.content,
            relevanceScore: Number(r.score.toFixed(4)),
            documentId: r.documentId,
            documentName: r.documentName,
            kbName: r.kbName,
          })),
          resultCount: results.length,
        };
      },
    }),
  };
}
```
