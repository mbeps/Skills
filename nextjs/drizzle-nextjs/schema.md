# Schema: tables, columns, enums, indexes, relations

All imports from `drizzle-orm/pg-core`. Column TS keys are used as DB names unless aliased: `text("user_id")` aliases `userId` → `user_id` in SQL (the common snake_case convention).

## Table definition & organization

```ts
// drizzle/schemas/chat-schema.ts
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id").notNull().references(() => chat.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant" | "system">().notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("message_chat_id_idx").on(table.chatId)],
);
```

- **Organization:** one file per domain in `drizzle/schemas/`, barrel-exported from `drizzle/schema.ts` (`export * from "./schemas/chat-schema"`). New tables need only the barrel line — `db.ts` picks them up automatically.
- Table-level extras (indexes, constraints) go in the third-argument callback `(table) => [...]`. Column-level `.unique()`, `.check()` etc. work inline.
- Reusable column groups: spread a shared object (e.g. `const timestamps = { createdAt: ..., updatedAt: ... }`) into multiple tables.
- Casing option: pass `casing: "snake_case"` to `drizzle(url, { schema, casing: "snake_case" })` to map camelCase TS keys to snake_case DB columns automatically. (There is no `snakeCase.table()` builder in 0.45.x.)

## Primary keys

| Style                  | Code                                                                                | Use when                                             |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| UUID text (app tables) | `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())`                     | Default; IDs generated in app code, no DB round-trip |
| UUID (DB-generated)    | `uuid("id").primaryKey().defaultRandom()`                                           | Prefer DB-side `gen_random_uuid()`                   |
| Auto-increment         | `serial("id").primaryKey()` or `integer().primaryKey().generatedAlwaysAsIdentity()` | Legacy/simple integer keys                           |
| Composite              | `primaryKey({ columns: [table.a, table.b] })` in the callback                       | Join tables (prevents duplicate links)               |

`$defaultFn(() => ...)` is runtime-only — drizzle fills the value on insert; drizzle-kit ignores it (no `DEFAULT` in SQL). `$inferSelect` / `$inferInsert` give row types: `type Row = InferSelectModel<typeof table>`. `drizzle-zod` can derive validation schemas: `createInsertSchema(table)` / `createSelectSchema(table)` — handy when server actions validate with zod.

## Timestamps

```ts
createdAt: timestamp("created_at").defaultNow().notNull(),
updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
```

- `defaultNow()` = DB `DEFAULT now()`. `$onUpdate(() => new Date())` is **runtime-only** and fires only when the column isn't explicitly set — `.set()` in an update bypasses it, so set `updatedAt` manually in `update().set({...})` calls.
- Default `timestamp()` maps to `timestamp without time zone`, JS `Date`. `timestamp({ mode: "string" })` passes raw strings. `withTimezone: true` for `timestamptz` (stored UTC).

## Enums

