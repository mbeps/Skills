# Procedures: routers, zod inputs, ownership scoping, TRPCError

> **In this repo** (Nodebase): snippets marked "repo" match `trpc/routers/_app.ts`, `features/workflows/server/routers.ts`, `features/executions/server/routers.ts`, `schemas/workflows/workflow-router-schemas.ts`, `config/constants.ts`.

## Router composition (`trpc/routers/_app.ts`)

Domain routers live in `features/<domain>/server/routers.ts`, co-located with their prefetch helpers and schemas. The app router just composes them:

```ts
import { credentialsRouter } from "@/features/credentials/server/routers";
import { executionsRouter } from "@/features/executions/server/routers";
import { workflowsRouter } from "@/features/workflows/server/routers";
import { createTRPCRouter } from "../init";

export const appRouter = createTRPCRouter({
  workflows: workflowsRouter,
  credentials: credentialsRouter,
  executions: executionsRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
```

- `AppRouter` export is **type-only** (use `import type`), or client bundles pull in server code.
- Never import `AppRouter` from client components — client components use `useTRPC()` types instead.

## Ownership scoping — the non-negotiable rule

Every procedure scopes Prisma queries to the authenticated user via the middleware-injected `ctx.auth`:

```ts
where: { id: input.id, userId: ctx.auth.user.id }
```

- **Never** read `ctx.userId` — `createTRPCContext` returns the hardcoded `user_123` stub; a procedure reading it silently queries another user's data (tenant leak).
- For models **without a direct userId** (e.g. `Execution`), scope through the relation (repo):

```ts
where: {
  id: input.id,
  workflow: { userId: ctx.auth.user.id },
}
```

## Procedure patterns (repo, `workflowsRouter`)

**getOne** — `findUniqueOrThrow` + ownership:

```ts
getOne: protectedProcedure
  .input(workflowIdSchema)
  .query(async ({ ctx, input }) => {
    const workflow = await prisma.workflow.findUniqueOrThrow({
      where: { id: input.id, userId: ctx.auth.user.id },
      include: { nodes: true, connections: true },
    });
    // ... transform to React Flow nodes/edges ...
  }),
```

⚠️ `findUniqueOrThrow` throws Prisma P2025 on not-found, which serializes as **500**, not 404. The repo relies on this; for new code prefer wrapping:

```ts
const workflow = await prisma.workflow.findUnique({ where: { id, userId } });
if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
```

**getMany (paginated)** — `Promise.all([findMany, count])` + envelope (repo):

```ts
getMany: protectedProcedure
  .input(workflowGetManySchema)
  .query(async ({ ctx, input }) => {
    const { page, pageSize, search } = input;

    const [items, totalCount] = await Promise.all([
      prisma.workflow.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where: {
          userId: ctx.auth.user.id,
          name: { contains: search, mode: "insensitive" },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.workflow.count({
        where: { userId: ctx.auth.user.id, name: { contains: search, mode: "insensitive" } },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return { items, page, pageSize, totalCount, totalPages, hasNextPage, hasPreviousPage };
  }),
```

- `Promise.all` runs query + count concurrently.
- Search: `name: { contains: search, mode: "insensitive" }`. Sort: `orderBy: { updatedAt: "desc" }`.

**Atomic multi-write** — `$transaction` (repo, `workflows.update`):

```ts
return await prisma.$transaction(async (tx) => {
  await tx.node.deleteMany({ where: { workflowId: id } });
  await tx.node.createMany({
    data: nodes.map((node) => ({
      id: node.id, workflowId: id, name: node.type || "unknown",
      type: node.type as NodeType, position: node.position, data: node.data || {},
    })),
  });
  await tx.connection.createMany({ ... });
  await tx.workflow.update({ where: { id }, data: { updatedAt: new Date() } });
  return workflow;
});
```

**Inputless mutations** — no `.input()` at all (repo, `workflows.create`):

