# Queries: select, insert, update, delete, transactions, relational API

All filter/aggregate operators import from `drizzle-orm`; table/column builders from `drizzle-orm/pg-core`. Values in `.where()`, `.values()`, and `sql\`\`` templates are automatically parameterized ($1, $2, ...) — injection-safe.

## Select

```ts
import { and, desc, eq, inArray, ilike } from "drizzle-orm";

// full rows
await db.select().from(message);

// partial projection (typed)
await db.select({ id: message.id, role: message.role }).from(message);

// ownership-scoped + joins (project convention)
const [chatRow] = await db
  .select({ chat: chat, projectName: project.name })
  .from(chat)
  .leftJoin(project, eq(chat.projectId, project.id))
  .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

// order / limit / offset (pagination)
await db.select().from(message)
  .where(eq(message.chatId, chatId))
  .orderBy(desc(message.createdAt))
  .limit(50).offset(50);
```

- **Ownership rule:** every user-data query filters with `eq(table.userId, session.user.id)` combined via `and(...)` — the DB is the backstop; don't trust client-supplied IDs.
- `.selectDistinct()` for distinct; `.selectDistinctOn([col])` (Postgres).
- Subqueries: `const sq = db.select(...).from(...).where(...).as("sq")` then select/join from `sq`.
- CTEs: `db.$with("name").as(db.select(...))` then `db.with(sq).select()...`.
- Conditional where: pass `undefined` to skip — `.where(term ? ilike(posts.title, term) : undefined)`.
- Joins: `.innerJoin/.leftJoin/.rightJoin/.fullJoin(table, on)`.

## Operators

| Category    | Operators                                                                  |
| ----------- | -------------------------------------------------------------------------- |
| Comparison  | `eq`, `ne`, `gt`, `gte`, `lt`, `lte`                                       |
| List        | `inArray(col, [...])`, `notInArray`                                        |
| String      | `like` (case-sensitive), `ilike` (case-insensitive), `notLike`, `notIlike` |
| Null        | `isNull`, `isNotNull`                                                      |
| Logic       | `and(...)`, `or(...)`, `not(...)`                                          |
| Range       | `between(col, a, b)`, `notBetween`                                         |
| Existence   | `exists(subquery)`, `notExists`                                            |
| Arrays (pg) | `arrayContains`, `arrayContained`, `arrayOverlaps`                         |

`inArray` accepts an array **or** a subquery (`db.select({...}).from(...)`).

## Aggregations

```ts
import { count, countDistinct, sum, avg, min, max } from "drizzle-orm";

const [row] = await db.select({ total: count() }).from(todo).where(eq(todo.userId, uid));
// row.total: number  — count() internally does .mapWith(Number)

// grouping
await db.select({ age: users.age, c: count() }).from(users).groupBy(users.age)
  .having(({ c }) => gt(c, 1));

// count with filter, usable as subquery column to avoid N+1:
db.$count(todo, eq(todo.userId, uid));   // number

// raw sql count needs explicit mapping (bigint → string from node-postgres):
documentCount: sql<number>`(SELECT COUNT(*)::int FROM kb_document WHERE kb_document.kb_id = ${kb.id})`.mapWith(Number),
```

**Gotcha:** Postgres `count(*)` returns `bigint`, which node-postgres surfaces as a **string**. The `count()` helper maps it to `number` for you; raw `sql\`count(*)\`` subqueries do NOT — add `.mapWith(Number)`.

## Insert

```ts
import { sql } from "drizzle-orm";

const [newRow] = await db.insert(message)
  .values({ chatId, role: "user", content, parentId: parentId ?? null })
  .returning();                    // full row; .returning({ id: message.id }) for subset

// multiple rows
await db.insert(users).values([{ name: "A" }, { name: "B" }]);

// upsert
await db.insert(users).values({ id, name: "John" })
  .onConflictDoNothing();          // or { target: users.id }
await db.insert(users).values({ id, name: "John" })
  .onConflictDoUpdate({ target: users.id, set: { name: "John" } });

// type for insert payloads:
type NewMessage = typeof message.$inferInsert;
```

`.returning()` is supported in Postgres and SQLite; MySQL lacks it. `onConflictDoUpdate` supports composite targets `target: [a, b]`, `setWhere` and `targetWhere` for partial-index conflicts.

**Postgres error codes:** insert/update violations surface as errors with a `.code` — handle `23505` (unique_violation) and `23503` (foreign_key_violation) in server actions instead of letting them bubble up uncaught.

## Update / Delete

