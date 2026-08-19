# Queries: CRUD, ownership scoping, transactions, errors

## CRUD quick reference

| Operation          | Method                                     | Notes                                   |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| Create             | `prisma.workflow.create({ data })`         | nested writes for dependents            |
| Read one           | `findUnique({ where: { id } })`            | returns `null` when missing             |
| Read one or throw  | `findUniqueOrThrow({ where })`             | throws P2025 when missing               |
| Read first match   | `findFirst({ where })`                     | scoping-friendly                        |
| Read many          | `findMany({ where, orderBy, skip, take })` |                                         |
| Update             | `update({ where, data })`                  | throws P2025 when missing               |
| Bulk update        | `updateMany({ where, data })`              | no `@updatedAt` auto-bump               |
| Delete             | `delete({ where })`                        | throws P2025 when missing               |
| Bulk delete        | `deleteMany({ where })`                    |                                         |
| Create or update   | `upsert({ where, update, create })`        | `where` must reference unique fields    |
| Count              | `count({ where })`                         | pair with `findMany` for pagination     |
| Bulk create        | `createMany({ data })`                     | returns `{ count }` only                |
| Bulk create + rows | `createManyAndReturn({ data })`            | Postgres only; not inside nested writes |

## Ownership scoping (multi-tenant)

NEVER query user data by id alone — `findUnique({ where: { id } })` returns the row regardless of who owns it.

Either filter the relation inside `findUniqueOrThrow` (fetches the workflow row for the `include` in one query):

```ts
const execution = await prisma.execution.findUniqueOrThrow({
  where: { id: input.id, workflow: { userId } },
  include: { workflow: { select: { id: true, name: true } } },
});
```

Or use `findFirst` with an explicit owner filter:

```ts
const workflow = await prisma.workflow.findFirst({
  where: { id: input.id, userId },
});
```

Pass `userId` from the authenticated session on the server; never trust client-supplied ids alone.

## extendedWhereUnique

In Prisma 5+/6/7, `where` for `update`/`delete`/`upsert` accepts the unique field PLUS extra non-unique filters (verified in real code):

```ts
await prisma.execution.update({
  where: { inngestEventId, workflowId }, // only inngestEventId is @unique
  data: { status: "SUCCESS" },
});
```

For a true composite key use `@@unique([a, b])` and the generated name: `where: { a_b: { a, b } }`.

## Transactions

Nested writes — dependent rows that need the parent's generated id:

```ts
await prisma.workflow.create({
  data: { name, userId, nodes: { create: { type: "trigger" } } },
});
```

Array `$transaction([...])` — independent writes, executed sequentially, atomic:

```ts
const [items, totalCount] = await prisma.$transaction([
  prisma.workflow.findMany({ where, skip, take, orderBy: { updatedAt: "desc" } }),
  prisma.workflow.count({ where }),
]);
```

Note: array transactions run sequentially, not in parallel — wrapping them in `Promise.all` does not help.

Interactive `$transaction(async (tx) => ...)` — complex read-modify-write logic; rolls back on throw:

```ts
await prisma.$transaction(async (tx) => {
  await tx.node.deleteMany({ where: { workflowId } });
  await tx.node.createMany({ data: nodes.map((n) => ({ workflowId, type: n.type })) });
});
```

Keep interactive transactions short: default timeout 5000ms, `maxWait` 2000ms. Pass `{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }` when needed. Write conflicts surface as P2034 — retry the transaction.

## Pagination & search

```ts
const [items, totalCount] = await prisma.$transaction([
  prisma.workflow.findMany({
    where: { userId, name: { contains: search, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
    skip,
    take,
  }),
  prisma.workflow.count({ where: { userId, name: { contains: search, mode: "insensitive" } } }),
]);
```

`mode: "insensitive"` is Postgres-only. For very large tables prefer cursor pagination (`cursor` + `skip: 1`) over `skip`/`take`.

## Upsert

```ts
await prisma.userSettings.upsert({
  where: { userId },
  update: { theme },
  create: { userId, theme },
});
```

`where` is `Prisma.UserSettingsWhereUniqueInput` — it must reference unique field(s).

## Error handling

| Code  | Meaning                                              |
| ----- | ---------------------------------------------------- |
| P2002 | unique constraint violation (`meta.target` = fields) |
| P2025 | record not found                                     |
| P2003 | foreign key violation                                |
| P2034 | transaction deadlock/write conflict — retry          |

v7: import the `Prisma` namespace from the generated client instead — `import { Prisma } from "@/lib/generated/prisma/client"`.

```ts
import { Prisma } from "@prisma/client";

try {
  await prisma.workflow.create({ data });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { error: "Already exists" };
    if (e.code === "P2025") return { error: "Not found" };
  }
  throw e;
}
```

Match on `e.code`, inspect `e.meta`, and rethrow anything unknown.

## Raw SQL

Use tagged templates only when the typed API can't express the query:

```ts
const rows = await prisma.$queryRaw`SELECT * FROM "Node" WHERE "workflowId" = ${workflowId}`;
const n = await prisma.$executeRaw`UPDATE "Execution" SET "status" = 'SUCCESS' WHERE id = ${id}`;
```

Parameters are escaped automatically; `Prisma.sql` composes reusable fragments. If raw SQL dominates, consider the `pg` driver directly.

## Which API to use

| Situation                      | Use                                     |
| ------------------------------ | --------------------------------------- |
| Dependent rows, need parent id | nested write                            |
| Independent writes             | `$transaction([...])` / batch methods   |
| Read-modify-write logic        | interactive `$transaction`              |
| Bulk same-type change          | `updateMany` / `createMany`             |
| Need generated ids back        | `createManyAndReturn` or interactive tx |

## Official docs

- https://www.prisma.io/docs/orm/prisma-client/queries
