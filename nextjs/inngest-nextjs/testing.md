# Inngest Testing — Reference

## Local Development

### Dev Server

```bash
# Start Inngest dev server (requires INNGEST_DEV=1 in .env)
npm run inngest:dev
# or via CLI
inngest dev
# UI at http://localhost:8288
```

When `INNGEST_DEV=1`, the SDK connects to `http://localhost:8288` instead of Inngest Cloud. No event/signing keys required.

### Trigger Events from Code

```typescript
import { inngest } from "./inngest/client";

// Single event
await inngest.send({
  name: "workflows/execute.workflow",
  data: { workflowId: "clxxx123" },
});

// Multiple events
await inngest.send([
  { name: "app/user.signup", data: { userId: "1", email: "a@b.com" } },
  { name: "app/user.signup", data: { userId: "2", email: "c@d.com" } },
]);
```

### Via HTTP (Dev Server)

```bash
curl -X POST http://localhost:8288/e/<fake-key> \
  -H 'Content-Type: application/json' \
  --data '{"name": "app/test.event", "data": {"id": "test-001"}}'
```

### Via CLI

```bash
# Invoke a function from the UI at http://localhost:8288
# Navigate to Functions → Select function → Invoke → Send test payload
```

## Unit Testing Functions

### Mocking Step Methods

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    workflow: { findUniqueOrThrow: vi.fn() },
    execution: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/features/executions/lib/executor-registry", () => ({
  getExecutor: vi.fn(() => vi.fn(() => Promise.resolve({}))),
}));

vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

describe("executeWorkflow", () => {
  it("should process nodes in topological order", async () => {
    // Import after mocking
    const { executeWorkflow } = await import("@/inngest/functions");
    // Test structure — full function execution requires Inngest test helper
    // See https://www.inngest.com/docs/functions/test for the official helper
  });
});
```

### Using Inngest Test Helper

For full integration testing of Inngest functions with step replay verification, use the official Inngest test helper. See the [official documentation](https://www.inngest.com/docs/functions/test) for the latest API.

Basic pattern:

```typescript
import { Inngest, createFunction } from "inngest";

const inngest = new Inngest({ id: "test-app" });

const fn = createFunction(
  { id: "test-function", triggers: [{ event: "app/test" }] },
  async ({ event, step }) => {
    const result = await step.run("do-work", () => event.data.value * 2);
    return { result };
  },
);

// Use the official test helper to run and verify steps
// See docs for exact API signature
```

## Integration Testing

### Test with Real Database

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { sendWorkflowExecution } from "@/inngest/utils";

describe("workflow execution integration", () => {
  let workflowId: string;

  beforeAll(async () => {
    workflowId = await prisma.workflow.create({
      data: {
        name: "Test Workflow",
        user: { connect: { id: "test-user" } },
        nodes: { create: [{ name: "Node 1", type: "MANUAL_TRIGGER", position: { x: 0, y: 0 }, data: {} }] },
      },
      include: { nodes: true },
    });
  });

  afterAll(async () => {
    await prisma.execution.deleteMany();
    await prisma.workflow.delete({ where: { id: workflowId } });
  });

  it("sends execution event", async () => {
    await sendWorkflowExecution({ workflowId });
    // Verify event was sent — check Inngest dev server or mock inngest.send
  });
});
```

## Testing Checklist

- [ ] Dev server running (`INNGEST_DEV=1`)
- [ ] Events send successfully to `/api/inngest`
- [ ] Function executes without errors in dev UI
- [ ] Retries work as expected (trigger failure, verify retry)
- [ ] `onFailure` handler fires on unrecoverable errors
- [ ] Realtime channels publish and subscribe correctly
- [ ] Step memoisation works (re-run, verify steps don't re-execute)
- [ ] Cron triggers fire at expected times (use time-shift testing)
