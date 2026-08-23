# Prisma Mock Completeness & Router Testing Patterns

## Overview

Testing tRPC routers that use Prisma requires a chainable mock object, ownership scoping assertions, and pagination branch coverage. The mock must cover every Prisma path the router touches — gaps cause silent `undefined` returns.

## When to Use

- Testing tRPC procedures that query/update the database
- Verifying ownership scoping (`userId` in every `where` clause)
- Testing pagination logic (hasNextPage, hasPreviousPage, search)
- Testing multi-query server actions

**Not for:** schema validation (use Zod tests), migration testing, or raw SQL queries.

## Prisma Mock Structure

### Global Mock (`__tests__/__mocks__/prisma.ts`)

```typescript
export const prismaMock = {
  workflow: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  credential: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  node: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  connection: {
    createMany: vi.fn(),
  },
  execution: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(async (cb) => await cb(prismaMock)),
};

vi.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return { ...actual, PrismaClient: vi.fn().mockImplementation(() => prismaMock) };
});

export default prismaMock;
```

### Schema Coverage Matrix

| Model            | Covered?      | Methods Mocked                                                            |
| ---------------- | ------------- | ------------------------------------------------------------------------- |
| **User**         | ❌ Not covered | — (auth mocked at lib level)                                              |
| **Session**      | ❌ Not covered | — (auth mocked at lib level)                                              |
| **Account**      | ❌ Not covered | — (auth mocked at lib level)                                              |
| **Verification** | ❌ Not covered | — (standalone, no FK)                                                     |
| **Credential**   | ✅ Full        | findMany, findUnique, findUniqueOrThrow, create, update, delete, count    |
| **Workflow**     | ✅ Full        | findMany, findUnique, findUniqueOrThrow, create, update, delete, count    |
| **Node**         | ⚠️ Partial     | deleteMany, createMany (NOT findMany/findUnique/create/update/delete)     |
| **Connection**   | ⚠️ Partial     | createMany (NOT findMany/findUnique/create/update/delete)                 |
| **Execution**    | ⚠️ Partial     | findMany, findUnique, findUniqueOrThrow, count (NOT create/update/delete) |

### Why Auth Tables Are Missing

Auth tables (User, Session, Account, Verification) are intentionally not mocked because `vitest.setup.ts` mocks `@/lib/auth` to return a hardcoded session:

```typescript
// vitest.setup.ts
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockImplementation(async () => ({
        user: { id: "user_123", email: "test@example.com" },
        session: { id: "session_123" },
      })),
    },
  },
}));
```

Tests never query User/Session directly — they assert ownership via `userId` in other models' `where` clauses.

### Node/Connection Gap

Node and Connection only have bulk operation mocks (`deleteMany`, `createMany`). Individual CRUD methods return `undefined`. This is acceptable because:

1. Node/Connection operations typically happen through Workflow relations (e.g., `workflow.findUnique({ include: { nodes: true } })`)
2. Router tests assert on Workflow-level operations, not individual Node queries
3. If a test calls `prismaMock.node.findUnique()`, it will get `undefined` and likely fail — add the method if needed

## tRPC Router Test Pattern

### Basic Setup

```typescript
import { appRouter } from "@/trpc/routers/_app";

const ctx = {
  auth: { user: { id: "user_123" } },
};
const caller = appRouter.createCaller(ctx as any);
```

### Ownership Scoping Assertions

Every Prisma query scopes to `userId`:

```typescript
it("deletes only the authenticated user's workflow", async () => {
  prismaMock.workflow.delete.mockResolvedValueOnce({ id: "wf_1", name: "Test", userId: "user_123" });

  await caller.workflows.delete({ id: "wf_1" });

  expect(prismaMock.workflow.delete).toHaveBeenCalledWith({
    where: { id: "wf_1", userId: "user_123" },
  });
});
```

### Pagination Branch Coverage

```typescript
it("getMany covers all pagination branches", async () => {
  // Branch: middle page with search → hasNext=true, hasPrevious=true
  prismaMock.workflow.count.mockResolvedValueOnce(15);
  prismaMock.workflow.findMany.mockResolvedValueOnce([{ id: "wf_1", name: "Test", userId: "user_123" }]);

  const result = await caller.workflows.getMany({ page: 2, pageSize: 5, search: "test" });
  expect(result.hasNextPage).toBe(true);
  expect(result.hasPreviousPage).toBe(true);

  // Branch: last page exact fit → hasNext=false
  prismaMock.workflow.count.mockResolvedValueOnce(10);
  const result2 = await caller.workflows.getMany({ page: 2, pageSize: 5 });
  expect(result2.hasNextPage).toBe(false);
  expect(result2.hasPreviousPage).toBe(true);

  // Branch: first page → hasPrevious=false
  const result3 = await caller.workflows.getMany({ page: 1, pageSize: 5 });
  expect(result3.hasNextPage).toBe(true);
  expect(result3.hasPreviousPage).toBe(false);
});
```

### Premium Procedure Bypass

```typescript
const ctxPremium = { ...ctx, customer: {} }; // ← bypasses Polar API call
const premiumCaller = appRouter.createCaller(ctxPremium as any);

const result = await premiumCaller.workflows.create({ name: "Test" });
expect(result.id).toBeDefined();
```

### Multi-Query Actions

For actions that make multiple Prisma calls (e.g., fetch + delete):

```typescript
it("fetches chat and messages then deletes", async () => {
  // First call: findUnique (returns data)
  prismaMock.chat.findUnique.mockResolvedValueOnce(CHAT_ROW);
  // Second call: findMany (returns messages)
  prismaMock.message.findMany.mockResolvedValueOnce([MSG_ROW]);
  // Third call: delete
  prismaMock.chat.delete.mockResolvedValueOnce(CHAT_ROW);

  await deleteChat("chat-1");

  expect(prismaMock.chat.delete).toHaveBeenCalledOnce();
  expect(prismaMock.message.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ chatId: "chat-1" }) }),
  );
});
```

## Call-Shape Assertion Strategy

Never assert only on returned data — assert on the Prisma call args:

```typescript
// ❌ BAD — same shape can come from wrong query
expect(result).toEqual(expectedRow);

// ✅ GOOD — asserts the exact query contract
expect(prismaMock.workflow.update).toHaveBeenCalledWith({
  where: { id: "wf_1", userId: "user_123" },
  data: expect.objectContaining({ name: "Updated Name" }),
});
```

## Gotchas

1. **Chainable mocks break silently** — intermediate methods must return the builder. If `mock.where()` returns `undefined`, the next `.findMany()` throws. Re-link defaults in `beforeEach` if using `resetAllMocks`.
2. **`$transaction` callback receives the mock** — the mock invokes `cb(prismaMock)`, so the callback gets the same mock instance. Assert on mock calls after the transaction completes.
3. **`as any` on context** — `createCaller` expects the real context shape, but tests provide a simplified `{ auth: { user: { id } } }`. Cast with `as any` because the full context includes `userId`, `db`, etc.
4. **Count used for pagination, not items** — `findMany` returns the page items; `count` returns total rows. Both must be stubbed independently.
5. **No edge case tests for pagination** — current suite lacks tests for `page: 0`, `pageSize: 0`, `totalCount: 0`, `page > totalPages`, or MAX_PAGE_SIZE enforcement.

## References

- [Prisma Client Testing](https://www.prisma.io/docs/guides/testing/unit-testing)
- [tRPC createCaller](https://trpc.io/docs/server/router)
- [Vitest Mock Reset vs Clear](https://vitest.dev/api/mock.html#mock-clearmockcalls)
