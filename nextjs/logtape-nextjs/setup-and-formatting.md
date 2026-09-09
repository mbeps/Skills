# LogTape Setup & Console Formatting

This guide provides the complete setup for LogTape in a Next.js (App Router, TypeScript) application, featuring aligned terminal columns, colored log levels, category padding, dimmed delimiters, and non-blocking console sinks.

---

## 1. Visual Target

The output layout enforces strict column widths across all log levels and categories:

```text
18:49:17.266  DEBUG    app·middleware            │  Refreshing Supabase session for '/songs'
18:49:17.267  DEBUG    app·middleware            │  Session correctly synced for '/songs'
18:49:17.268  DEBUG    app·actions·song          │  Fetching all songs
18:49:17.269  INFO     app·actions·song          │  Song created successfully (id: "song_abc123")
18:49:17.270  WARNING  app·storage               │  Storage approaching quota limit (85% used)
18:49:17.271  ERROR    app·actions·song          │  Failed to delete song: database constraint error
```

### Column Specifications

| Column          | Width                                                           | Alignment | Details                                                           |
| --------------- | --------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| **Timestamp**   | 12 chars (`HH:mm:ss.SSS`)                                       | Left      | Styled as dimmed ANSI text                                        |
| **Separator 1** | 2 spaces                                                        | Fixed     | `  `                                                              |
| **Level**       | 7 chars (`DEBUG  `, `INFO   `, `WARNING`, `ERROR  `, `FATAL  `) | Left      | Full names with dynamic space padding to 7 characters             |
| **Separator 2** | 2 spaces                                                        | Fixed     | `  `                                                              |
| **Category**    | 24 chars (e.g. `app·actions·song       `)                       | Left      | Subcategories joined by middle dot (`·`), padded to 24 characters |
| **Delimiter**   | 5 chars (`  │  `)                                               | Fixed     | Dimmed vertical bar with 2 spaces on each side                    |
| **Message**     | Fluid                                                           | Left      | Message string and optional contextual properties                 |

---

## 2. Complete Logger Implementation (`lib/logger.ts`)

Create or update `lib/logger.ts`:

```typescript
import {
  configureSync,
  getAnsiColorFormatter,
  getConsoleSink,
  getLogger as getLogTapeLogger,
  type LogLevel,
} from "@logtape/logtape";
import { env } from "@/lib/env";

let initialized = false;

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * ANSI console formatter with aligned columns, generous spacing, and subtle delimiters.
 */
const consoleFormatter = getAnsiColorFormatter({
  timestamp: "time",
  level: "FULL",
  categoryStyle: "dim",
  timestampStyle: "dim",
  format({ timestamp, level, category, message, record }) {
    // 1. Join category parts with a middle dot and pad to 24 characters
    const rawCategory = record.category.join("·");
    const padLength = Math.max(0, 24 - rawCategory.length);
    const paddedCategory = category + " ".repeat(padLength);

    // 2. Pad level string to 7 characters (longest is "WARNING")
    // Use record.level (unformatted string) to calculate padding, ignoring ANSI escape sequences
    const levelStr = record.level.toUpperCase();
    const levelPad = " ".repeat(Math.max(0, 7 - levelStr.length));

    // 3. Assemble aligned row
    return `${timestamp}  ${level}${levelPad}  ${paddedCategory}  ${DIM}│${RESET}  ${message}`;
  },
});

/**
 * Synchronously configures the LogTape logging system with non-blocking console sink.
 */
export function configureLoggingSync(): void {
  if (initialized) return;

  const isTest =
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST));

  try {
    configureSync({
      sinks: {
        console: getConsoleSink({
          formatter: consoleFormatter,
          // Non-blocking in runtime to never stall requests; synchronous in tests to avoid runner teardown races
          nonBlocking: !isTest,
        }),
      },
      loggers: [
        // Silence LogTape internal meta logger diagnostic notice
        {
          category: ["logtape", "meta"],
          lowestLevel: "warning",
          sinks: ["console"],
        },
        // Root application logger
        {
          category: ["app"],
          lowestLevel: (env.LOG_LEVEL || "info") as LogLevel,
          sinks: ["console"],
        },
      ],
    });
    initialized = true;
  } catch {
    initialized = true;
  }
}

/**
 * Async entry point for application startup (optional instrumentation hook).
 */
export async function configureLogging(): Promise<void> {
  configureLoggingSync();
}

/**
 * Export getLogger from LogTape, guaranteeing the logging system is configured.
 */
export function getLogger(
  ...args: Parameters<typeof getLogTapeLogger>
): ReturnType<typeof getLogTapeLogger> {
  if (!initialized) {
    configureLoggingSync();
  }
  return getLogTapeLogger(...args);
}
```

---

## 3. Key Design Choices & Rationale

### ANSI Escape Padding Gotcha
When `getAnsiColorFormatter` invokes `format({ level, record, ... })`, the `level` parameter already includes colored ANSI escape codes (e.g. `\x1b[32mINFO\x1b[0m`). Measuring `level.length` will measure the escape characters, producing misaligned columns.
- **Rule**: Always compute padding against `record.level.length` (the raw unformatted level string like `"info"` or `"warning"`):
  ```typescript
  const levelStr = record.level.toUpperCase();
  const levelPad = " ".repeat(Math.max(0, 7 - levelStr.length));
  ```

### Category Separator: Middle Dot (`·`)
LogTape represents categories as string arrays (e.g. `["app", "actions", "song"]`).
Joining with `·` (`record.category.join("·")`) creates clean, readable identifiers (`app·actions·song`) that resemble modern system log formats (like systemd and structured microservices) without visual clutter.

### Non-Blocking Console Sink (`nonBlocking: !isTest`)
- **Web Runtime**: Logging must never introduce latency into client requests. LogTape buffers console records and flushes them asynchronously in batches.
- **Test Runner (Vitest / Jest)**: Test runners terminate worker threads immediately upon test completion. Non-blocking sinks would cause pending logs to be dropped or throw teardown exceptions. By checking `!isTest`, test execution remains synchronous and completely predictable.

### Silencing Meta Logger
LogTape defaults to outputting an informational setup banner via its internal `["logtape", "meta"]` category:
```text
INF logtape·meta LogTape loggers are configured...
```
Setting `lowestLevel: "warning"` on `["logtape", "meta"]` suppresses this startup noise while still ensuring any sink errors or internal misconfigurations are reported.

