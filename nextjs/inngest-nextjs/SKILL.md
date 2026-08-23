---
name: inngest-nextjs
description: Use when building background jobs, durable functions, event-driven workflows, or realtime status streaming with Inngest v4 in a Next.js App Router project — covers function creation, step methods, event schemas, DAG execution, realtime channels, testing, error handling, deployment, and common patterns like fan-out, debounce, idempotency, and conditional branching.
---

# Inngest + Next.js

## Overview

Inngest v4 provides **durable functions** — background jobs that checkpoint after every `step.run()`, survive serverless cold starts, and replay automatically on failure. Combined with Next.js App Router, it gives end-to-end type safety from Prisma → tRPC → Inngest events → UI via Realtime.

**Core principle:** Every step is a transaction. Wrap all I/O in `step.run()`. Never put business logic outside steps — it won't execute on replay.

## When to Use

- Need reliable background processing (workflow execution, AI inference, webhooks)
- Want per-step retries without manual queue infrastructure
- Require realtime status streaming to a React UI
- Building DAGs or fan-out patterns over events
- Need cron-triggered jobs with durable checkpoints

## Not For

- Simple one-off tasks better handled by Next.js route handlers
- Real-time bidirectional communication (use WebSockets/Server-Sent Events)
- Tasks requiring sub-second latency (Inngest has ~1s cold start)

## Quick Start

```typescript
// inngest/client.ts
import { Inngest } from "inngest";
export const inngest = new Inngest({ id: "my-app" });

// inngest/functions/hello.ts
import { inngest } from "../client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world", triggers: [{ event: "app/user.signup" }] },
  async ({ event, step }) => {
    await step.run("send-welcome-email", () => sendEmail(event.data.email));
    return { sent: true };
  },
);

// app/api/inngest/route.ts
import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { helloWorld } from "../../../inngest/functions/hello";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [helloWorld],
});
```

## Core Concepts

### Functions & Steps

| Concept | Description |
|---------|-------------|
| **Function** | Durable background job triggered by events, cron, or webhooks |
| **Step** | Checkpointed unit of work inside a function (`step.run`) |
| **Event** | Payload that triggers a function; typed via Zod schema |
| **Serve handler** | API route (`/api/inngest`) that Inngest calls |

### Step Methods

| Method | Purpose | Retry-safe? |
|--------|---------|:-----------:|
| `step.run(id, fn)` | Executable retriable checkpoint | Yes — memoised |
| `step.sleep(id, dur)` | Pause for duration (max 1y / 7d free) | N/A |
| `step.sleepUntil(id, date)` | Pause until datetime | N/A |
| `step.waitForEvent(id, opts)` | Pause until matching event arrives | N/A |
| `step.waitForSignal(id, opts)` | Pause until external signal | N/A |
| `step.invoke(id, opts)` | Call another Inngest function | Yes |
| `step.sendEvent(id, evt)` | Send event reliably within a step | Yes |
| `step.ai.wrap(id, fn, args)` | Wrap Vercel AI SDK call as durable step | Yes |
| `step.realtime.publish(topic, data)` | Publish realtime update | Yes (on step.run) |

**Rule:** Only I/O goes inside `step.run()`. Pure computation can stay outside.

### Handler Context

```typescript
async ({ event, events, step, runId, logger, attempt }) => { /* ... */ }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `Event` | Single event payload (undefined for cron) |
| `events` | `Event[]` | Array when `batchEvents` configured |
| `step` | `StepTools` | All step methods |
| `runId` | `string` | Unique ID for this function run |
| `logger` | `PinoLogger` | Structured logger |
| `attempt` | `number` | Zero-indexed attempt number |

## Event Types with Schema Validation

```typescript
import { Inngest, eventType } from "inngest";
import { z } from "zod";

const inngest = new Inngest({ id: "my-app" });

const orderPlaced = eventType("shop/order.placed", {
  schema: z.object({
    orderId: z.string(),
    total: z.number(),
  }),
});

export const processOrder = inngest.createFunction(
  { id: "process-order", triggers: [orderPlaced] },
  async ({ event, step }) => {
    // event.data is fully typed — TypeScript knows orderId, total
    await step.run("charge-card", () => chargeCard(event.data));
  },
);
```

## Error Handling

```typescript
import { NonRetriableError } from "inngest";

