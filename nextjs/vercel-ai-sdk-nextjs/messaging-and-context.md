# Messaging & Context Architecture

In real-world chat applications, messaging requires far more than passing strings to an LLM. You must assemble multimodal history (documents, images), reconstruct previous assistant tool calls and responses to AI SDK specifications, protect context windows against oversized tool outputs, calculate client/server token budgets, maintain long-term memory across sessions, compose layered system prompts, and seamlessly resolve slash command / mention prompts.

---

## 1. AI SDK v7 Prompt & System Instruction Rules

> [!IMPORTANT]
> **No System Role in Messages**: In modern Vercel AI SDK, system instructions MUST be passed via the `instructions` (or `system`) parameter of `streamText` / `generateText`. Injecting `{ role: "system", content: "..." }` into `messages: []` throws an `InvalidPromptError`.

```typescript
// ❌ WRONG: Passing system role inside messages array
streamText({
  model,
  messages: [
    { role: "system", content: "You are a helpful assistant." }, // Throws InvalidPromptError
    { role: "user", content: "Hello!" },
  ],
});

// ✅ CORRECT: Using instructions option
streamText({
  model,
  instructions: "You are a helpful assistant.",
  messages: [
    { role: "user", content: "Hello!" },
  ],
});
```

---

## 2. Production 12-Layer System Prompt Architecture

Compose system instructions hierarchically. Order matters: placing user identity first ensures that subsequent prompt layers can address the user directly, while placing tool execution rules and orchestrator directives at the end ensures maximum adherence.

