---
name: typeorm-nextjs
description: Use when building, modifying, or debugging a TypeORM setup in a Next.js App Router TypeScript app — DataSource singleton, entity modeling, Server Actions vs Server Components dual-import isolation, Webpack/Turbopack bundling configs, transactions, migrations, seeding, or Vitest mock repositories.
---

# TypeORM + Next.js App Router (TypeScript, SQL & MongoDB)

## Overview

TypeORM is a Data Mapper / Active Record ORM supporting relational databases (PostgreSQL, MySQL, SQLite, Oracle) and document databases (MongoDB). In Next.js App Router applications, running TypeORM requires careful configuration of TypeScript decorator metadata, Webpack bundling externals, connection singletons with race condition protection, and strict separation between Server Component direct queries and Client Component Server Actions.

## When to Use

Use when:
- Configuring or maintaining a TypeORM `DataSource` in Next.js App Router.
- Defining entity schemas using TypeScript decorators (`@Entity`, `@Column`, `@ObjectIdColumn`, relations).
- Implementing data queries with TypeORM Repositories, `MongoRepository`, or `QueryBuilder`.
- Designing transaction logic via `dataSource.transaction()`.
- Managing database migrations or implementing idempotent automated seeding.
- Resolving Next.js bundling issues: `reflect-metadata` errors, Webpack dynamic require warnings, Server Action ID mismatch errors, or HMR connection exhaustion.
- Writing Vitest/Jest unit and integration tests mocking TypeORM DataSources and Repositories.

**When NOT to use:**
- Prisma-based projects (see `prisma-nextjs` skill).
- Drizzle-based projects (see `drizzle-nextjs` skill).
- Edge runtime routes (TypeORM requires Node.js runtime APIs like `net`, `tls`, `crypto`, `events`).

## Quick Reference

| Topic | File | First Thing to Read |
|---|---|---|
| Dependencies, `next.config.ts`, `data-source.ts`, `instrumentation.ts` | [setup.md](setup.md) | "DataSource Singleton & Thundering Herd Protection" |
| Decorators, Relational vs MongoDB, Strict Types, DTOs | [entities.md](entities.md) | "Entity Decorator & Reflection Pattern" |
| Dual-Import Pattern, Repositories, MongoDB Queries, Transactions, DTO Mapping | [queries.md](queries.md) | "Dual-Import Isolation Pattern" |
| Migrations, `synchronize`, Idempotent Seeding | [migrations-and-seeding.md](migrations-and-seeding.md) | "Idempotent Seeding Architecture" |
| Vitest Mock DataSource, Repository Mocks, Transaction Testing | [testing.md](testing.md) | "Mocking TypeORM in Vitest" |

## Core Conventions

1. **Singleton DataSource (`database/data-source.ts`)**: Maintain a single `DataSource` instance with an initialization promise lock (`dataSourceInitializationPromise`) to prevent connection leaks during Hot Module Replacement (HMR) and avoid race conditions under concurrent requests.
2. **Explicit Entity List**: Always pass an explicit array of entity classes `entities: [User, Post]` to `DataSourceOptions`. Never use glob strings (e.g. `"entities/*.entity.ts"`) because Next.js bundlers (Webpack/Turbopack) split code into chunks and strip file system paths at runtime.
3. **Metadata Reflection**: Always import `"reflect-metadata"` at the very top of entity files and the `data-source.ts` entry point before any decorator is evaluated.
4. **Node.js Runtime Only**: Ensure database operations only execute in Node.js runtime environments (`process.env.NEXT_RUNTIME === "nodejs"`). Never import or execute TypeORM in Edge Route Handlers or `middleware.ts`.
5. **Dual-Import Isolation Pattern**:
   - **Server Components** read data via direct query functions (`lib/queries/*.ts`) without the `'use server'` directive.
   - **Client Components** mutate data or fetch on demand via Server Actions (`actions/**/*.ts`) marked with `'use server'`.
   - Never import a `'use server'` action into a Server Component if it is also imported by Client Components — this prevents Webpack action ID hash mismatches ("Failed to find Server Action").
6. **DTO Boundary Serialization**: Always serialize entities into plain JavaScript objects (convert `ObjectId` to `string`, `Date` to ISO string) before returning data across the React Server Component / Client Component boundary.

## Common Mistakes & Traps

| Anti-Pattern / Mistake | Symptom / Failure | Correct Pattern |
|---|---|---|
| Using glob paths: `entities: ["dist/entities/*.js"]` | `EntityMetadataNotFoundError: No metadata for "..." was found` | Import entity classes explicitly: `entities: [Application, User]` |
| Missing `reflect-metadata` import | TypeORM cannot infer column types; silently fails or throws runtime decorator errors | Import `"reflect-metadata"` at top of `data-source.ts` and entity files |
| Multiple calls to `dataSource.initialize()` on concurrent requests | `Cannot initialize DataSource because it is already initializing` | Use initialization promise mutex in `getDataSource()` |
| Re-instantiating `new DataSource()` on every request | Database connection pool exhaustion under dev HMR / traffic spikes | Cache `dataSourceInstance` in module/global scope |
| Importing `'use server'` actions directly in Server Components | `Failed to find Server Action. This is often caused by a mismatched build ID` | Use direct query functions (`lib/queries/*.ts`) for Server Components |
| Running database sync/seeding during `next build` | Build fails if DB container/server is unreachable during static pre-rendering | Check `process.env.NEXT_PHASE !== "phase-production-build"` before connecting |
| Returning raw TypeORM entities (`ObjectId`, methods) to Client Components | Client hydration errors; React cannot serialize complex prototypes | Map entities to plain DTOs (e.g. `toApplicationData(entity)`) |

