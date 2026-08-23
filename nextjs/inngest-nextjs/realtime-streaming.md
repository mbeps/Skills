# Inngest Realtime Streaming — Reference

## Overview

Inngest Realtime lets you stream status updates from durable functions to React components via typed channels and topics. Updates published inside `step.run()` won't duplicate on retry; high-frequency updates (e.g., AI tokens) use `inngest.realtime.publish` outside steps.

## Define a Channel with Typed Topics

```typescript
// inngest/channels/openai.ts
import { channel, topic } from "@inngest/realtime";

export const openAiChannel = channel("openai-execution").addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>(),
);
```

For complex schemas with nested validation, use `staticSchema`:

```typescript
import { channel, topic, staticSchema } from "@inngest/realtime";
import { z } from "zod";

export const pipelineChannel = channel("pipeline").addTopics({
  status: topic("status").type<
    z.infer<typeof statusSchema>
  >(),
  tokens: topic("tokens").type<
    z.infer<typeof tokenSchema>
  >(),
});

const statusSchema = z.object({
  message: z.string(),
  progress: z.number().min(0).max(100),
});

const tokenSchema = z.object({
  token: z.string(),
});
```

## Publish from a Function

### Durable publish (inside step.run — no duplicates on retry)

```typescript
export const myFunction = inngest.createFunction(
  { id: "my-function", triggers: [{ event: "app/task.created" }] },
  async ({ event, step }) => {
    await step.realtime.publish(
      "starting-status",
      openAiChannel.status,
      { nodeId: event.data.nodeId, status: "loading" },
    );

    // ... do work ...

    await step.realtime.publish(
      "final-status",
      openAiChannel.status,
      { nodeId: event.data.nodeId, status: "success" },
    );
  },
);
```

### High-frequency publish (outside step.run — acceptable to replay)

```typescript
export const streamTokens = inngest.createFunction(
  { id: "stream-tokens", triggers: [{ event: "app/generate.start" }] },
  async ({ event, step }) => {
    const stream = await step.run("generate-stream", () =>
      generateTextStream(event.data.prompt),
    );

    let text = "";
    for await (const chunk of stream) {
      // High-frequency — safe to replay, uses Inngest's internal dedup
      await inngest.realtime.publish(openAiChannel.tokens, {
        token: chunk.delta,
      });
      text += chunk.delta;
    }

    return text;
  },
);
```

## Mint Subscription Token (Server Component / Route Handler)

```typescript
// app/actions.ts
"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { inngest } from "@/inngest/client";
import { openAiChannel } from "@/inngest/channels/openai";
import { getSession } from "@/lib/auth-utils";

export async function fetchToken(nodeId: string) {
  const { user } = await getSession();
  if (!user) throw new Error("Unauthorized");

  return getClientSubscriptionToken(inngest, {
    channel: openAiChannel,
    topics: ["status"],
  });
}
```

## Subscribe from the Browser (React Hook)

```tsx
// app/components/node-status.tsx
"use client";

import { useRealtime } from "inngest/react";
import { openAiChannel } from "@/inngest/channels/openai";
import { fetchToken } from "@/app/actions";

export function NodeStatus({ nodeId }: { nodeId: string }) {
  const { messages, connectionStatus } = useRealtime({
    channel: openAiChannel,
    topics: ["status"] as const,
    token: () => fetchToken(nodeId),
  });

  const status = messages.byTopic.status?.data;

  return (
    <div>
      <p>Connection: {connectionStatus}</p>
      {status && (
        <>
          <p>Status: {status.status}</p>
          <p>Node: {status.nodeId}</p>
        </>
      )}
    </div>
  );
}
```

## Channel Patterns

### Per-Run Channel (unique per execution)

```typescript
// Dynamic channel name per workflow run
export const executionChannel = realtime.channel({
  name: ({ runId }: { runId: string }) => `execution:${runId}`,
  topics: {
    status: topic("status").type<{ status: string }>(),
    logs: topic("logs").type<{ line: string }>(),
  },
});
```

### Shared Channel (all runs share one channel)

```typescript
// Static channel — all runs publish to same topic
export const globalChannel = channel("global-updates").addTopic(
  topic("notifications").type<{ message: string }>(),
);
```

## TypeScript Tips

- Use Zod `infer` for type-safe topic schemas
- Keep channel definitions in separate files per domain
- Export typed channel instances, not raw channel builders
- Use `as const` assertion when passing topics to `useRealtime`