```typescript
// lib/chat/build-system-prompt.ts
import type { ArtifactData } from "@/types/artifact";
import type { Skill, SkillSummary } from "@/types/skill";

export interface SystemPromptOptions {
  userContext?: { name?: string | null; email?: string | null };
  userMemories?: string[];
  canvasArtifacts?: ArtifactData[];
  hasKnowledgeBase?: boolean;
  attachmentNames?: string[];
  selectedSkills?: Skill[];
  availableSkills?: SkillSummary[];
  supportsTools?: boolean;
  isSubagentDelegationEnabled?: boolean;
}

export function buildSystemPrompt(
  globalPrompt: string | null | undefined,
  projectPrompt: string | null | undefined,
  assistantPrompt: string | null | undefined,
  options: SystemPromptOptions = {},
): string {
  const parts: string[] = [];

  // Layer 1: Authenticated User Identity
  if (options.userContext?.name?.trim() || options.userContext?.email?.trim()) {
    const lines = [
      options.userContext.name?.trim() && `- Name: ${options.userContext.name.trim()}`,
      options.userContext.email?.trim() && `- Email: ${options.userContext.email.trim()}`,
    ].filter(Boolean);
    parts.push(`## About the User\n${lines.join("\n")}`);
  }

  // Layer 2: Long-Term User Memories (Ambient Recall)
  if (options.userMemories && options.userMemories.length > 0) {
    const memoryList = options.userMemories.map((m) => `- ${m}`).join("\n");
    parts.push(
      `## User Memory\nThe following preferences and facts are remembered from previous conversations:\n${memoryList}\n\n` +
      `Apply these memories when answering and tailor your responses accordingly. When the user shares new enduring preferences or facts, use the save_memory tool to record them.`
    );
  }

  // Layer 3: Application Global System Prompt
  if (globalPrompt?.trim()) {
    parts.push(globalPrompt.trim());
  }

  // Layer 4: Project-Level System Prompt
  if (projectPrompt?.trim()) {
    parts.push(projectPrompt.trim());
  }

  // Layer 5: Assistant Custom Instructions
  if (assistantPrompt?.trim()) {
    parts.push(assistantPrompt.trim());
  }

  // Layer 6: Active Canvas Artifacts (Grounding in Live User Edits)
  if (options.canvasArtifacts && options.canvasArtifacts.length > 0) {
    const blocks = options.canvasArtifacts.map((art) => {
      const title = art.title || "Untitled Artifact";
      const type = art.type || "markdown";
      const idInfo = art.id ? ` (id: "${art.id}")` : "";
      return `### "${title}" [${type}]${idInfo}\n\`\`\`${type}\n${art.content}\n\`\`\``;
    });
    parts.push(
      `## Active Canvas\nThe user is currently viewing/editing the following artifact(s) on their canvas:\n\n${blocks.join("\n\n")}\n\n` +
      `Note: The content above reflects the latest state, including any direct edits made by the user on the canvas. When answering questions about or making modifications to the canvas, refer to this current content. To update the canvas, call \`manage_artifact\` with the full updated content.`
    );
  }

  // Layer 7: Knowledge Base Directives (Semantic Search & Hybrid RAG)
  if (options.hasKnowledgeBase) {
    parts.push(
      "A knowledge base is attached to this conversation with company-specific documents and domain context. " +
      "ALWAYS search the knowledge base first when answering questions, unless the query is clearly off-topic or requires only common knowledge. " +
      "Examples of when to search: product details, policies, technical specs, process documentation, historical data, user requirements, any domain-specific content. " +
      "Use precise, focused search queries. After retrieving results, synthesise them into your response."
    );
  }

  // Layer 8: Attached Files & Download URL Directives
  if (options.attachmentNames && options.attachmentNames.length > 0) {
    const fileList = options.attachmentNames.map((n) => `- ${n}`).join("\n");
    parts.push(
      `The user has attached the following files to this conversation:\n${fileList}\n\n` +
      `Use the get_file_url tool with the exact file name to obtain a download link when you need to access a file. If an MCP tool requires a local file path (e.g. Excel tools), first get the download URL using get_file_url, then pass that URL to the MCP file ingestion tool (such as upload_file with file_content=<URL> and filename=<name>) to stage the file, and use the returned local file path with other tools.`
    );
  }

  // Layer 9: Pre-Injected User-Selected Skills
  for (const skill of options.selectedSkills ?? []) {
    parts.push(`## Active Skill: ${skill.name}\n${skill.content}`);
  }

  // Layer 10: Available Skills Catalog (Lightweight Progressive Disclosure)
  if (options.supportsTools && options.availableSkills && options.availableSkills.length > 0) {
    const catalog = options.availableSkills.map((s) => `- \`${s.name}\`: ${s.description}`).join("\n");
    parts.push(
      `## Available Skills\nCall the load_skill tool to dynamically load full guidelines when needed:\n${catalog}`
    );
  }

  // Layer 11: Tool-Generated Files Instructions
  if (options.supportsTools) {
    parts.push(
      "## Tool Usage & Generated Files\n" +
      "When you create, generate, or modify files using tools (such as spreadsheets, workbooks, documents, or data exports) that the user should receive, you MUST call the corresponding download or export tool (such as `download_file` with the `file_path`) so the file content is retrieved and an interactive download button is presented to the user. Do not simply tell the user the file is ready without calling the tool to provide the download."
    );
  }

  // Layer 12: Orchestrator & Subagent Delegation Directives
  if (options.isSubagentDelegationEnabled) {
    parts.push(
      "## Orchestrator Directives & Subagent Delegation\n" +
      "You are operating as the Lead Orchestrator. You have access to the `delegate_task` tool to assign isolated, context-heavy subtasks to specialized worker subagents.\n" +
      "- **Final Response & Synthesis**: Worker subagents run in isolated sandboxes and CANNOT talk directly to the user or produce user-facing artifacts. You are strictly responsible for reviewing their outputs and synthesizing a complete, high-quality, comprehensive final answer for the user.\n" +
      "- **Artifacts & Canvas**: If the user requested a document, report, table, code, or canvas artifact, you MUST call `manage_artifact` yourself to generate it. Subagents do not have access to `manage_artifact`.\n" +
      "- **Step Budgeting**: Budget your execution turns. Do not chain endless subagent calls without reserving turns to create requested artifacts and write your final response."
    );
  }

  if (parts.length === 0) {
    return "You are a helpful AI assistant.";
  }

  return parts.join("\n\n---\n\n");
}
```

---

## 3. Long-Term Memory Architecture & Tool Integration

A robust memory system allows the model to recall past user preferences and persist new ones across conversations without manual prompt engineering.

### 3.1 Database Schema & Recency Retrieval

Store user memories with automatic timestamps and user scoping in PostgreSQL:

```typescript
// drizzle/schemas/user-memory-schema.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const userMemory = pgTable("user_memory", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// lib/memory/retrieve-relevant-memories.ts
import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";

