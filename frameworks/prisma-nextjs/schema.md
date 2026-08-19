# Schema: models, enums, indexes, relations

## Model conventions

- IDs: all ids are `String @id @default(cuid())` in the reference codebases — auth-library tables may use plain `String @id`
- Timestamps: `createdAt`/`updatedAt` on every model (see Timestamps)
- snake_case mapping via `@map`/`@@map` — table and column names stay snake_case in Postgres
- In the reference codebases, all FK relations use `onDelete: Cascade` (see Foreign keys & relations)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified Boolean  @default(false) @map("email_verified")
  updatedAt     DateTime @updatedAt

  @@map("users")
}
```

## Timestamps

```prisma
createdAt DateTime @default(now())
updatedAt DateTime @default(now()) @updatedAt
```

`@updatedAt` auto-bumps on create/update/upsert but NOT on `updateMany`/`createMany` — set `updatedAt: new Date()` manually in bulk operations.

## Enums

```prisma
enum ExecutionStatus {
  RUNNING
  SUCCESS
  FAILED
}
```

Compiles to a native Postgres `CREATE TYPE` and is imported as a TS type from `@prisma/client` (v6) or the generated output (v7). Both v6 and v7 generate TS enum values from the schema names (v7 reverted to v6 behavior).

## JSON fields

```prisma
position Json
data     Json @default("{}")
```

- Defaults must be stringified JSON (`"{}"`), not `{}`
- Pass plain JS objects when creating/updating: `data: { position: { x: 0, y: 0 } }`

## Native Postgres types

Use `@db.*` to pick non-default column types:

```prisma
body String   @db.Text
id   String   @db.Uuid
slug String   @db.VarChar(64)
```

## Unique constraints & indexes

```prisma
model Execution {
  inngestEventId String @unique
  workflowId     String

  @@unique([workflowId, inngestEventId]) // compound: generated where name is workflowId_inngestEventId
  @@index([workflowId])                  // always index FK columns
}
```

- `@unique` → `where: { field }`; `@@unique([a, b])` → `where: { a_b: { a, b } }`
- Index every FK column — codebases that skip `@@index` pay the query cost
- extendedWhereUnique: since Prisma 5, `where` on update/delete/upsert accepts the unique field PLUS extra non-unique filters (see `queries.md`)

## Foreign keys & relations

```prisma
model Node {
  id         String   @id @default(cuid())
  workflow   Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  workflowId String

  outputConnections Connection[] @relation("FromNode")
  inputConnections  Connection[] @relation("ToNode")
}

model Connection {
  fromNode   Node @relation("FromNode", fields: [fromNodeId], references: [id], onDelete: Cascade)
  fromNodeId String
  toNode     Node @relation("ToNode", fields: [toNodeId], references: [id], onDelete: Cascade)
  toNodeId   String
}
```

- `@relation(fields: [...], references: [...])` names the FK columns; `onDelete: Cascade` removes dependents with the parent
- Self-relations need a named relation (`"FromNode"`/`"ToNode"`) on both sides

## Official docs

- https://www.prisma.io/docs/orm/prisma-schema
