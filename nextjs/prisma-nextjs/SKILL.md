---
name: prisma-nextjs
description: Use when building, modifying, or debugging a Prisma ORM setup in a Next.js App Router TypeScript app — schema definition, prisma.config.ts, Prisma Client queries, transactions, driver adapters (Prisma 6 or 7), or migrations.
---

# Prisma ORM + Next.js (TypeScript, PostgreSQL)

## Overview

Type-safe, schema-first ORM. `prisma/schema.prisma` is the single source of truth for models, and Prisma Client is generated from it. This skill covers both Prisma 6 (classic) and Prisma 7 (new architecture) — version differences are the #1 source of errors, so check `## Version Matters` first.

## When to Use

- Building or modifying a Prisma schema (models, enums, relations, indexes)
- Writing Prisma Client queries, nested writes, or transactions
- Running migrations or syncing schema with `db push`
- Debugging P2002/P2025 errors, "PrismaClient is unable to run in this browser environment", or connection pool exhaustion

When NOT:

- Full raw SQL control (use the `pg` driver directly)
- BaaS products (see the supabase-nextjs skill)
- MongoDB (no Prisma 7 support)
- Project uses Drizzle (see the drizzle-nextjs skill)

## Version Matters

| | Prisma 6 (classic) | Prisma 7 (new) |
|---|---|---|
| generator | `prisma-client-js` | `prisma-client` + required `output` |
| datasource url | `url = env("DATABASE_URL")` in schema | no url in schema; set in `prisma.config.ts` |
| config file | none | `prisma.config.ts` required |
| client import | `@prisma/client` | `<output>/client (e.g. @/lib/generated/prisma/client)` |
| driver adapter | not required | required (`@prisma/adapter-pg` + `PrismaPg`) |
| .env loading | auto by CLI | none — `import "dotenv/config"` |
| migrate dev auto-generate | yes | no — run `prisma generate` explicitly |
| ESM requirement | no | yes (`"type": "module"`, Node 20.19+, TS 5.4+) |

## Quick Reference

| Topic | File | First thing to read |
|---|---|---|
| Install, config, client singleton, scripts | `setup.md` | "Install" or "db client" |
| Models, enums, Json, indexes, relations | `schema.md` | "Model conventions" |
| Queries, transactions, ownership scoping, errors | `queries.md` | "Ownership scoping" |
| Migrations, db push, baselining, deploy | `migrations.md` | "The workflow" |

## Core Conventions

- Singleton client in `lib/db.ts`, imported everywhere — never `new PrismaClient()` per request
- Server-only, Node runtime: Server Components, Server Actions, Route Handlers — never `middleware.ts` (Edge runtime) or client components; `import "server-only"`
- Scope every query to the current user (see `queries.md`)
- Prefer migrations over `db push`

## Common Mistakes

1. Missing globalThis singleton → connection pool exhaustion under dev HMR
2. Prisma 6 pattern used on Prisma 7 (no driver adapter, no `prisma.config.ts`) → runtime errors
3. Un-scoped `findUnique` on user data → tenant data leak
4. Forgetting `prisma generate` after a schema change (v7 especially) → stale types
5. `db push` or `migrate reset` on production → data loss
6. Using Prisma Client in `middleware.ts` → Edge runtime error; do DB-backed auth checks in Server Actions/Route Handlers — only import generated types (`browser.ts`/`enums.ts`) on the client

## Official docs

- https://www.prisma.io/docs/orm
- Full docs in llms.txt: https://www.prisma.io/docs/llms.txt