export async function retrieveRelevantMemories(
  userId: string,
  limit = 20,
): Promise<string[]> {
  const rows = await db
    .select({ content: userMemory.content })
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
    .orderBy(desc(userMemory.updatedAt))
    .limit(limit);

  return rows.map((r) => r.content);
}
```

### 3.2 Case-Insensitive Deduplication on Save

Avoid saving duplicate facts by updating the recency timestamp (`updatedAt`) when an identical memory is saved again:

```typescript
// lib/memory/save-memory-for-user.ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";

export async function saveMemoryForUser(userId: string, content: string) {
  const trimmed = content.trim();

  // Deduplicate exact/case-insensitive content for the user
  const [existing] = await db
    .select()
    .from(userMemory)
    .where(
      and(
        eq(userMemory.userId, userId),
        sql`lower(${userMemory.content}) = lower(${trimmed})`,
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(userMemory)
      .set({ updatedAt: new Date() })
      .where(eq(userMemory.id, existing.id))
      .returning();

    return { ...existing, updatedAt: updated.updatedAt, deduplicated: true };
  }

  const [inserted] = await db
    .insert(userMemory)
    .values({ userId, content: trimmed })
    .returning();

  return { ...inserted, deduplicated: false };
}
```

### 3.3 The `save_memory` Tool Definition

Register an internal AI tool that binds the authenticated `userId` and instructs the model when to save enduring facts:

```typescript
// lib/chat/register-memory-tool.ts
import { tool } from "ai";
import { z } from "zod";
import { saveMemoryForUser } from "@/lib/memory/save-memory-for-user";

export function registerMemoryTool(userId: string, selectedTools?: string[]) {
  if (selectedTools && !selectedTools.includes("save_memory")) {
    return {};
  }

  return {
    save_memory: tool({
      description:
        "Saves an important fact, user preference, workflow rule, or enduring detail about the user to long-term memory. " +
        "Call this tool when the user explicitly asks to remember something (e.g. 'remember that I prefer Bun', 'my name is Alex'), " +
        "or when the user shares personal background, key workflow preferences, or project conventions that will be useful across future sessions. " +
        "Do NOT save temporary, transient conversation details.",
      inputSchema: z.object({
        content: z.string().min(1).describe("The fact, preference, or convention to remember permanently."),
      }),
      execute: async ({ content }) => {
        const trimmed = (content || "").trim();
        if (!trimmed) {
          return { success: false, error: "Memory content cannot be empty." };
        }
        try {
          const res = await saveMemoryForUser(userId, trimmed);
          return {
            success: true,
            message: `Memory saved: "${res.content}".`,
            memoryId: res.id,
          };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to save memory." };
        }
      },
    }),
  };
}
```

---

## 4. Context Window Token Budgeting & Real-Time Calculation

Context budgeting must occur **both client-side** (to inform the user of usage before sending) and **server-side** (to prevent API context length overflows).

### 4.1 Client-Side Real-Time Category Breakdown (`calculateContextUsage`)

Compute multi-category token estimates including system prompts, active tools, skills, message history, files, past tool results, and the active draft:

```typescript
// lib/chat/calculate-context-tokens.ts
import { estimateTokens } from "@/lib/chat/estimate-tokens";

export interface CalculateContextParams {
  thread?: Message[];
  selectedModel?: { contextWindow: number };
  input?: string;
  draftAttachments?: Attachment[];
  systemPrompt?: string;
  toolNames?: string[];
  mcpServerCount?: number;
  selectedSkillTokens?: number;
  availableSkillCount?: number;
}

export function calculateContextUsage(params: CalculateContextParams) {
  const maxTokens = params.selectedModel?.contextWindow || 128_000;

  // 1. System instructions
  const systemInstructions = estimateTokens(params.systemPrompt || "") || 120;

  // 2. Tool schema definitions (~180 tokens/tool + ~50 tokens/MCP server)
  const toolSchemaTokens = (params.toolNames?.length || 0) * 180;
  const serverOverheadTokens = (params.mcpServerCount || 0) * 50;
  const toolDefinitions = toolSchemaTokens + serverOverheadTokens;

  // 3. Skills: fully injected selected skills + lightweight catalog (~50 tokens each)
  const catalogTokens = (params.availableSkillCount || 0) * 50;
  const skills = (params.selectedSkillTokens || 0) + catalogTokens;

  // 4. Thread messages & past tool execution results
  let messages = 0;
  let files = 0;
  let toolResults = 0;

  for (const msg of params.thread || []) {
    messages += estimateTokens(msg.content);
    if (msg.attachments) {
      for (const att of msg.attachments) {
        files += att.type === "image" ? 800 : estimateTokens(att.extractedText || "");
      }
    }
    if (msg.metadata) {
      const meta = JSON.parse(msg.metadata);
      if (meta.reasoning) messages += estimateTokens(meta.reasoning);
      if (meta.toolCalls) {
        for (const tc of meta.toolCalls) {
          toolResults += estimateTokens(JSON.stringify(tc.args));
        }
      }
      if (meta.toolResults) {
        for (const tr of meta.toolResults) {
          const raw = typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result);
          // Cap estimate to bounded representation (max 8000 chars)
          toolResults += estimateTokens(raw.slice(0, 8000));
        }
      }
    }
  }

  // 5. Active draft input & attachments
  let draft = estimateTokens(params.input || "");
  for (const att of params.draftAttachments || []) {
    draft += att.type === "image" ? 800 : estimateTokens(att.extractedText || "");
  }

  const totalTokens = systemInstructions + toolDefinitions + skills + messages + files + toolResults + draft;
  const rawPercent = (totalTokens / maxTokens) * 100;
  const percentage = Math.min(100, Math.round(rawPercent));

  return {
    totalTokens,
    maxTokens,
    percentage,
    displayPercentage: totalTokens > 0 && percentage === 0 ? "< 1%" : `${percentage}%`,
    breakdown: {
      systemInstructions,
      toolDefinitions,
      skills,
      messages,
      files,
      toolResults,
      draft,
    },
    isNearLimit: rawPercent >= 75,
    isExceeded: rawPercent >= 100,
  };
}
```

### 4.2 Server-Side Sliding Window Pruning (`prepareChatMessages`)

Before passing messages to `streamText`, prune the oldest conversation turns while retaining system instructions and the most recent user prompt. Enforce an **85% context window safety threshold**:

```typescript
// lib/chat/prepare-chat-messages.ts
import type { ModelMessage } from "ai";
import { assembleModelMessages } from "./assemble-model-messages";
import { estimateModelMessageTokens } from "./estimate-tokens";

