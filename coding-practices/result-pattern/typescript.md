# Result Pattern in TypeScript

## Approach 1: Wire-Safe Object Result (Recommended for Full-Stack & RPC)

In full-stack architectures (Next.js Server Actions, REST, tRPC, Inngest, Web Workers), Results must cross network and serialization boundaries. Standard `Error` instances serialize to empty `{}` over JSON / React Server Components Flight protocol. 

The **object form** guarantees type safety, JSON serializability, and eliminates tuple-order bugs (`[err, val]` vs `[val, err]`).

### Core Types

```ts
/** JSON-safe error representation. No Error instances or class prototypes. */
export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly [key: string]: unknown;
}

export type Result<T, E extends AppError = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E extends AppError>(error: E): Result<never, E> => ({ ok: false, error });
```

### Service Implementation

```ts
export type UpdateUserError =
  | { readonly code: "USER_NOT_FOUND"; readonly message: string }
  | { readonly code: "EMAIL_TAKEN"; readonly message: string; readonly email: string };

export async function updateUser(
  id: string,
  email: string
): Promise<Result<{ id: string; email: string }, UpdateUserError>> {
  const user = await db.users.findById(id);
  if (!user) {
    return fail({ code: "USER_NOT_FOUND", message: "User not found" });
  }

  const existing = await db.users.findByEmail(email);
  if (existing && existing.id !== id) {
    return fail({ code: "EMAIL_TAKEN", message: "Email is already in use", email });
  }

  const updated = await db.users.update(id, { email });
  return ok(updated);
}
```

### Consumer: Narrowing & Exhaustive Checking

```ts
const res = await updateUser(userId, input.email);

if (!res.ok) {
  // Narrowed: res.error is typed
  switch (res.error.code) {
    case "USER_NOT_FOUND":
      return notFound();
    case "EMAIL_TAKEN":
      return toast.error(`Cannot assign ${res.error.email}: already in use`);
    default: {
      const unhandled: never = res.error; // Compile error if new variant is added
      throw new Error(`Unhandled error code: ${String(unhandled)}`);
    }
  }
}

// Narrowed: res.value is accessible
toast.success(`User updated to ${res.value.email}`);
```

---

## Approach 2: Boundary Unwinding with `AppException` (Dual-Mode)

A pure Result cannot unwind stateful boundaries that require an exception (e.g. Drizzle or Prisma transactions rolling back, third-party `fetch` override callbacks, or cross-cutting session checks).

### The Pattern
1. Throw a typed `AppException extends Error` holding the exact `AppError`.
2. Catch and convert it back to `fail(e.error)` immediately outside the transaction boundary.
3. **Never leak `AppException` across Server Actions, API routes, or to the client.**
4. **Never throw `AppException` inside client React components or hooks.**

```ts
/**
 * Exception class strictly for unwinding transactional boundaries.
 * Must be caught and converted to a Result before crossing any RPC/network boundary.
 */
export class AppException<E extends AppError = AppError> extends Error {
  readonly error: E;

  get code(): string {
    return this.error.code;
  }

  constructor(error: E) {
    super(error.message);
    this.name = "AppException";
    this.error = error;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

### Usage Inside Transactions

```ts
export async function transferFunds(
  fromId: string,
  toId: string,
  amount: number
): Promise<Result<{ transferId: string }, AppError>> {
  try {
    return await db.transaction(async (tx) => {
      const from = await tx.accounts.get(fromId);
      if (from.balance < amount) {
        // Must throw to force database rollback
        throw new AppException({ code: "INSUFFICIENT_FUNDS", message: "Balance too low" });
      }

      await tx.accounts.decrement(fromId, amount);
      await tx.accounts.increment(toId, amount);
      const record = await tx.transfers.insert({ fromId, toId, amount });
      
      return ok({ transferId: record.id });
    });
  } catch (error) {
    if (error instanceof AppException) {
      return fail(error.error); // Converted back to Result at the boundary
    }
    throw error; // Unexpected system exception continues bubbling
  }
}
```

---

## Approach 3: Boundary Wrapper for Server Actions (`defineAction`)

In production, Next.js masks errors thrown from Server Actions (React error #441), replacing custom error messages with generic error digests. Furthermore, Next.js navigation primitives (`redirect()`, `notFound()`) throw internal symbols that must never be intercepted as errors.

The `defineAction` wrapper guarantees:
1. Framework control-flow throws (`redirect`, `notFound`) bubble cleanly via `unstable_rethrow`.
2. Auth throws (`requireSession()`) convert to `{ code: "UNAUTHORIZED", message: "Unauthorized" }`.
3. Unexpected exceptions log server-side with an 8-character correlation `ref` and return a safe `{ code: "INTERNAL", message: "Something went wrong. (Ref: abc12345)", ref }`.

```ts
import { unstable_rethrow } from "next/navigation";

