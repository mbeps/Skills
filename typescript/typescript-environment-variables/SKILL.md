---
name: typescript-environment-variables
description: Centralise, validate, and use environment variables in TypeScript projects with type safety and computed constants. Use for all TypeScript projects, including Next.js, Node.js, and framework-agnostic apps.
---

# Environment Variables in TypeScript

Centralised, validated environment configuration with type inference and computed constants.

## When to Use This Skill

- Setting up or refactoring environment variable handling in TypeScript projects
- Implementing type-safe configuration across Next.js, Node.js, or framework-agnostic apps
- Separating client-only and server-only configuration
- Creating derived constants from environment variables (byte limits, URLs, etc.)

## Core Pattern: Zod + Type Inference

Define all environment variables in a single `lib/env.ts` file using **Zod schemas** for validation. Parse and type-check on application startup.

### 1. Define Schemas (Separate Client & Server)

```typescript
import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1),
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: z.coerce.number().default(10),
});

const serverSchema = clientSchema.extend({
  DATABASE_URL: z.string().url(),
  API_SECRET_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]),
});
```

**Key Decisions:**
- Use `NEXT_PUBLIC_*` prefix for client-accessible variables.
- Keep secrets (API keys, database URLs) server-only.
- Use `.coerce` for numeric env vars (always strings at runtime).
- Use `.default()` for optional variables.

### 2. Runtime Parsing & Type Extraction

```typescript
const isServer = typeof window === "undefined";
const schema = isServer ? serverSchema : clientSchema;

const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  // ... all vars
});

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
// Type: exactly the parsed schema shape, fully typed
```

**Why `safeParse()`?**
- Returns `{ success: boolean; data?; error? }` instead of throwing
- Allows graceful error reporting during startup
- Fail fast—don't let invalid config slip into production

### 3. Computed Constants from Environment

Derive frequently-used constants from environment variables. Store them alongside `env`:

```typescript
export const FILE_LIMITS = {
  MAX_UPLOAD_BYTES: env.NEXT_PUBLIC_MAX_FILE_SIZE_MB * 1024 * 1024,
  MAX_SONG_BYTES: env.NEXT_PUBLIC_MAX_SONG_SIZE_MB * 1024 * 1024,
  STORAGE_QUOTA_BYTES: env.NEXT_PUBLIC_STORAGE_LIMIT_GB * 1024 * 1024 * 1024,
} as const;
```

**Benefits:**
- Avoid repeated conversions in business logic
- Single source of truth for limits
- Type-safe usage: `FILE_LIMITS.MAX_UPLOAD_BYTES` is a `number`

### 4. Usage in Code

```typescript
// Client & server code
import { env, FILE_LIMITS } from "@/lib/env";

// Type-safe access
const apiUrl = env.NEXT_PUBLIC_API_URL; // ✓ string

// Computed constants
if (fileSize > FILE_LIMITS.MAX_UPLOAD_BYTES) {
  throw new Error("File too large");
}
```

## Best Practices

### Centralisation
- **Single file:** `lib/env.ts` is the only place that reads `process.env`.
- No direct `process.env.VAR` elsewhere in codebase.
- Import `env` and `FILE_LIMITS` everywhere else.

### Validation Strictness
- Validate on startup, not per request.
- Use Zod's `.min()`, `.max()`, `.url()`, `.enum()` to enforce structure.
- Coerce types (`z.coerce.number()`) instead of trusting strings.

### Client vs. Server
- Prefix client variables with `NEXT_PUBLIC_*`.
- Server-only variables (secrets) have no prefix and are inaccessible in browsers.
- Use `typeof window === "undefined"` to detect runtime environment.

### Readability
- Group related variables:
  ```typescript
  const clientSchema = z.object({
    // API endpoints
    NEXT_PUBLIC_API_URL: z.string().url(),
    // Limits
    NEXT_PUBLIC_MAX_FILE_SIZE_MB: z.coerce.number(),
    // Feature flags
    NEXT_PUBLIC_ENABLE_BETA: z.coerce.boolean().default(false),
  });
  ```
- Document purpose above each variable if non-obvious.

## Common Patterns

### Feature Flags
```typescript
NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
```

### URL Configuration
```typescript
DATABASE_URL: z.string().url(),
REDIS_URL: z.string().url(),
```

### Byte Limits (as shown in env.ts)
```typescript
const FILE_LIMITS = {
  SONG_MAX_BYTES: env.NEXT_PUBLIC_MAX_SONG_SIZE_MB * 1024 * 1024,
  AVATAR_MAX_BYTES: env.NEXT_PUBLIC_MAX_AVATAR_SIZE_MB * 1024 * 1024,
} as const;
```

## Error Handling

**On startup, if validation fails:**
```
❌ Invalid environment variables: {
  DATABASE_URL: "Required"
  API_SECRET_KEY: "String must contain at least 1 character(s)"
}
```

Application **must fail immediately** — better to crash in CI/CD than silently run with broken config.

## Migration Path (Existing Projects)

1. Create `lib/env.ts` with current environment variables.
2. Run application; validation will list missing or invalid vars.
3. Fix `.env.local` / deployment config.
4. Replace all `process.env.VARNAME` with `env.VARNAME` imports (use find/replace with care).
5. Delete any inline env parsing logic.

## References

- **12-Factor Config:** Store all config in environment variables, separate from code.
- **Zod Type Inference:** `z.infer<typeof schema>` extracts static types directly from schemas.
- **Next.js Environment:** Prefix variables with `NEXT_PUBLIC_` to expose to browser.