function trimLeadingNonUsers(messages: ModelMessage[]): ModelMessage[] {
  let startIdx = 0;
  while (startIdx < messages.length && messages[startIdx].role !== "user") {
    startIdx++;
  }
  return startIdx > 0 ? messages.slice(startIdx) : messages;
}

function trimToTokenBudget(messages: ModelMessage[], maxBudget: number): ModelMessage[] {
  let currentMessages = messages;
  let currentTokens = currentMessages.reduce((sum, m) => sum + estimateModelMessageTokens(m), 0);

  // Prune turn-by-turn (advancing to next user message) from oldest to newest
  while (currentTokens > maxBudget) {
    const nextUserIdx = currentMessages.findIndex((m, idx) => idx > 0 && m.role === "user");
    if (nextUserIdx === -1) break;

    currentMessages = currentMessages.slice(nextUserIdx);
    currentTokens = currentMessages.reduce((sum, m) => sum + estimateModelMessageTokens(m), 0);
  }

  return currentMessages;
}

export function prepareChatMessages(options: {
  history: ThreadMessage[];
  maxContextTokens?: number;
  maxTurns?: number;
}): ModelMessage[] {
  const processedMessages = assembleModelMessages(options.history);
  const limit = options.maxTurns ?? 50;

  const initialSlice = processedMessages.length > limit
    ? processedMessages.slice(-limit)
    : processedMessages;

  let finalMessages = trimLeadingNonUsers(initialSlice);

  if (options.maxContextTokens && options.maxContextTokens > 0) {
    finalMessages = trimToTokenBudget(finalMessages, options.maxContextTokens);
  }

  return finalMessages;
}
```

---

## 5. Multimodal History Assembly (`assembleModelMessages`)

Convert raw database messages and attachments into Vercel AI SDK `ModelMessage[]`:

```typescript
import type { ModelMessage } from "ai";