export type ActionHandler<TArgs extends readonly unknown[], TResult, TError extends AppError> =
  (...args: TArgs) => Promise<Result<TResult, TError>>;

export function defineAction<TArgs extends readonly unknown[], TResult, TError extends AppError>(
  handler: ActionHandler<TArgs, TResult, TError>
): (...args: TArgs) => Promise<Result<TResult, TError | { code: "UNAUTHORIZED"; message: string } | { code: "INTERNAL"; message: string; ref: string }>> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      // 1. Rethrow framework control-flow (redirect / notFound)
      unstable_rethrow(error);

      // 2. Map authentication unwinds
      if (error instanceof AppException && error.error.code === "UNAUTHORIZED") {
        return fail({ code: "UNAUTHORIZED", message: "Unauthorized" });
      }

      // 3. Mask unhandled crashes; log with traceable correlation ref
      const ref = crypto.randomUUID().slice(0, 8);
      console.error(`Unhandled action error [Ref: ${ref}]:`, error);

      return fail({
        code: "INTERNAL",
        message: `Something went wrong. (Ref: ${ref})`,
        ref,
      });
    }
  };
}
```

---

## Approach 4: Canonical Error Normalization (`toAppError`)

Catching `unknown` in top-level handlers requires converting arbitrary errors (Zod validation, database errors, AI SDK exceptions, timeouts) into structured `AppError` values:

```ts
import { ZodError } from "zod";

