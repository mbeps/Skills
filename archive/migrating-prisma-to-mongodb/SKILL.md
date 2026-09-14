---
name: migrating-prisma-to-mongodb
description: Use when migrating a TypeScript or Next.js codebase from Prisma ORM to MongoDB native driver or ODM, eliminating @prisma/client, replacing Prisma MongoDB queries with a type-safe repository pattern, or integrating Better Auth with @better-auth/mongo-adapter.
---

# Migrating Prisma to MongoDB

## Overview

This skill guides the complete migration from Prisma ORM to the native MongoDB Node.js driver and Better Auth MongoDB adapter. Core principle: **isolate database access behind a strongly typed repository layer while maintaining clean application domain models (`id: string`)**.

## When to Use

Use when:
- Upgrading to or preparing for Prisma v7 which ends MongoDB connector support.
- Removing `@prisma/client` and `prisma` dependencies from a Next.js / TypeScript project.
- Replacing Prisma queries with native MongoDB driver queries (`mongodb`).
- Migrating Better Auth from the Prisma adapter to `@better-auth/mongo-adapter`.
- Resolving MongoDB build warnings such as `Schema validation is not available for adapter "mongodb-adapter"`.
- Refactoring tests to mock native database repositories instead of Prisma client mocks.

**When NOT to use:**
- Relational SQL databases (PostgreSQL, MySQL, SQLite) using Prisma or Drizzle.
- Projects remaining on Prisma v6 with active Prisma MongoDB support.
- Mongoose ODM migrations where Mongoose schema models are preferred over native collections.

## Quick Reference

| Topic | Reference File | Key Focus |
|---|---|---|
| Domain Types & DAL | [dal-and-types.md](references/dal-and-types.md) | Domain interfaces vs `UserDoc`, `fromDoc`, `idFilter`, client singleton |
| Better Auth Adapter | [better-auth-adapter.md](references/better-auth-adapter.md) | `@better-auth/mongo-adapter`, PascalCase models, `validateSchema: false` |
| Query Translation | [query-translation.md](references/query-translation.md) | `findUnique`, `include` populations, array `$addToSet`/`$pull`, cascades |
| Testing & Mocking | [testing-and-mocking.md](references/testing-and-mocking.md) | Vitest `vi.hoisted()` pattern, mocking repositories, client test doubles |

## Core Conventions

- **Domain Model Isolation**: Keep app-level models clean with `id: string`. Confine `_id: ObjectId | string` to DAL document types (`*Doc`).
- **Connection Pooling**: Cache `MongoClient` on `globalThis._mongoClient` in non-production environments to avoid exhausting connections during Next.js hot reloads.
- **Bi-directional ID Translation**: Use `idFilter(id)` for dual `ObjectId` and `string` lookups, and `fromDoc(doc)` to normalize query outputs to `id: string`.
- **Better Auth Build Configuration**: Always set `advanced.database.validateSchema: false` in `betterAuth({...})` to avoid repetitive schema validation warnings during Next.js build page collection.
- **Transactions**: Default `transaction: true` requires a MongoDB replica set. Set `transaction: false` if using standalone MongoDB instances.
- **Mock Hoisting in Vitest**: Always wrap repository mocks in `vi.hoisted()` before `vi.mock()` to avoid `ReferenceError: Cannot access before initialization`.

## Migration Workflow

1. **Install & Purge Dependencies**:
   Install `mongodb` and `@better-auth/mongo-adapter`. Remove `prisma`, `@prisma/client`, and `prisma generate` scripts from `package.json`.
2. **Define Domain & Document Types**:
   Create types in `types/db/` replicating Prisma models into plain TypeScript interfaces.
3. **Set Up Client & Utility Layer**:
   Create `utils/db/client.ts` with cached `MongoClient`, `db`, `fromDoc`, `idFilter`, and typed collection accessors.
4. **Implement Data Access Repositories**:
   Create `db/repositories/` implementing domain CRUD, relational population, and manual cascade cleanups.
5. **Configure Better Auth**:
   Update `lib/auth.ts` with `mongodbAdapter(db, { client: mongoClient, usePlural: false })` and `validateSchema: false`.
6. **Update Actions & Endpoints**:
   Replace `prisma.*` calls in server actions and API route handlers with repository calls.
7. **Migrate Tests**:
   Update test suites to mock repositories using `vi.hoisted()`. Verify 100% coverage.

## Common Mistakes

- **Directly exposing `_id` to UI components**: Breaks client components expecting `id: string`. Always run results through `fromDoc()`.
- **Missing `validateSchema: false`**: Causes Better Auth to emit repetitive schema validation debug notices during `next build`.
- **Calling `vi.mock` with un-hoisted variables**: Triggers Vitest hoisting errors. Always define mock repositories inside `vi.hoisted()`.
- **Assuming cascade deletes happen automatically**: MongoDB native driver does not enforce schema-level cascading. Write explicit delete helpers in repositories.
- **Naming global cache variable same as export**: `var mongoClient` in `declare global` conflicts with `export const mongoClient`. Use `var _mongoClient`.

Official Documentation: [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/) · [Better Auth Mongo Adapter](https://better-auth.com/docs)