```ts
create: premiumProcedure.mutation(({ ctx }) => {
  return prisma.workflow.create({
    data: {
      name: generateSlug(3),
      userId: ctx.auth.user.id,
      nodes: { create: { type: NodeType.INITIAL, position: { x: 0, y: 0 }, name: NodeType.INITIAL } },
    },
  });
}),
```

**Premium gating — create only.** `premiumProcedure` sits on create mutations (`workflows.create`, `credentials.create`). Read/status queries use `protectedProcedure` — gating a status query throws FORBIDDEN for exactly the non-subscribers the feature is meant to serve.

## Zod input conventions (repo)

Co-located schemas in `schemas/<domain>/<domain>-router-schemas.ts`:

```ts
import { z } from "zod";
import { PAGINATION } from "@/config/constants";

export const workflowIdSchema = z.object({ id: z.string() });

export const workflowGetManySchema = z.object({
  page: z.number().default(PAGINATION.DEFAULT_PAGE),
  pageSize: z
    .number()
    .min(PAGINATION.MIN_PAGE_SIZE)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
  search: z.string().default(""),
});

export type WorkflowGetManyValues = z.infer<typeof workflowGetManySchema>;
```

- Defaults come from `PAGINATION` (`config/constants.ts`): `DEFAULT_PAGE: 1`, `DEFAULT_PAGE_SIZE: 5`, `MAX_PAGE_SIZE: 100`, `MIN_PAGE_SIZE: 1`.
- Enums via `z.nativeEnum(SomeEnum)`; extend with `.extend()` (Zod v4, repo: `credentialUpdateSchema = credentialUpsertSchema.extend({...})`).
- Export `type XValues = z.infer<typeof xSchema>` for form values and callers.

## TRPCError — expected errors only

- Expected failures (not found, forbidden, validation) → throw `TRPCError` with a semantic code.
- Non-TRPCErrors (Prisma P2025, fetch failures) serialize as 500 and hide the real cause from the client.
- `TRPCError({ code, message?, cause? })`; pass the original error as `cause` to keep the stack trace.

Full code → HTTP table (from tRPC v11 docs, verified 2026-08-20):

| Code                 | HTTP | Code                   | HTTP |
| -------------------- | ---- | ---------------------- | ---- |
| PARSE_ERROR          | 400  | UNSUPPORTED_MEDIA_TYPE | 415  |
| BAD_REQUEST          | 400  | UNPROCESSABLE_CONTENT  | 422  |
| UNAUTHORIZED         | 401  | PRECONDITION_REQUIRED  | 428  |
| PAYMENT_REQUIRED     | 402  | TOO_MANY_REQUESTS      | 429  |
| FORBIDDEN            | 403  | CLIENT_CLOSED_REQUEST  | 499  |
| NOT_FOUND            | 404  | INTERNAL_SERVER_ERROR  | 500  |
| METHOD_NOT_SUPPORTED | 405  | NOT_IMPLEMENTED        | 501  |
| TIMEOUT              | 408  | BAD_GATEWAY            | 502  |
| CONFLICT             | 409  | SERVICE_UNAVAILABLE    | 503  |
| PRECONDITION_FAILED  | 412  | GATEWAY_TIMEOUT        | 504  |
| PAYLOAD_TOO_LARGE    | 413  |                        |      |

Extract HTTP status from a `TRPCError` with `getHTTPStatusCodeFromError` from `@trpc/server/http`.

## Adding a new procedure — checklist

1. Pick the tier: `baseProcedure` → `protectedProcedure` → `premiumProcedure` (create mutations only).
2. Add a Zod input schema in `schemas/<domain>/`, export `type XValues = z.infer<...>`.
3. Scope every Prisma query by `userId: ctx.auth.user.id` (via relation when no direct userId).
4. Co-locate the router in `features/<domain>/server/routers.ts`; register it in `trpc/routers/_app.ts`.
5. Add a prefetch helper for queries (`features/<domain>/server/prefetch.ts`).
6. Add a client hook — `useSuspenseQuery` for reads, `useMutation` for writes.
7. Invalidate the affected list/detail per the invalidation table in `client-hooks.md`.
8. Wire error handling: `TRPCError` for expected failures; `handleError`/toast client-side.