export const myFunction = inngest.createFunction(
  {
    id: "my-function",
    retries: 5, // Default is 4; set 0 to disable
    onFailure: async ({ event, error }) => {
      // Per-function failure handler
      await notifySlack(`Function failed: ${error.message}`);
    },
    triggers: [{ event: "app/task.created" }],
  },
  async ({ event, step }) => {
    // Retryable — will retry automatically
    await step.run("external-api-call", () => fetchExternalApi());

    // Non-retriable — bypasses remaining retries immediately
    try {
      await step.run("validate-input", () => validate(event.data));
    } catch (err) {
      throw new NonRetriableError("Invalid input: " + err.message);
    }

    // Rollback pattern — fallback on failure
    let result: string | null = null;
    try {
      result = await step.run("primary-action", () => doPrimaryAction());
    } catch {
      result = await step.run("fallback-action", () => doFallback());
    }
  },
);
```

## Common Patterns

### DAG Execution (Sequential Topological Sort)

```typescript
export const executeWorkflow = inngest.createFunction(
  { id: "execute-workflow", triggers: [{ event: "workflows/execute.workflow" }] },
  async ({ event, step }) => {
    const sortedNodes = await step.run("prepare-workflow", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: event.data.workflowId },
        include: { nodes: true, connections: true },
      });
      return topologicalSort(workflow.nodes, workflow.connections);
    });

    for (const node of sortedNodes) {
      // ⚠️ node.id is DB-stable (cuid2), so this is safe for replay.
      // Never use truly dynamic IDs like `step-${Date.now()}` — they break memoisation.
      await step.run(`execute-node-${node.id}`, async () => {
        return executeNodeExecutor(node);
      });
    }
  },
);
```

### Fan-Out Pattern

```typescript
// Cron triggers fan-out → parallel processing
export const prepareWeeklyDigest = inngest.createFunction(
  { id: "weekly-digest", triggers: [{ cron: "TZ=UTC 0 12 * * 5" }] },
  async ({ step }) => {
    const users = await step.run("load-users", () => db.loadUsers());
    const events = users.map((user) => ({
      name: "app/send.weekly.digest",
      data: { userId: user.id, email: user.email },
    }));
    await step.sendEvent("send-digest-events", events);
  },
);

export const sendWeeklyDigest = inngest.createFunction(
  { id: "send-digest-email", triggers: [{ event: "app/send.weekly.digest" }] },
  async ({ event, step }) => {
    await step.run("send-email", () => email.send(event.data.email));
  },
);
```

### Parallel Steps via invoke

```typescript
const computeA = inngest.createFunction(
  { id: "compute-a", triggers: [{ event: "compute/start" }] },
  async ({ event }) => ({ result: heavyComputationA(event.data.input) }),
);

const computeB = inngest.createFunction(
  { id: "compute-b", triggers: [{ event: "compute/start" }] },
  async ({ event }) => ({ result: heavyComputationB(event.data.input) }),
);

export const parallelCompute = inngest.createFunction(
  { id: "parallel-compute", triggers: [{ event: "compute/start" }] },
  async ({ step, event }) => {
    const [a, b] = await Promise.all([
      step.invoke("compute-a-result", { function: computeA, data: event.data }),
      step.invoke("compute-b-result", { function: computeB, data: event.data }),
    ]);
    return { combined: merge(a.result, b.result) };
  },
);
```

### Debounce Pattern

```typescript
export const syncUserData = inngest.createFunction(
  {
    id: "sync-user-data",
    triggers: [{ event: "app/user.updated" }],
    debounce: { period: "5m", key: "event.data.userId" },
  },
  async ({ event, step }) => {
    // Runs only after 5 min of no more updates for same user
    await step.run("sync-to-warehouse", () => syncToWarehouse(event.data.userId));
  },
);
```

### Idempotency

```typescript
export const processInvoice = inngest.createFunction(
  {
    id: "process-invoice",
    triggers: [{ event: "app/invoice.created" }],
    idempotency: "event.data.invoiceId", // Prevents duplicate runs for 24h
  },
  async ({ event, step }) => {
    await step.run("create-record", () => createInvoice(event.data));
  },
);
```

### AI SDK Integration

```typescript
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export const summarizeContent = inngest.createFunction(
  { id: "summarize", triggers: [{ event: "app/ticket.created" }] },
  async ({ event, step }) => {
    const { text } = await step.ai.wrap(
      "generate-summary",
      generateText,
      { model: openai("gpt-4o"), prompt: "Summarize: " + event.data.content },
    );
    return text;
  },
);
```

## Realtime Status Streaming

Define typed channels, publish from executors, subscribe from React components. See [realtime-streaming.md](./realtime-streaming.md) for full reference.

## Testing

Start local dev server, send test events via CLI or code. See [testing.md](./testing.md) for complete guide.

## Deployment

See [deployment.md](./deployment.md) for serve vs connect models, environment setup, and production checklist.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Business logic outside `step.run()` | Move ALL I/O into steps |
| Using `setTimeout` instead of `step.sleep()` | Use `step.sleep()` for delays |
| Forgetting unique step IDs | Each `step.run()` needs a stable unique ID |
| Throwing non-`NonRetriableError` for bad input | Wrap validation errors in `NonRetriableError` |
| Putting async effects in step callbacks | Steps must be pure functions of their inputs |
| Assuming sequential = serial | `Promise.all` of `step.invoke` runs in parallel |
| Skipping step IDs for deduplication | IDs are required for memoisation and deduplication |

## Anti-Patterns — Violating the Letter Breaks Everything

These are the exact failure modes observed when agents skip Inngest conventions. Each is a loophole that MUST be closed.

### ❌ Serve via `inngest.serve()` instead of `serve` from `inngest/next`

```typescript
// ❌ WRONG: This API doesn't exist in v4
export const { GET, POST } = inngest.serve({ client: inngest, functions: [...] });