type TextPart = { type: "text"; text: string };
type FilePart = {
  type: "file";
  data: { type: "url"; url: string };
  mediaType: string;
};

export function assembleModelMessages(messages: HistoryMessage[]): ModelMessage[] {
  return messages.flatMap((m) => {
    // 1. Strip any legacy system messages from array (handled via instructions parameter)
    if (m.role === "system") return [];

    // 2. Multimodal user messages with attachments
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const docParts: TextPart[] = [];
      const imageParts: FilePart[] = [];

      for (const att of m.attachments) {
        if (att.type === "document" && att.extractedText) {
          docParts.push({
            type: "text",
            text: `[Document: ${att.name}]\n${att.extractedText}`,
          });
        } else if (att.type === "image" && att.url) {
          imageParts.push({
            type: "file",
            data: { type: "url", url: att.url },
            mediaType: att.mimeType ?? "image/jpeg",
          });
        }
      }

      const textParts: TextPart[] =
        typeof m.content === "string" && m.content.trim()
          ? [{ type: "text", text: m.content }]
          : [];

      const parts = [...docParts, ...textParts, ...imageParts];
      return [
        {
          role: "user",
          content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts,
        } as ModelMessage,
      ];
    }

    // 3. Reconstruct assistant messages that executed tools
    const assistantToolMsgs = assembleAssistantToolMessages(m);
    if (assistantToolMsgs) {
      return assistantToolMsgs;
    }

    return [{ role: m.role as any, content: m.content as any }];
  });
}
```

---

## 6. Reconstructing Past Assistant Tool Calls & Tool Results

When the LLM previously executed tool calls in a multi-turn thread, the conversation history must accurately reproduce both the assistant's `tool-call` parts and the corresponding `tool` role responses:

```typescript
const LARGE_OUTPUT_NOTICE = "\n\n[... Large tool output truncated for context window limits ...]";

function truncateLargeOutput(outputValue: unknown, isJson: boolean, raw: unknown): string | null {
  if (isJson) {
    const strVal = JSON.stringify(outputValue);
    if (strVal.length > 12000) return strVal.slice(0, 8000) + LARGE_OUTPUT_NOTICE;
    return null;
  }
  if (typeof raw === "string" && raw.length > 8000) {
    return raw.slice(0, 8000) + LARGE_OUTPUT_NOTICE;
  }
  return null;
}

function formatToolResultPart(tc: any, toolResultsList: any[]): any {
  const tr = toolResultsList.find((r: any) => r.toolCallId === tc.toolCallId);
  const raw = tr?.output?.value ?? tr?.output ?? tr?.result ?? { error: "Tool execution did not return a result" };
  const isJson = typeof raw === "object" && raw !== null;

  const truncatedText = truncateLargeOutput(raw, isJson, raw);
  if (truncatedText !== null) {
    return {
      type: "tool-result",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output: { type: "text", value: truncatedText },
    };
  }

  return {
    type: "tool-result",
    toolCallId: tc.toolCallId,
    toolName: tc.toolName,
    output: isJson ? { type: "json", value: raw } : { type: "text", value: String(raw ?? "") },
  };
}

export function assembleAssistantToolMessages(m: HistoryMessage): ModelMessage[] | null {
  if (m.role !== "assistant" || !m.metadata) return null;

  try {
    const meta = JSON.parse(m.metadata);
    if (!Array.isArray(meta.toolCalls) || meta.toolCalls.length === 0) return null;

    // 1. Assistant message with text + tool-call parts (strictly provide `input`)
    const textPart = m.content ? [{ type: "text", text: String(m.content) }] : [];
    const callParts = meta.toolCalls.map((tc: any) => {
      const rawInput = tc.input ?? tc.args;
      return {
        type: "tool-call",
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        input: typeof rawInput === "string" ? JSON.parse(rawInput) : rawInput,
      };
    });

    const assistantContent = [...textPart, ...callParts];

    // 2. Matching tool message with tool-result parts (strictly provide `output`)
    const resultParts = meta.toolCalls.map((tc: any) =>
      formatToolResultPart(tc, meta.toolResults ?? []),
    );

    return [
      { role: "assistant", content: assistantContent } as ModelMessage,
      { role: "tool", content: resultParts } as ModelMessage,
    ];
  } catch {
    return null;
  }
}
```

> [!WARNING]
> **Provider Serialization Invariant**: Provider serializers (like OpenAI) reconstruct conversation turn history by reading `part.input` on `ToolCallPart` and `part.output` on `ToolResultPart`. Setting legacy `args` on historical `ToolCallPart` leaves `part.input` undefined, which causes providers to serialize `{}` (an empty object) into the LLM prompt. Always normalize historical records to pure `input` on `ToolCallPart` and structured `output` on `ToolResultPart`.
```

