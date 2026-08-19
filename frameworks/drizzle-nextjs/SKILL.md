---
name: drizzle-nextjs
description: Use when building, modifying, or debugging a Drizzle ORM setup in a Next.js App Router TypeScript app — schema definition, queries, drizzle-kit migrations, transactions, relations, or drizzle.config.ts.
---

# Drizzle ORM + Next.js (TypeScript, PostgreSQL)

## Overview

This skill covers Drizzle ORM (drizzle-orm + drizzle-kit) in Next.js App Router projects with PostgreSQL. Core principle: **the TypeScript schema is the source of truth**; queries are SQL-like and type-safe; migrations are code-first via `drizzle-kit`. Drizzle is dialect-specific — everything here targets the Postgres dialect (`drizzle-orm/pg-core`).

## When to Use

Use when:
- Defining or editing tables, columns, enums, indexes, or constraints in `drizzle/schemas/*`.
- Writing queries: select/insert/update/delete, joins, aggregations, `.returning()`.
- Running or debugging `drizzle-kit` (generate, migrate, push, studio) or `drizzle.config.ts`.
- Writing transactions, upserts, raw SQL via the `sql`` operator, or the `db.query` relational API.
- Setting up the DB client (`drizzle/db.ts`), env validation for `DATABASE_URL`, or package scripts.
- Debugging Drizzle errors: type mismatches on `count()`, generated columns lost by `db:push`, journal/snapshot drift, `$onUpdate` not firing on `.set()`.

**When NOT to use:** non-Postgres dialects (MySQL/SQLite/Turso) unless noted; ORM-agnostic Next.js work; auth-layer specifics (see the auth skill for your auth library — Drizzle only provides the adapter table definitions).

## Quick Reference

| Topic | File | First thing to read |
|---|---|---|
| Install, config, db client, env, scripts | `setup.md` | `drizzle.config.ts` + `drizzle/db.ts` patterns |
| Tables, columns, enums, indexes, relations | `schema.md` | PK/timestamp conventions + index syntax |
| Queries, operators, joins, transactions | `queries.md` | Ownership-scoped select pattern + `count()` typing |
| drizzle-kit migrations & gotchas | `migrations.md` | generate → review → migrate workflow |
| Conventions (Next.js-safe patterns) | `setup.md` | Env validation + server-only boundary |

## Core Conventions

- Schema lives in `drizzle/schemas/*.ts` (one file per domain), barrel-exported from `drizzle/schema.ts`; `drizzle/db.ts` does `import * as schema` so new tables are picked up automatically.
- `drizzle(url, { schema })` with **node-postgres** (`drizzle-orm/node-postgres`); a single module-level `db` is the App Router pattern — node-postgres pools internally.
- App-table PKs are usually `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())`; some tables use a plain `text("id").primaryKey()` with IDs supplied by app code. Auth-table PKs rely on the auth library's own ID generation (no `$defaultFn`).
- Timestamps: `createdAt` = `timestamp("created_at").notNull().defaultNow()`; `updatedAt` = same + `.$onUpdate(() => new Date())`.
- `$onUpdate` fires only for columns not explicitly set in `update().set({...})` — an explicit value wins. Set `updatedAt` manually when you want a specific timestamp.
- Every query is ownership-scoped: `and(eq(table.userId, userId), ...)` from the session; inserts use `.returning()`.
- **Enum strategy:** `text("col").$type<"a" | "b">()` (no `pgEnum`) unless you need DB-level enum type; `pgEnum` creates a real `CREATE TYPE`.
- Migration workflow: `npm run db:generate` → **review the generated SQL** → rename file + journal tag descriptively → `npm run db:migrate`. Avoid `db:push` for schema evolution (diffs live DB, can destroy generated columns).
- `$onUpdate` and `$defaultFn` are **runtime-only** in drizzle-orm — they don't affect drizzle-kit output. (See the `$onUpdate` firing rule above.)

## Common Mistakes

- Forgetting `{ schema }` in `drizzle()` when using `db.query.*` — the relational API is only generated when schema is passed.
- Using `db.query.<table>.findMany({ with: ... })` without declaring `relations()` and including them in the schema object — fails at runtime ("Table ... not found in schema" / "not enough information to infer relation").
- Expecting `count()` to return a string — it internally `.mapWith(Number)`s; raw `sql\`count(*)\`` subqueries do NOT, add `.mapWith(Number)`.
- Editing the generated `.sql` migration without touching the snapshot → next `generate` drifts; hand-edit SQL *after* generate and keep file + journal tag in sync.
- `db:push` on a schema with `GENERATED ALWAYS AS` columns / extension columns (e.g. pgvector) — it converts them to regular columns; prefer generate + migrate.
- Raw string interpolation in `sql\`\`` templates — always interpolate values as `${value}` (parameterized, injection-safe) or `sql.raw()` only for trusted constants.
- Swallowing Postgres error codes — check `err.code` (`23505` unique violation, `23503` FK violation) on insert/update instead of returning generic messages.

Official docs: [Drizzle overview](https://orm.drizzle.team/docs/overview) · [Get started PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) · [Schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration) · [Select](https://orm.drizzle.team/docs/select) · [Relational queries](https://orm.drizzle.team/docs/rqb) · [sql operator](https://orm.drizzle.team/docs/sql) · [Transactions](https://orm.drizzle.team/docs/transactions) · [Migrations](https://orm.drizzle.team/docs/migrations) · [drizzle-kit push](https://orm.drizzle.team/docs/drizzle-kit-push) · [Column types (pg)](https://orm.drizzle.team/docs/column-types/pg) · [Indexes & constraints](https://orm.drizzle.team/docs/indexes-constraints) · [Custom types](https://orm.drizzle.team/docs/custom-types)
