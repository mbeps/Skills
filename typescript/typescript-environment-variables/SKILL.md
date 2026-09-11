---
name: typescript-environment-variables
description: Use when setting up or refactoring environment variable handling in TypeScript, Next.js, or Node.js projects to centralise access, enforce schema validation with Zod, and separate client/server configuration.
---

# Environment Variables in TypeScript

Centralised, validated environment configuration with type inference, runtime separation, and computed constants.

## When to Use This Skill

- Centralising scattered `process.env` calls into a single source of truth
- Implementing type-safe configuration across Next.js (App/Pages Router), Node.js, or framework-agnostic apps
- Enforcing client (`NEXT_PUBLIC_*`) vs. server secret boundaries
- Ensuring fail-fast validation on application startup
- Setting up test-friendly environment validation that works in CI and JSDOM

## Core Pattern: Zod + Contextual Validation

Define all environment variables in `config/env.ts` (under `./config`) using **Zod schemas**. Wrap validation in an exported function for testability, and execute it immediately for startup validation.

### 1. Define Schemas & Validation Function

```typescript
import { z } from "zod";

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: z.coerce.number().default(10),
});

export const serverEnvSchema = clientEnvSchema.extend({
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = ServerEnv;

/**
 * Validates environment variables according to active runtime context.
 * Pass explicit process.env keys so Next.js bundlers can inline NEXT_PUBLIC_* variables.
 */
export function validateEnv(
  runtimeEnv: Record<string, unknown> = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_MAX_FILE_SIZE_MB: process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB,
    DATABASE_URL: process.env.DATABASE_URL,
    API_SECRET_KEY: process.env.API_SECRET_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
  isServerEnv: boolean = typeof window === "undefined",
): Env {
  const schema = isServerEnv ? serverEnvSchema : clientEnvSchema;
  const parsed = schema.safeParse(runtimeEnv);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.format());
    throw new Error("Invalid environment variables");
  }

  return parsed.data as Env;
}

export const env = validateEnv();
```

### 2. Computed Constants from Environment

Derive frequently-used constants from validated variables in the same file or a constants module:

```typescript
export const FILE_LIMITS = {
  MAX_UPLOAD_BYTES: env.NEXT_PUBLIC_MAX_FILE_SIZE_MB * 1024 * 1024,
} as const;
```

### 3. Usage in Code

```typescript
// Access typed variables and constants
import { env, FILE_LIMITS } from "@/config/env";

const apiUrl = env.NEXT_PUBLIC_API_URL; // string
```

For server routes or scripts where third-party SDKs read `process.env` implicitly (e.g. AWS SDK, EdgeStore):

```typescript
// Side-effect import ensures startup validation runs without linter pruning
import "@/config/env";
```

## Best Practices

### Centralisation
- **Single reader:** `config/env.ts` (under `./config`) is the only file that accesses `process.env`.
- **Explicit object mapping:** Never pass `process.env` wholesale (`schema.safeParse(process.env)`). Next.js Webpack/Turbopack only inlines client variables when referenced as exact literals (`process.env.NEXT_PUBLIC_*`).
- **Eliminate assertions:** Never use non-null assertions (`process.env.VAR!`). Use `env.VAR`.

### Client vs. Server Separation
- **Prefix convention:** Only `NEXT_PUBLIC_*` variables belong in `clientEnvSchema`.
- **Runtime detection:** `typeof window === "undefined"` prevents client bundles from failing on missing server secrets.
- **Type safety:** Cast `parsed.data as Env` so server consumers retain static typing for secrets without TypeScript union narrowing issues.

### Test Resilience (CI & JSDOM)
- **Startup mock defaults:** In test setup files (`setup.ts` or `setupFiles`), populate fallback dummy values on `process.env`:
  ```typescript
  process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.example.com";
  process.env.API_SECRET_KEY = process.env.API_SECRET_KEY || "mock_secret_key";
  ```
  This prevents CI test runners from crashing when uncommitted `.env.local` is absent.
- **Pure function testing:** Because `validateEnv(runtimeEnv, isServer)` accepts arguments, write unit tests for client validation, server validation, error throwing, and optional variables without mutating global state.

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| Placing `env.ts` in `lib/` or root | Inconsistent directory structure and discovery | Centralise in `./config/env.ts` |
| `safeParse(process.env)` | Client bundle has undefined `NEXT_PUBLIC_*` values | Map explicit keys: `{ KEY: process.env.KEY }` |
| Top-level validation only without export | Untestable in Vitest/Jest; fails coverage thresholds | Wrap in `validateEnv()` and export both function and `env` singleton |
| Missing fallback in test setup | CI tests crash on startup with "Invalid environment variables" | Add `process.env.VAR ||= "mock"` in test setup file |
| `import { env }` unused in SDK routes | Linter (Biome/ESLint) strips import; validation skipped | Use side-effect import `import "@/config/env";` |
| Inferred union type without `as Env` | Accessing server secrets in TS throws property missing errors | Type assertion `return parsed.data as Env;` |

## Migration Path

1. Audit existing `process.env` usage across codebase.
2. Create `config/env.ts` (under `./config`) with client and server Zod schemas and `validateEnv()`.
3. Add fallback defaults to test harness (`setup.ts`).
4. Replace direct `process.env` references with `env` imports from `@/config/env`.
5. Add unit tests for `validateEnv` covering client, server, and failure branches.