| Strategy                                | Code                                                                   | SQL effect                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pgEnum` (real DB enum)                 | `const roleEnum = pgEnum("role", ["user", "admin"]); role: roleEnum()` | `CREATE TYPE role AS ENUM (...)`; migrations for new values are `ALTER TYPE ... ADD VALUE` |
| `text` + `$type<>` (project convention) | `role: text("role").$type<"user"                                       | "assistant"                                                                                | "system">()` | Plain `text` column; union enforced by TS only (no DB constraint) |
| `text` + `{ enum }`                     | `text("name", { enum: ["a", "b"] })`                                   | Plain `text`, union inferred in types, no runtime check                                    |

Prefer `$type<>` over `pgEnum` unless you need DB-level integrity (constraints, indexes on the enum type) — adding `pgEnum` values later requires `ALTER TYPE ... ADD VALUE` migrations.

## JSON / arrays / custom types

```ts
metadata: jsonb("metadata").$type<{ foo: string }>(),        // jsonb, typed at compile time only
tools: text("tools").array().default(sql`'{}'::text[]`),      // text[] with SQL default
```

Custom types for anything the driver/columns don't model (pgvector, tsvector, geometry):

```ts
const vectorType = customType<{ data: number[] | null; driverData: string }>({
  dataType() { return "vector"; },
  toDriver(value) { return value ? `[${value.join(",")}]` : "[]"; },
  fromDriver(value) { return value ? value.slice(1, -1).split(",").map(Number) : []; },
});
// usage: embedding: vectorType("embedding"),
```

`customType<{ data; driverData }>` — `dataType()` returns the SQL type string; `toDriver`/`fromDriver` transform on write/read. For numeric coercion prefer the built-in column `mode` options (`bigint("x", { mode: "number" })`, `numeric(..., { mode: "number" })`) over a custom type.

## Indexes & constraints

```ts
(t) => [
  index("chat_user_id_idx").on(t.userId),
  uniqueIndex("ai_provider_user_id_name_idx").on(t.userId, t.name),   // composite unique
  index("kb_chunk_search_vector_idx").using("gin", t.searchVector),   // gin index (FTS/vector)
  index("lower_name_idx").on(sql`lower(${t.name})`),                  // expression index
  unique("user_id_name").on(t.userId, t.name),                        // UNIQUE constraint (vs index)
  check("ai_model_type_check", sql`${t.modelType} in ('chat','embedding')`),
]
```

- `index(name).on(cols)` / `uniqueIndex(name).on(cols)` — standard. Extra params: `.using("gin"|"btree", ...)`, `.where(sql`...`)` (partial), `.concurrently()`, `.with({ fillfactor })`, column modifiers `.asc()/.desc()/.nullsFirst()`.
- **Index every FK column** you filter/join on (`index("chat_user_id_idx").on(t.userId)`).
- Unique constraint vs unique index: constraints are managed with `ALTER TABLE ... DROP CONSTRAINT`; both prevent duplicates.

## Foreign keys

```ts
chatId: text("chat_id").notNull().references(() => chat.id, { onDelete: "cascade" }),
// composite FK via operator:
foreignKey({ columns: [t.userId, t.projectId], foreignColumns: [user.id, project.id] }),
```

`onDelete` options: `"cascade" | "restrict" | "no action" | "set null" | "set default"`. Self-referential FK: use `foreignKey({ columns: [t.parentId], foreignColumns: [t.id] })` or type the callback `() => AnyPgColumn => t.id`. Cascades make `db.transaction` multi-table deletes unnecessary for cleanup.

## Relations (for `db.query.*`)

`db.query.<table>.findMany({ with: { ... } })` requires relations declared and included in the schema object passed to `drizzle()` — e.g. barrel-export the relations from `schema.ts` alongside the tables; drizzle auto-detects them. (There is no `relations` config key — `DrizzleConfig` only takes `schema`, `logger`, `casing`, `cache`.)

```ts
// drizzle/schemas/relations.ts
import { relations } from "drizzle-orm";

export const userRelations = relations(user, ({ many }) => ({
  chats: many(chat),
}));
export const chatRelations = relations(chat, ({ one }) => ({
  user: one(user, { fields: [chat.userId], references: [user.id] }),
}));
```

- `one()` for to-one (FK side), `many()` for to-many (referenced side). Both sides must be declared for `with:` to work both ways.
- Filtering/sorting/limiting nested relations: `with: { chats: { where: ..., limit: 5, orderBy: ... } }`.
- If a project uses explicit `leftJoin` everywhere and declares no relations, `db.query` is still available for flat queries but `with:` will throw "relation not found" — match the project's style.

Official docs: [Schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration) · [Column types (pg)](https://orm.drizzle.team/docs/column-types/pg) · [Indexes & constraints](https://orm.drizzle.team/docs/indexes-constraints) · [Relations](https://orm.drizzle.team/docs/relations-schema-declaration) · [Custom types](https://orm.drizzle.team/docs/custom-types)