```ts
// update — pass updatedAt explicitly when you want a specific value
await db.update(chat).set({ projectId: null, updatedAt: new Date() })
  .where(and(inArray(chat.id, chatIds), eq(chat.userId, uid)))
  .returning({ id: chat.id });

// delete
const [deleted] = await db.delete(resource)
  .where(and(inArray(resource.id, ids), eq(resource.userId, uid)))
  .returning({ id: resource.id });
```

`$onUpdate` fires for every column NOT explicitly present in `.set()` — an explicit value always wins. So omitting `updatedAt` from the set object lets the hook fill it, and including it uses your value; set it explicitly when you want a specific timestamp.

## Transactions

```ts
const result = await db.transaction(async (tx) => {
  const [row] = await tx.delete(resource).where(whereOwner(resource, ids, uid)).returning({ id: resource.id });
  if (!row) throw new Error("Not Found");     // throw → rollback
  await tx.update(other).set({ field: null }).where(inArray(other.field, ids));
  return row;                                 // return value = transaction result
});
```

- `tx` has the full query API; the callback's return value is the transaction result.
- `tx.rollback()` throws a rollback error; nested `tx.transaction(...)` creates savepoints.
- Postgres config: `db.transaction(async (tx) => {...}, { isolationLevel: "serializable", accessMode: "read only", deferrable: true })`.

## Raw SQL — `sql`` operator

```ts
import { sql } from "drizzle-orm";

// inside a typed query (keeps row mapping): custom where/orderBy/select fragments
await db.select().from(message).where(sql`${message.metadata}->>'foo' = ${value}`);
await db.select({ lowerName: sql<string>`lower(${users.name})` }).from(users);
await db.select().from(users).orderBy(sql`${users.id} desc nulls first`);

// whole-statement raw query — results come back untyped as .rows (cast them):
const { rows } = await db.execute(sql`
  SELECT c.id, c.content FROM kb_chunk c
  WHERE c.kb_id = ${kbId} ORDER BY c.embedding <=> ${embedding}::vector LIMIT 20
`) as unknown as RawRow[];
```

- Interpolate values as `${value}` → parameterized. `sql.raw("...")` injects unescaped text — trusted constants only.
- `sql<T>` sets the TS type only (no runtime mapping); use `.mapWith(Number)` / `.mapWith(col)` for runtime transforms; `.as("alias")` names the column.
- Building dynamic SQL: `sql.fromList(chunks)` / `sql.join(chunks, sql.raw(" "))` / `sql.empty().append(...)`.

## Relational query API (`db.query`)

Enabled by passing `{ schema }` (and relations for `with:`) to `drizzle()`. Options-object API — no chaining.

```ts
await db.query.message.findMany({
  where: (fields, { eq, and }) => and(eq(fields.chatId, chatId), eq(fields.userId, uid)),
  orderBy: (t, { desc }) => [desc(t.createdAt)],
  limit: 50,
  columns: { id: true, content: true },          // subset (or { content: false })
  with: { chat: { columns: { id: true }, limit: 1 } },  // requires relations()
});

await db.query.user.findFirst({ where: { id: uid } });  // LIMIT 1, row | undefined
```

- `where` accepts a plain object (`{ id: 1 }`), operator map (`{ createdAt: { lt: new Date() } }`), `AND`/`OR`/`NOT` arrays, or a callback with operators.
- `orderBy` object form: `{ id: "asc" }`. `extras: { name: (t, { sql }) => sql`...` }` for computed fields (aggregations not supported in extras — use core queries).
- Inside callbacks, reference columns through the callback parameter, NOT the imported table object (aliasing requirement for nested/self-referential queries).
- Prepared statements: `.prepare("name")` + `.execute(params)` with `sql.placeholder("key")`.
- **`db.query` outputs exactly one SQL query** (lateral-join aggregation) — no N+1; the `with:` nesting replaces manual join chains.

## Which API to use

| Need                                                       | Use                            |
| ---------------------------------------------------------- | ------------------------------ |
| Full control, custom projections, raw joins                | `db.select()` builder          |
| Nested eager-loading of relations                          | `db.query` + `relations()`     |
| One-off typed expression the builder can't express         | `sql`` fragment inside a query |
| Whole statement out of the builder's reach (pgvector, FTS) | `db.execute(sql`...`)`         |
| Multi-statement atomic work                                | `db.transaction`               |

Official docs: [Select](https://orm.drizzle.team/docs/select) · [Insert](https://orm.drizzle.team/docs/insert) · [Operators](https://orm.drizzle.team/docs/operators) · [Transactions](https://orm.drizzle.team/docs/transactions) · [sql operator](https://orm.drizzle.team/docs/sql) · [Relational queries](https://orm.drizzle.team/docs/rqb)