// ✅ CORRECT: Named import from inngest/next
import { serve } from "inngest/next";
export const { GET, POST, PUT } = serve({ client: inngest, functions: [...] });
```

**Why it matters:** `inngest.serve()` is a v3 pattern. In v4, `serve` is a named export from `inngest/next`. The handler must expose GET, POST, AND PUT methods.

### ❌ Wrong realtime API (`createChannel`, `useInngest().subscribe()`)

```typescript
// ❌ WRONG: v3 patterns
import { createChannel } from "inngest/channel";
const channel = createChannel("my-channel");
// or
const inngest = useInngest();
inngest.subscribe({ channel }, callback);

// ✅ CORRECT: v4 channel + useRealtime hook
import { channel, topic } from "@inngest/realtime";
export const myChannel = channel("my-channel").addTopic(topic("status").type<{ msg: string }>());
// and in React:
const { messages } = useRealtime({ channel: myChannel, topics: ["status"], token: () => fetchToken() });
```

**Why it matters:** `createChannel` and `useInngest().subscribe()` are v3 APIs. v4 uses `channel()` from `@inngest/realtime` with typed topics, and the `useRealtime` hook for subscriptions.

### ❌ Wrong trigger syntax (confusing typed vs simple events)

```typescript
// ❌ WRONG: Using eventType with simple event name
const myEvent = eventType("app/test", { schema: z.object({...}) });
inngest.createFunction({ id: "my-fn", triggers: [myEvent] }, ...);
// If you don't need runtime validation, don't use eventType

// ✅ CORRECT: Simple event (no schema needed)
triggers: [{ event: "workflows/execute.workflow" }]

// ✅ CORRECT: Typed event with Zod schema
const myTypedEvent = eventType("app/test", { schema: z.object({...}) });
triggers: [myTypedEvent]
```

### ❌ Fake error parameter in function callback

```typescript
// ❌ WRONG: error is not a callback parameter
async ({ event, step, error }) => { /* ... */ }

// ✅ CORRECT: Use onFailure option
inngest.createFunction(
  { id: "my-fn", onFailure: async ({ event, error }) => { /* handle */ } },
  async ({ event, step }) => { /* normal logic */ },
);
```

### ❌ Non-existent RetryAfterError

```typescript
// ❌ WRONG: RetryAfterError does not exist in Inngest
throw new RetryAfterError("Rate limited", 60);

// ✅ CORRECT: Inngest retries automatically with exponential backoff
// No special error needed — just throw any Error and Inngest retries
```

### ❌ Wrong step.ai.wrap signature

```typescript
// ❌ WRONG: Passing model directly as first arg
await step.ai.wrap("id", fn, { model: openai("gpt-4"), prompt: "..." });

// ✅ CORRECT: wrap takes (id, fnToWrap, ...args)
await step.ai.wrap("generate", generateText, { model: openai("gpt-4o"), prompt: "..." });
```

**Iron Law for Inngest:** Every `step.run()` ID must be stable across deploys. Changing a step ID breaks replay because Inngest can't find the cached result. Never use dynamic IDs like `` `step-${Date.now()}` ``.

## Related Skills

- **supabase-nextjs**: Database + auth patterns for projects using Supabase alongside Inngest
