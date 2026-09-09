# Environment Configuration & Test Suite Integration

This guide explains how to control log verbosity via environment variables and ensure smooth integration with test runners like Vitest and Jest.

---

## 1. Environment Variable Control (`LOG_LEVEL`)

Log verbosity is governed by the standard `LOG_LEVEL` environment variable. Never invent custom proprietary flags (e.g. `NEXT_PUBLIC_DEBUG_MUTATIONS=true`).

### Supported Levels

LogTape recognizes standard hierarchical log levels:
`debug` < `info` < `warning` < `error` < `fatal`

| Level   | Intended Usage                                                                                 |
| ------- | ---------------------------------------------------------------------------------------------- |
| `debug` | Verbose telemetry: queries, middleware path matching, internal steps.                          |
| `info`  | Default production level: user actions, mutations, successful uploads.                         |
| `warn`  | Recoverable or anticipated issues: validation failures, unauthorized requests, quota warnings. |
| `error` | Unhandled exceptions, database query failures, storage crashes.                                |
| `fatal` | Unrecoverable crashes or service shutdown states.                                              |

### Zod Schema Validation (`lib/env.ts`)

Standard environment conventions use `warn`, while LogTape internally uses `warning`. Use Zod transforms to support both seamlessly:

```typescript
// lib/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "warning", "error", "fatal"])
      .default("info")
      .transform((val) => (val === "warn" ? "warning" : val)),
  },
  client: {},
  experimental__runtimeEnv: {},
});
```

### Local & Production Usage

- **Default (Production & Staging)**: Leave unset or set `LOG_LEVEL=info`. Only important lifecycle actions and errors appear in terminal/cloud logs.
- **Deep Debugging**: Run with `LOG_LEVEL=debug` locally or in staging to inspect database query traces and middleware session synchronization.

---

## 2. Test Runner Integration (Vitest / Jest)

### The Non-Blocking Worker Problem
In modern test runners (Vitest, Jest), tests execute inside short-lived worker threads or `jsdom` environments. If console logging is configured with a non-blocking asynchronous buffer, test processes will either:
1. Terminate before background buffers flush, losing test assertions.
2. Trigger "Worker exited before response" or asynchronous timer leaks.

### The Solution: Environment-Aware Sink
In `lib/logger.ts`:
```typescript
const isTest =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST));

export function configureLoggingSync(): void {
  configureSync({
    sinks: {
      console: getConsoleSink({
        formatter: consoleFormatter,
        // Synchronous in tests to prevent teardown races; non-blocking in production
        nonBlocking: !isTest,
      }),
    },
    // ...
  });
}
```

### Mocking Loggers in Unit Tests

When testing server actions or utilities where log assertions are needed or console output should be muted:

```typescript
import { vi } from "vitest";

// Optional: Mock the logger module if you want to assert on log calls
vi.mock("@/lib/logger", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };

  return {
    getLogger: vi.fn(() => mockLogger),
    configureLoggingSync: vi.fn(),
    configureLogging: vi.fn(),
  };
});
```

---

## 3. Next.js Instrumentation Hook (Optional)

In Next.js 15+, you can optionally register LogTape during the server initialization phase using `instrumentation.ts` in the root of your project:

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureLoggingSync } = await import("@/lib/logger");
    configureLoggingSync();
  }
}
```

> [!NOTE]
> Even without `instrumentation.ts`, the `getLogger()` wrapper in `lib/logger.ts` self-initializes synchronously on first access, guaranteeing logs are never dropped.