---

## 7. Slash Command Prompts & Mention System

Modern chat applications support slash commands (`/explain`, `/refactor`) or mention prompts triggered by typing `/` in the message input. Prompts can originate from **local database templates** or **dynamic MCP servers** (`listPrompts`).

### 7.1 Scope Filtering & Multi-Source Unified Items

Filter accessible prompts according to context (project-scoped, assistant-scoped, or global), and unify local database prompts with MCP server prompts:

```typescript
// components/chat/prompt-picker/prompt-picker-utils.ts
export interface PromptScopeContext {
  projectId?: string | null;
  assistantId?: string | null;
  promptMode?: "all" | "none" | "specific";
  allowedPromptIds?: string[];
}

export function filterAccessiblePrompts(prompts: Prompt[], context: PromptScopeContext): Prompt[] {
  const { projectId, assistantId, promptMode = "all", allowedPromptIds = [] } = context;
  const allowedSet = new Set(allowedPromptIds);

  return prompts.filter((p) => {
    const isProjectScoped = Boolean(projectId && p.projectIds?.includes(projectId));
    const isAssistantScoped = Boolean(assistantId && p.assistantIds?.includes(assistantId));
    if (isProjectScoped || isAssistantScoped) return true;

    const isGlobal = (!p.projectIds || p.projectIds.length === 0) && (!p.assistantIds || p.assistantIds.length === 0);
    if (!isGlobal) return false;

    if (!projectId && !assistantId) return true;
    if (promptMode === "none") return false;
    if (promptMode === "specific") return allowedSet.has(p.id);
    return true;
  });
}
```

### 7.2 Resolving Remote MCP Prompts

When an MCP prompt (`mcp:<serverId>:<promptName>`) is selected, fetch it dynamically:

```typescript
// lib/chat/resolve-mcp-prompt.ts
import { getMcpPrompt } from "@/actions/mcp/get-mcp-prompt";

export async function resolveMcpPrompt(serverId: string, promptName: string): Promise<string> {
  const res = await getMcpPrompt(serverId, promptName);
  const promptData = res?.ok ? res.value : res;
  if (!promptData || !promptData.messages) return "";

  return promptData.messages
    .map((m: any) => {
      if (typeof m.content === "string") return m.content;
      if (m.content?.type === "text") return m.content.text;
      if (m.content?.text) return m.content.text;
      return "";
    })
    .join("\n\n");
}
```

### 7.3 Multi-Prompt Composition & Metadata Separation

Prepend resolved prompt chunks using a `\n\n` separator while **preserving the original untemplated user text** in message metadata (`meta.userContent`). This prevents polluting the UI with raw injected templates:

```typescript
// hooks/chat/stream/use-stream-prompt-content.ts
export async function resolveContent(
  content: string,
  selectedPromptIds: string[] = [],
  metadataObj: Record<string, unknown> = {},
): Promise<{ fullContent: string }> {
  if (selectedPromptIds.length === 0) return { fullContent: content };

  const promptChunks: string[] = [];
  for (const promptId of selectedPromptIds) {
    if (promptId.startsWith("mcp:")) {
      const [, serverId, ...rest] = promptId.split(":");
      const promptName = rest.join(":");
      const chunk = await resolveMcpPrompt(serverId, promptName);
      if (chunk) promptChunks.push(chunk);
    } else {
      const local = await getLocalPromptContent(promptId);
      if (local) promptChunks.push(local);
    }
  }

  // Preserve metadata so UI displays prompt chips instead of raw prepended text
  metadataObj.promptIds = selectedPromptIds;
  metadataObj.userContent = content; // Original untemplated user text

  if (promptChunks.length === 0) {
    return { fullContent: content };
  }

  // Prepend resolved instructions to user input
  return {
    fullContent: `${promptChunks.join("\n\n")}\n\n${content}`,
  };
}
```