export function toAppError(error: unknown): AppError {
  if (error instanceof AppException) {
    return error.error;
  }

  // Schema validation failure
  if (error instanceof ZodError) {
    return {
      code: "INVALID_INPUT",
      message: error.issues[0]?.message ?? "Invalid input",
      issues: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  // Database unique violation (Postgres error 23505)
  const dbCode = (error as any)?.code ?? (error as any)?.cause?.code;
  if (dbCode === "23505") {
    return {
      code: "CONFLICT",
      message: "A resource with this identifier already exists.",
    };
  }

  // Upstream HTTP / API provider errors (e.g. AI SDK APICallError)
  if (error && typeof error === "object" && typeof (error as any).statusCode === "number") {
    const status = (error as any).statusCode;
    if (status === 429) {
      return { code: "RATE_LIMIT", message: "Rate limit exceeded. Please wait a moment." };
    }
    if (status === 401 || status === 403) {
      return { code: "INVALID_API_KEY", message: "Authentication failed with upstream provider." };
    }
    return { code: "UPSTREAM_HTTP", message: `Upstream service returned HTTP ${status}.`, status };
  }

  // Timeout vs Abort
  if (error instanceof Error) {
    if (error.name === "TimeoutError") {
      return { code: "TIMEOUT", message: "Request timed out." };
    }
    if (error.name === "AbortError") {
      return { code: "ABORTED", message: "Operation was cancelled." };
    }
  }

  // Fallback internal error with log correlation
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`Internal error [Ref: ${ref}]:`, error);
  return {
    code: "INTERNAL",
    message: `Something went wrong. (Ref: ${ref})`,
    ref,
  };
}
```

---

## Approach 5: Background Queues & Durable Workflows (Inngest, Temporal, BullMQ)

In durable execution engines, returned values and thrown exceptions trigger different engine behaviors:

| Scenario | Return or Throw? | Why |
|---|---|---|
| **Transient Error** (network dropped, DB lock timeout) | **Throw** exception | Signals the engine to schedule retries with exponential backoff |
| **Terminal Domain Error** (user deleted, file unsupported) | **Return Result** (or throw `NonRetriableError`) | A returned Result counts as step completion; engine will NOT waste retries |
| **Step Payload Boundary** | **Plain JSON Result** | Never return `Error` instances inside `step.run`; they serialize to `{}` |

```ts
// Inngest durable function example
export const ingestDocument = inngest.createFunction(
  { id: "ingest-doc" },
  { event: "doc/uploaded" },
  async ({ event, step }) => {
    // Expected terminal failure: return Result so step does not retry endlessly
    const validation = await step.run("validate-file", async () => {
      if (!isSupportedExtension(event.data.fileName)) {
        return fail({ code: "UNSUPPORTED_TYPE", message: "Only PDF or TXT allowed" });
      }
      return ok({ valid: true });
    });

    if (!validation.ok) {
      // Mark workflow failed in DB and exit cleanly
      await step.run("mark-failed", () => db.docs.fail(event.data.id, validation.error.message));
      return;
    }

    // Transient failure: let it throw so Inngest retries the network fetch
    await step.run("download-from-s3", async () => {
      return await downloadFile(event.data.s3Key); // throws on timeout -> retried
    });
  }
);
```

---

## Approach 6: Automated Enforcement (Linting & Architecture Tests)

Enforce Result usage and prevent developer regressions across the codebase:

### 1. Biome / GritQL Rule (`no-throw-error.grit`)

Bans raw `throw new Error(...)` across application code:

```grit
language js

`throw new Error($args)` where {
  register_diagnostic(
    span=$args,
    message="Avoid generic throw new Error; return Result or throw AppException",
    severity="error"
  )
}
```

### 2. Architecture Test (Vitest)

Asserts that every exported Server Action is wrapped with `defineAction` or an approved factory:

```ts
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Server Actions Architecture", () => {
  it("ensures every exported action uses defineAction", () => {
    const actionFiles = getFiles("actions");
    for (const file of actionFiles) {
      const code = fs.readFileSync(file, "utf-8");
      const wrapped = code.includes("defineAction(") || code.includes("createEntityFactory(");
      expect(wrapped, `${file} must wrap exported actions`).toBe(true);
    }
  });
});
```

---

## Approach 7: Alternatives: Go-Style Tuples & neverthrow

### Tuple Form: Zero-Dependency Local Utilities

Error-first Go-style tuples work well for small, localized helper functions where creating object keys adds unnecessary boilerplate:

```ts
export type TupleResult<T, E> = [E, null] | [null, T];

export function parseNumber(input: string): TupleResult<number, string> {
  const n = Number(input);
  return isNaN(n) ? ["Not a number", null] : [null, n];
}

const [err, val] = parseNumber("123");
if (err !== null) {
  console.error(err);
} else {
  console.log(val);
}
```

*Rule:* Standardize tuple ordering across the codebase (`[err, val]` vs `[val, err]`). Never mix them.

### neverthrow v8.x

If rich monadic chaining (`.andThen`, `.mapErr`, `.match`, `safeTry`) is required:

```ts
import { err, ok, Result, ResultAsync } from "neverthrow";

const fetchUser = (id: string): ResultAsync<User, { reason: "NOT_FOUND" }> =>
  ResultAsync.fromPromise(
    db.users.find(id),
    () => ({ reason: "NOT_FOUND" as const })
  );

fetchUser("u1")
  .andThen((user) => (user.active ? ok(user) : err({ reason: "INACTIVE" as const })))
  .match(
    (user) => console.log("User:", user.email),
    (e) => console.error("Failed:", e.reason)
  );
```
