# Better Auth MongoDB Adapter Reference

This guide covers migrating Better Auth from the Prisma adapter to `@better-auth/mongo-adapter`.

---

## 1. Installation

```bash
npm install @better-auth/mongo-adapter mongodb
npm uninstall @prisma/client prisma
```

---

## 2. Configuration (`lib/auth.ts`)

Connect Better Auth to the native MongoDB instance and reuse the shared `MongoClient`.

```typescript
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { env } from "@/config/env";
import { db, mongoClient } from "@/utils/db/client";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: mongodbAdapter(db, {
    client: mongoClient,
    usePlural: false, // Preserves singular collection names
    transaction: true, // Requires a replica set; set false for standalone servers
  }),
  user: {
    modelName: "User", // Match existing collection name
    deleteUser: {
      enabled: true,
    },
  },
  session: {
    modelName: "Session",
    cookieCache: {
      enabled: false,
    },
  },
  account: {
    modelName: "Account",
  },
  verification: {
    modelName: "Verification",
  },
  advanced: {
    database: {
      generateId: false,
      joins: true,
      validateSchema: false, // Critical: silences build warning for schemaless MongoDB
    },
  },
});
```

---

## 3. Resolving the "Schema validation is not available" Warning

### The Symptom
During `next build` (specifically during worker page data collection), the console logs:
```text
Schema validation is not available for adapter "mongodb-adapter". Skipping schema validation. Database operations will proceed normally.
```

### Root Cause
Better Auth includes a schema validation check on initialization:
```javascript
// better-auth/dist/auth/base.mjs
const validateSchema = ctx.options.advanced?.database?.validateSchema;
if (!ctx.checkSchema && validateSchema !== false) {
    const level = validateSchema === true ? "warn" : "debug";
    ctx.logger[level](`Schema validation is not available for adapter "${ctx.adapter.id}". Skipping schema validation...`);
}
```
Because MongoDB is a schemaless document store, `@better-auth/mongo-adapter` does not provide a `checkSchema` implementation. When `validateSchema` is omitted (undefined), `validateSchema !== false` evaluates to `true`. If `logger.level` is set to `"debug"`, the message is routed to `console.log` on every worker process.

### The Fix
Set `validateSchema: false` inside `advanced.database`:
```typescript
advanced: {
  database: {
    generateId: false,
    joins: true,
    validateSchema: false,
  },
},
```
This informs Better Auth that runtime schema validation is explicitly disabled, cleanly suppressing the logs with zero side effects.

---

## 4. Transaction Requirements

The MongoDB Node.js driver only supports multi-document transactions when running against a **replica set** (e.g. MongoDB Atlas or a local replica set such as `rs0`).

- If your local or production database is a single standalone instance without replica set replication, you **must** set:
  ```typescript
  database: mongodbAdapter(db, {
    client: mongoClient,
    transaction: false,
  })
  ```
- If using Docker locally, run a replica set container (or an initialization script that executes `rs.initiate()`).

