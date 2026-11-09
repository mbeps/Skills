# React Client Hooks (`@ai-sdk/react` & Custom Streaming)

The `@ai-sdk/react` package exposes hooks for managing streaming conversations, autocomplete completions, and structured JSON rendering in Client Components (`"use client"`). In production background architectures, custom hooks consume Inngest Realtime or SSE streams, calculate real-time context budgets, and manage slash commands / mention prompts.

---

## 1. Interactive Chat with `useChat`

`useChat` manages message history, user input state, optimistic updates, and HTTP streaming automatically for route handlers.

### Modern Transport & Hook Helpers

Configure the transport via `DefaultChatTransport` to customize request headers, body structures, or endpoint paths:

```tsx
// components/chat/chat-drawer.tsx
"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, StopCircle, RefreshCw } from "lucide-react";

export function ChatDrawer({ workflowId }: { workflowId: string }) {
  const [input, setInput] = useState("");

  const chat = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ body }) => ({
          body: { ...(body ?? {}), workflowId },
        }),
      }),
    [workflowId],
  );

  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    resumeStream,
    addToolOutput,
    status,
    error,
    clearError,
  } = useChat({
    chat,
    onFinish: ({ message, isAbort, isError }) => {
      // NOTE: Client hook callback stays `onFinish` (server is `onEnd`).
      if (!isAbort && !isError) {
        console.log("Turn completed successfully:", message.id);
      }
    },
    onError: (err) => {
      console.error("Chat streaming failed:", err);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-background">
      <ScrollArea className="flex-1 p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-start gap-3 mb-4 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role !== "user" && <Bot className="w-5 h-5 mt-1 text-primary" />}
            <div
              className={`p-3 rounded-lg text-sm max-w-[80%] whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {message.content}
            </div>
            {message.role === "user" && <User className="w-5 h-5 mt-1 text-muted-foreground" />}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="w-4 h-4 animate-spin" />
            <span>AI is responding...</span>
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading}
        />
        {isLoading ? (
          <Button type="button" variant="destructive" size="icon" onClick={stop}>
            <StopCircle className="w-4 h-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon">
            <Send className="w-4 h-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
```

### Hook API Reference & Gotchas

| Feature | Key / Method | Description |
|---|---|---|
| **Lifecycle State** | `status` | `'submitted' \| 'streaming' \| 'ready' \| 'error'` |
| **Sending Messages** | `sendMessage({ text }, { body })` | Dispatches new user message turn |
| **Retry & Regeneration** | `regenerate()` | Retries generation for the last assistant turn |
| **Abort Control** | `stop()` | Aborts active client stream |
| **Stream Recovery** | `resumeStream()` | Reconnects to in-flight generation stream |
| **Interactive Tools** | `addToolOutput({ toolCallId, output })` | Submits client execution result for human-in-the-loop or client tool |
| **Approvals** | `addToolApprovalResponse({ toolCallId, approved })` | Submits authorization confirmation for gated tool execution |
| **Error Clearing** | `clearError()` | Resets active error state |

> [!WARNING]
> **Client `onFinish` vs Server `onEnd` Gotcha**: In `@ai-sdk/react`, the client-side `useChat` option remains `onFinish`, receiving `{ message, isAbort, isError }`. Only the server-side SDK functions (`streamText`, `generateText`) renamed `onFinish` to `onEnd`. Never rename the client `onFinish` to `onEnd`.

### Rendering `UIMessage.parts`
A `UIMessage` contains `{ id, role, metadata?, parts }`. Render dynamic multi-part messages by branching on `part.type`:
- `'text'`: Standard text deltas
- `'reasoning'`: Internal reasoning/thinking tokens
- `'tool-call'`: Tool invocation (contains `toolCallId`, `toolName`, `input`)
- `'tool-result'`: Completed tool payload (contains `toolCallId`, `toolName`, `output`)
- `'file'`: Attached document or image url/mimeType
- Dynamic tools stream `state` (`'input-available' | 'output-available'`) and `input`/`output`.
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="w-4 h-4 animate-spin" />
            <span>AI is responding...</span>
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
          disabled={isLoading}
        />
        {isLoading ? (
          <Button type="button" variant="destructive" size="icon" onClick={stop}>
            <StopCircle className="w-4 h-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon">
            <Send className="w-4 h-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
```

---

## 2. Consuming Durable Background Streams (Inngest Realtime / SSE)

When streaming is executed inside durable background jobs (to avoid serverless HTTP timeouts, survive mobile tab sleep, and persist across page refreshes), the client connects to an **Inngest Realtime channel** with authenticated tokens, historical replay pointers, stream watchdogs, and tree-based database synchronization.

### 2.1 Server Action Token Generation

The client must never use public or static credentials. Mint scoped subscription tokens per conversation via Server Action:

```tsx
// actions/chats/chat-realtime-token.ts
"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { chatChannel } from "@/lib/inngest/chat-channel";
import { inngest } from "@/lib/inngest/client";
import { ok, fail } from "@/lib/result";

export const getChatRealtimeToken = async (chatId: string) => {
  const session = await requireSession();

  const [row] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!row) {
    return fail({ code: "NOT_FOUND", message: "Chat not found or access denied" });
  }

  const token = await getClientSubscriptionToken(inngest, {
    channel: chatChannel({ chatId }),
    topics: ["stream"],
  });

  return ok(token);
};
```

### 2.2 Inngest Realtime Channel Hook with Pointer Tracking & Deduplication

Inngest Realtime streams both historical event logs (`messages.all`) and real-time increments (`messages.delta`). Track a slice index pointer and `WeakSet<object>` to prevent duplicate processing during reconnects or history re-evaluations:

```tsx
// hooks/chat/stream/use-stream-realtime.ts
"use client";

import { useRealtime } from "inngest/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getChatRealtimeToken } from "@/actions/chats/chat-realtime-token";
import { chatChannel, type ChatStreamEvent } from "@/lib/inngest/chat-channel";

function processIncomingRealtimeBatch(
  batch: Array<{ data?: unknown } | unknown>,
  processedSet: WeakSet<object>,
  onEvent: (event: ChatStreamEvent) => void,
) {
  for (const msg of batch) {
    if (msg && typeof msg === "object" && !processedSet.has(msg)) {
      processedSet.add(msg);
      const data = (msg as { data?: unknown }).data;
      if (data) onEvent(data as ChatStreamEvent);
    }
  }
}

export function useStreamRealtimeChannel(
  chatId: string,
  chatNotFound: boolean,
  setChatNotFound: (notFound: boolean) => void,
  resetStreamingState: () => void,
  handleStreamEvent: (event: ChatStreamEvent) => void,
) {
  const lastProcessedIndexRef = useRef(0);
  const processedMessagesRef = useRef<WeakSet<object>>(new WeakSet());

  useEffect(() => {
    lastProcessedIndexRef.current = 0;
  }, [chatId]);

  const fetchChatToken = useCallback(async () => {
    if (!chatId) throw new Error("No chatId");
    const res = await getChatRealtimeToken(chatId);
    if (!res.ok) {
      setChatNotFound(true);
      resetStreamingState();
      throw new Error(res.error.message);
    }
    return res.value;
  }, [chatId, resetStreamingState, setChatNotFound]);

  const realtime = useRealtime({
    channel: chatId ? chatChannel({ chatId }) : undefined,
    topics: ["stream"] as const,
    token: fetchChatToken,
    enabled: Boolean(chatId) && !chatNotFound,
    historyLimit: null, // Receive full backlog if joining an active in-flight stream
  });

  // Replay slice handling for all vs delta
  useEffect(() => {
    const all = realtime.messages?.all;
    if (all && all.length > 0) {
      if (all.length < lastProcessedIndexRef.current) {
        lastProcessedIndexRef.current = 0;
      }
      if (all.length > lastProcessedIndexRef.current) {
        processIncomingRealtimeBatch(
          all.slice(lastProcessedIndexRef.current),
          processedMessagesRef.current,
          handleStreamEvent,
        );
        lastProcessedIndexRef.current = all.length;
      }
      return;
    }

    const delta = realtime.messages?.delta;
    if (delta && delta.length > 0) {
      processIncomingRealtimeBatch(delta, processedMessagesRef.current, handleStreamEvent);
    }
  }, [realtime.messages?.all, realtime.messages?.delta, handleStreamEvent]);

  return realtime;
}
```

### 2.3 Resilient Mount Rejoin & Tree-Based Database Sync

When a user refreshes the page or navigates between chat sessions, the client checks if generation is still running. If complete, it syncs the finalized assistant turn from the database:

```tsx
// hooks/chat/stream/use-stream-db-sync.ts
export async function syncFromDb(chatId: string, activeLeafParentId?: string) {
  const res = await getChat(chatId);
  if (!res.ok) return false;

  const { messages } = res.value;
  // Locate the assistant message matching the parent user message turn in tree
  const assistantMsg = Object.values(messages).find(
    (m: any) => m.role === "assistant" && m.parentId === activeLeafParentId,
  );

  if (assistantMsg) {
    applySyncedAssistantMessage(chatId, assistantMsg);
    return true;
  }
  return false;
}
```

### 2.4 Stream Watchdog (Stall Detection & Recovery)

If network disconnects or WebSocket packets stall without an explicit `finish` event, the watchdog polls the server's running status (`isChatGenerating(chatId)`), triggers a database sync if the background worker finished, or aborts if permanently stuck:

```tsx
// hooks/chat/stream/use-stream-watchdog.ts
export function useStreamWatchdog({
  chatId,
  isStreaming,
  lastChunkTime,
  syncFromDb,
  resetStreamingState,
}: WatchdogParams) {
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      const timeSinceLastChunk = Date.now() - lastChunkTime;

      // If no chunks received for > 5s, check if worker concluded
      if (timeSinceLastChunk > 5000) {
        const generating = await isChatGenerating(chatId);
        if (!generating) {
          const synced = await syncFromDb();
          if (synced) resetStreamingState();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [chatId, isStreaming, lastChunkTime, syncFromDb, resetStreamingState]);
}
```

### 2.5 Custom Stream State Reducer (`useStreamState`)

When consuming raw events from Inngest Realtime or custom SSE streams, reduce the incoming event log into accumulated content, reasoning, and active tool invocations:

```tsx
// hooks/chat/stream/use-stream-state.ts
export function useStreamState(data: { messages?: Array<{ data?: unknown }> } | undefined) {
  const [content, setContent] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [activeTools, setActiveTools] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const processedRef = useRef<WeakSet<object>>(new WeakSet());

  useEffect(() => {
    if (!data?.messages) return;

    for (const msg of data.messages) {
      if (processedRef.current.has(msg)) continue;
      processedRef.current.add(msg);

      const event = msg.data as ChatStreamEvent;
      if (!event) continue;

      switch (event.type) {
        case "start":
          setIsStreaming(true);
          setContent("");
          setReasoning("");
          setActiveTools([]);
          break;
        case "text-delta":
          setContent((prev) => prev + event.text);
          break;
        case "reasoning-delta":
          setReasoning((prev) => prev + event.reasoning);
          break;
        case "tool-call":
          setActiveTools((prev) => [
            ...prev.filter((t) => t.toolCallId !== event.toolCallId),
            { ...event, status: "calling" },
          ]);
          break;
        case "tool-result":
          setActiveTools((prev) =>
            prev.map((t) =>
              t.toolCallId === event.toolCallId
                ? { ...t, status: event.preliminary ? "calling" : "complete", result: event.result }
                : t,
            ),
          );
          break;
        case "finish":
        case "error":
          setIsStreaming(false);
          break;
      }
    }
  }, [data]);

  return { content, reasoning, activeTools, isStreaming };
}
```

---

## 3. Rendering Thinking & Reasoning Timelines

### Reasoning Stream Invariant
When calculating whether the model is actively thinking in UI spinners or custom hooks:

```typescript
const isStreamingReasoning =
  isStreaming &&
  !!streamingReasoning &&
  !streamingContent &&
  activeToolCalls.length === 0;
```

> [!IMPORTANT]
> **Why this matters:** In tool-calling turns, the model often yields reasoning deltas followed immediately by tool calls before any text content is generated. If `activeToolCalls.length === 0` is omitted, `streamingContent` remains empty during tool execution, falsely showing an active "Thinking..." spinner while external tools are running.

Render separate, collapsible sections for reasoning vs markdown response content:

```tsx
export function StreamingMessageBubble({
  content,
  reasoning,
  activeTools,
  isStreaming,
}: {
  content: string;
  reasoning: string;
  activeTools: any[];
  isStreaming: boolean;
}) {
  const [isThinkingOpen, setIsThinkingOpen] = useState(true);

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Reasoning Accordion */}
      {reasoning && (
        <div className="border rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <button
            type="button"
            className="flex items-center gap-2 font-medium"
            onClick={() => setIsThinkingOpen(!isThinkingOpen)}
          >
            <span>Thinking process</span>
            {isStreaming && <span className="animate-pulse">...</span>}
          </button>
          {isThinkingOpen && (
            <div className="mt-2 whitespace-pre-wrap font-mono">{reasoning}</div>
          )}
        </div>
      )}

      {/* 2. Tool & Subagent Execution Cards */}
      {activeTools.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeTools.map((tc) =>
            tc.toolName === "delegate_task" ? (
              <SubagentTraceCard
                key={tc.toolCallId}
                role={tc.args?.role}
                taskBrief={tc.args?.taskBrief}
                status={resolveSubagentOutcome(tc.status, tc.result)}
                messageId={messageId}
              />
            ) : (
              <div key={tc.toolCallId} className="border p-2 rounded text-xs">
                <span className="font-semibold">{tc.toolName}</span>: {tc.status}
              </div>
            )
          )}
        </div>
      )}

      {/* 3. Streamed Final Content */}
      <div className="text-sm prose dark:prose-invert">
        {content}
      </div>
    </div>
  );
}
```

---

## 4. Text Autocomplete with `useCompletion`

`useCompletion` handles single-prompt generation, making it ideal for inline title suggestions or code completions:

```tsx
"use client";

import { useCompletion } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function PromptAssistant() {
  const { completion, input, handleInputChange, handleSubmit, isLoading } =
    useCompletion({
      api: "/api/completion",
    });

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Describe what you need..."
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Generating..." : "Generate"}
        </Button>
      </form>

      {completion && (
        <div className="p-4 bg-muted rounded-md text-sm whitespace-pre-wrap">
          {completion}
        </div>
      )}
    </div>
  );
}
```

---

## 5. Slash Command & Prompt Selection Hook (`useChatPromptSelection`)

Manage toggling, selecting, and removing multi-source prompt items in the chat composer:

```tsx
"use client";

import { useCallback, useMemo } from "react";
import type { MentionPromptItem } from "@/types/prompt";

export function useChatPromptSelection(
  selectedPrompts: MentionPromptItem[] | undefined,
  setSelectedPrompts: React.Dispatch<React.SetStateAction<MentionPromptItem[]>> | undefined,
) {
  const promptList = selectedPrompts || [];
  const selectedPromptIds = useMemo(
    () => new Set(promptList.map((p) => p.id)),
    [promptList],
  );

  const handleTogglePrompt = useCallback(
    (prompt: MentionPromptItem) => {
      setSelectedPrompts?.((prev = []) => {
        if (prev.some((p) => p.id === prompt.id)) {
          return prev.filter((p) => p.id !== prompt.id);
        }
        return [...prev, prompt];
      });
    },
    [setSelectedPrompts],
  );

  const handleRemovePrompt = useCallback(
    (promptId?: string) => {
      setSelectedPrompts?.((prev = []) => {
        if (!promptId) return [];
        return prev.filter((p) => p.id !== promptId);
      });
    },
    [setSelectedPrompts],
  );

  return {
    promptList,
    selectedPromptIds,
    handleTogglePrompt,
    handleRemovePrompt,
  };
}
```

---

## 6. Real-Time Context Usage Pill (`ContextUsagePill`)

Display live token consumption with a breakdown popover before messages are dispatched:

```tsx
"use client";

import { useMemo } from "react";
import { calculateContextUsage } from "@/lib/chat/calculate-context-tokens";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ContextUsagePill({
  thread,
  selectedModel,
  input,
  draftAttachments,
  systemPrompt,
  toolNames,
}: Parameters<typeof calculateContextUsage>[0]) {
  const usage = useMemo(
    () =>
      calculateContextUsage({
        thread,
        selectedModel,
        input,
        draftAttachments,
        systemPrompt,
        toolNames,
      }),
    [thread, selectedModel, input, draftAttachments, systemPrompt, toolNames],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border transition-colors",
            usage.isExceeded
              ? "bg-destructive/15 text-destructive border-destructive/30"
              : usage.isNearLimit
                ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
                : "bg-muted text-muted-foreground border-border",
          )}
        >
          Context: {usage.displayPercentage}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-xs space-y-1.5" align="end">
        <div className="font-semibold pb-1 border-b">
          Context Breakdown ({usage.totalTokens.toLocaleString()} / {usage.maxTokens.toLocaleString()})
        </div>
        <div className="flex justify-between">
          <span>System & Rules:</span>
          <span className="font-mono">{usage.breakdown.systemInstructions} tok</span>
        </div>
        <div className="flex justify-between">
          <span>Active Tools:</span>
          <span className="font-mono">{usage.breakdown.toolDefinitions} tok</span>
        </div>
        <div className="flex justify-between">
          <span>Chat Messages:</span>
          <span className="font-mono">{usage.breakdown.messages} tok</span>
        </div>
        <div className="flex justify-between">
          <span>Tool Results:</span>
          <span className="font-mono">{usage.breakdown.toolResults} tok</span>
        </div>
        <div className="flex justify-between">
          <span>Draft & Input:</span>
          <span className="font-mono">{usage.breakdown.draft} tok</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```
