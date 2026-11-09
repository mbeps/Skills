# What to Test Per Layer

## Zod schemas

Use `safeParse` — it never throws; assert `result.success` only (verified pattern). If error shapes matter, assert `result.error?.issues` with `toContainEqual(expect.objectContaining({ path: ["title"] }))`.

```typescript
it("rejects non-UUID id", () => {
  const result = persistMessageSchema.safeParse({
    id: "not-a-uuid", role: "user", content: "Hello", parentId: null,
  });
  expect(result.success).toBe(false);
});
```

One good case + edge cases per rule (example: `persistMessageSchema`):

| Rule                                  | Good case        | Edge cases                    |
| ------------------------------------- | ---------------- | ----------------------------- |
| `id: uuid`                            | valid UUID       | `"not-a-uuid"`, `""`, missing |
| `role: enum`                          | `"user"`         | `"admin"`, missing            |
| `content: min(1)`                     | `"Hello"`        | `""`, whitespace-only         |
| `parentId: nullable uuid`             | `null`           | `"bad-id"`                    |
| `metadata: nullable string, optional` | `null` or `"{}"` | `123`, missing                |

And for `createChatSchema` (title, projectId, assistantId — `persistMessageSchema` has no title):

| Rule                                   | Good case   | Edge cases               |
| -------------------------------------- | ----------- | ------------------------ |
| `title: min(1) max(255), optional`     | `"My Chat"` | 256 chars, `""`, omitted |
| `projectId: nullable uuid, optional`   | `null`      | `"bad-id"`, missing      |
| `assistantId: nullable uuid, optional` | `null`      | `"bad-id"`, missing      |

Also cover: `strict()` rejects unknown keys, `passthrough()` keeps them, omitted-vs-`undefined` distinctions for optional fields.

### Zod v4 `.partial()` with `.default()`
In Zod v4, calling `.partial()` on a schema containing `.default(...)` retains those default values:
```typescript
const baseSchema = z.object({
  name: z.string(),
  status: z.enum(["active", "inactive"]).default("active"),
});
const updateSchema = baseSchema.partial();
// updateSchema.safeParse({}) returns { status: "active" }, NOT {}
```
If an action implementation checks `if (data.status !== undefined)`, that guard will always evaluate to `true` when using the parsed result, creating an unreachable branch in V8 coverage. To permit true omission in update schemas, strip defaults before making fields optional:
```typescript
const updateSchema = baseSchema.omit({ status: true }).partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});
```

## Server actions

In modern Next.js applications using the Result pattern with higher-order boundary wrappers (e.g. `defineAction`), **Server Actions never throw generic or domain exceptions**. They return typed Result objects (`{ ok: true, value: T } | { ok: false, error: AppError }`). 

Test matrix:

| Scenario                   | Setup                                                                        | Assertion                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Happy path                 | `chainable.returning.mockResolvedValueOnce([ROW])`                           | `expect(result).toEqual({ ok: true, value: ROW })`                                                                                                                             |
| Validation failure         | pass invalid args (e.g. empty string, invalid UUID)                          | `expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "INVALID_INPUT" }) })`                                                                            |
| Unauthenticated            | `vi.mocked(requireSession).mockRejectedValueOnce(new AppException({ code: "UNAUTHORIZED", message: "Unauthorized" }))` (or `new Error("Unauthorized")`) | `expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "UNAUTHORIZED" }) })`                                                                            |
| Defaults when args omitted | call with no args                                                            | `chainable.values` called with `objectContaining({ title: "New Chat" })`; `expect(result).toEqual({ ok: true, value: expect.objectContaining({ title: "New Chat" }) })`     |
| Per-user scoping           | session has `user.id: "user-1"`                                              | `values` called with `objectContaining({ userId: "user-1" })` — always from session, never from args                                                                           |
| Ownership guard / Not found| `chainable.where.mockResolvedValueOnce([])`                                  | `expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "NOT_FOUND" }) })`                                                                                 |
| Conflict / Unique Violation| Drizzle throws Postgres error code `23505`                                   | `expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "CONFLICT" }) })`                                                                                   |
| Unexpected Server Crash    | mock throws unhandled Error (e.g. DB disconnect)                             | `expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "INTERNAL", ref: expect.any(String) }) })`                                                         |
| Framework navigation       | action calls `redirect()` or `notFound()`                                    | `await expect(action()).rejects.toThrow()` (`unstable_rethrow` passes framework symbols through)                                                                               |
| Query contract             | —                                                                            | `insert`/`update`/`delete` `toHaveBeenCalledOnce()`; `set` with `objectContaining({...})`                                                                                      |

```typescript
it("inserts a chat and returns ok Result with the new row", async () => {
  chainable.returning.mockResolvedValueOnce([CHAT_ROW]);
  const result = await createChat("My Chat");
  expect(result).toEqual({ ok: true, value: CHAT_ROW });
  expect(chainable.values).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "user-1" }),
  );
});

it("returns INVALID_INPUT when title is empty", async () => {
  const result = await createChat("");
  expect(result).toEqual({
    ok: false,
    error: expect.objectContaining({ code: "INVALID_INPUT" }),
  });
});
```

### Mocking Server Actions in Consumer Tests (Components, Hooks, Stores)

When testing UI components, custom hooks, or Zustand store slices that call Server Actions:
- **Always mock the return value as a `Result`**:
  ```typescript
  vi.mock("@/actions/chats/create-chat", () => ({
    createChat: vi.fn().mockResolvedValue({ ok: true, value: CHAT_ROW }),
  }));
  ```
- **Test the failure branch**:
  ```typescript
  vi.mocked(createChat).mockResolvedValueOnce({
    ok: false,
    error: { code: "NOT_FOUND", message: "Not found" },
  });
  ```
- **Silent failure warning**: Because `tsconfig.json` excludes `__tests__` from `next build` typechecking, mocks returning raw rows or rejecting promises will compile without TypeScript errors, but crash at runtime with `TypeError: Cannot read properties of undefined (reading 'ok')`. Search `vi.mock("@/actions/` across `__tests__/` when migrating actions to Results.

Multi-query actions (e.g. fetch chat + messages + attachments): stub `chainable.where` with a call counter that returns rows for the terminal call and the chainable for intermediate calls (§5 of mocking-patterns.md).

## Hooks

`renderHook` + `act` + `waitFor` from `@testing-library/react`. Mock every dependency: `next/navigation` (router), `sonner` (toasts), the store, and any server actions — all via `vi.hoisted` fns so you can assert called-with payloads.

```typescript
it("shows a success toast and navigates after delete", async () => {
  const onDelete = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() =>
    useEntityOptions({ id: "ent-1", type: "Assistant", onDelete, redirectPath: "/assistants" }),
  );
  await act(async () => { await result.current.handleDelete(); });
  expect(mockToastSuccess).toHaveBeenCalledWith("Assistant deleted");
  expect(mockPush).toHaveBeenCalledWith("/assistants");
});
```

- Async handler flows: `await act(async () => { await result.current.handler(...) })`.
- Polling transitions: `await waitFor(() => expect(result.current.activeToolCalls).toEqual([]))`.
- Cached hooks & lifecycle: when hooks read from module caches (`getCacheData()`, `subscribeCache()`), test:
  1. Fresh cache: returns data immediately without trigger.
  2. Stale cache / empty: triggers server action fetch, handles retry limits.
  3. Subscription cleanup: verify unmounting `renderHook` calls the returned unsubscribe callback.
  4. Selector/filter variations: test all discriminator filters (e.g. `'chat' \| 'embedding' \| 'both'`) and parent/child `isEnabled` combinations.
- Streaming: stub `global.fetch` with a constructed SSE `Response` (§8 of mocking-patterns.md); assert the assembled message args.
- Failure paths: mock the action/fetch to reject; assert the error toast fired and loading state reset.
- Ref-container identity & timer persistence: verify that hooks returning object collections of refs memoize their container (or don't destabilize downstream `useCallback`/`useEffect` hooks). Test with `rerender()` to ensure active intervals, polling loops, or watchdog retry counts do not clear and reset on every render.
- Multi-phase scenario isolation: always capture `const { unmount } = renderHook(...)` and call `unmount()` between sequential scenarios to prevent background timers from bleeding across assertions.

## Error normalizers & categorizers

Error utility functions (`isRateLimitError`, `classifyProviderError`, `normalizeErrorMessage`, `useApiError`) run at trust boundaries and must handle every conceivable thrown shape without throwing secondary errors. Test the full matrix:

| Error Shape               | Input Example                                   | Expected Assertion                                              |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Standard `Error`          | `new Error("Database timeout")`                 | Extracts `.message`                                             |
| Custom Error Class        | `new ProviderNotConfiguredError()`              | Correct type match / preserved                                  |
| `ZodError`                | `z.string().parse(123)` (caught)                | Formatted issues list / readable message                        |
| HTTP Status Objects       | `{ status: 429, message: "Too many requests" }` | Correct 429 rate limit categorization                           |
| Raw String / Number       | `"Network failed"`, `500`                       | Stringified / fallback message                                  |
| Null / Undefined / Object | `null`, `undefined`, `{}`                       | Default fallback string (e.g. `"An unexpected error occurred"`) |

## Zustand stores

Test pure slice logic through `getState()`/`setState`. Reset to a known state each test; mock every server action the store imports (a combined store pulls in all slices — mock each action module):

```typescript
vi.mock("@/lib/actions/chats/create-chat", () => ({ createChat: vi.fn() }));
// ... delete-chat, rename-chat, list-projects, list-assistants, etc.

beforeEach(() => {
  useAppStore.setState(RESET_STATE);
  vi.clearAllMocks();
});

it("links a message to its parent's childrenIds", () => {
  useAppStore.getState().addMessage(chatId, "user", "Root", null, "root");
  useAppStore.getState().addMessage(chatId, "assistant", "Reply", "root", "child");
  const parent = useAppStore.getState().chats[chatId].messages["root"];
  expect(parent.childrenIds).toContain("child");
});
```

- `setState` merges — pass the full shape (`RESET_STATE`) to fully reset.
- For async store methods, spy and mock the return: `vi.spyOn(useAppStore.getState(), "createChatDb").mockResolvedValueOnce("chat-abc")` (remember `restoreAllMocks`).
- Integration alternative: render a real component, drive it with `user-event`, assert via `screen` queries.

## Jotai atoms

Test Jotai atoms directly via `createStore()` — no rendering needed. Each test gets an isolated store so atoms don't leak:

```typescript
import { createStore } from "jotai";
import { editorAtom } from "@/features/editor/store/atoms";

describe("editorAtom", () => {
  it("should initialise with null", () => {
    const store = createStore();
    expect(store.get(editorAtom)).toBe(null);
  });

  it("should update with a ReactFlowInstance", () => {
    const store = createStore();
    const mockInstance = { zoomIn: () => {} } as any;

    store.set(editorAtom, mockInstance);
    expect(store.get(editorAtom)).toBe(mockInstance);
  });
});
```

Pattern:

- `createStore()` per test for isolation
- `store.get(atom)` reads initial/default value
- `store.set(atom, value)` writes value
- Use `as any` for complex objects (ReactFlowInstance) since full mocking isn't needed
- Works for `WritableAtom<T, T[], void>` (simple setValue). For read-only `Atom<T>`, use `store.get(atom)` only.

## Utils

Pure-function edge cases; use fake timers for anything time-based (verified pattern):

```typescript
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("rejects when the promise outlives the timeout", async () => {
  const neverResolves = new Promise<never>(() => {});
  const racePromise = withTimeout(neverResolves, 500, "slow-server");
  vi.advanceTimersByTime(501);
  await expect(racePromise).rejects.toThrow("timed out after 500ms");
});
```

- Cleanup assertions: `vi.spyOn(globalThis, "clearTimeout")` and assert it was called.
- Network-dependent utils (e.g. URL guards): mock the resolver module, not the network — `vi.hoisted` mock for `resolveHostname`, then table-test malformed/loopback/private/IPv6 inputs. Snapshot `process.env` in `beforeEach`, restore in `afterEach` when the code reads env flags.

## Encryption utilities

Test real crypto round-trips by mocking env FIRST (since encryption.ts reads `env.ENCRYPTION_KEY` at import time):

```typescript
vi.mock("@/lib/env", () => ({
  env: { ENCRYPTION_KEY: "test-key-of-at-least-32-characters-long-123" },
}));
import { encrypt, decrypt } from "@/lib/encryption";

it("round-trips correctly", () => {
  const encrypted = encrypt("secret-api-key");
  expect(encrypted).not.toBe("secret-api-key");
  expect(decrypt(encrypted)).toBe("secret-api-key");
});

it("produces unique ciphertext (IV rotation)", () => {
  const e1 = encrypt("same-value");
  const e2 = encrypt("same-value");
  expect(e1).not.toBe(e2);
});

it("throws on invalid input", () => {
  expect(() => decrypt("invalid-string")).toThrow();
});
```

Gotcha: Some projects comment out the encryption mock globally in `vitest.setup.ts` because tests that need real crypto must import the actual module. Tests needing mocked encryption import the mock file directly before the SUT imports.

## Utility functions (cn)

Test class-merging utilities like `cn()` (clsx + tailwind-merge):

```typescript
import { cn } from "@/lib/utils";

it("merges independent classes", () => {
  expect(cn("px-2", "py-2")).toBe("px-2 py-2");
});

it("resolves conflicts (last wins)", () => {
  expect(cn("px-2 py-2", "p-4")).toBe("p-4");
});

it("handles conditionals", () => {
  expect(cn("px-2", true && "py-2", false && "mt-4")).toBe("px-2 py-2");
});

it("ignores null/undefined", () => {
  expect(cn("px-2", null, undefined)).toBe("px-2");
});
```

## Error normalizers (toAppError)

Error normalizers convert arbitrary `unknown` throwables (Zod, DB, AI SDK, timeouts) into JSON-safe `AppError` values. To achieve 100% branch coverage, test every branch in the classification pipeline:

```typescript
describe("toAppError", () => {
  it("unwraps AppException to its inner error", () => {
    const err = new AppException({ code: "NOT_FOUND", message: "Not Found" });
    expect(toAppError(err)).toEqual({ code: "NOT_FOUND", message: "Not Found" });
  });

  it("maps ZodError to INVALID_INPUT with formatted issues list", () => {
    const zodError = new ZodError([{ path: ["email"], message: "Invalid email", code: "custom" }]);
    expect(toAppError(zodError)).toEqual(expect.objectContaining({
      code: "INVALID_INPUT",
      message: "Invalid email",
      issues: ["email: Invalid email"],
    }));
  });

  it("maps Postgres unique violation (code 23505) to CONFLICT", () => {
    expect(toAppError({ code: "23505" })).toEqual(expect.objectContaining({ code: "CONFLICT" }));
    // Also test cause.code if ORM wraps driver errors
    expect(toAppError({ cause: { code: "23505" } })).toEqual(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("maps AI SDK / HTTP APICallError status codes (429, 401, 403, 500)", () => {
    expect(toAppError({ name: "AI_APICallError", statusCode: 429 })).toEqual(
      expect.objectContaining({ code: "RATE_LIMIT" }),
    );
    expect(toAppError({ name: "AI_APICallError", statusCode: 401 })).toEqual(
      expect.objectContaining({ code: "INVALID_API_KEY" }),
    );
    expect(toAppError({ name: "AI_APICallError", statusCode: 502 })).toEqual(
      expect.objectContaining({ code: "UPSTREAM_HTTP", statusCode: 502 }),
    );
  });

  it("distinguishes TimeoutError from AbortError", () => {
    const timeout = new Error("Timeout");
    timeout.name = "TimeoutError";
    expect(toAppError(timeout)).toEqual(expect.objectContaining({ code: "UPSTREAM_HTTP" }));

    const abort = new Error("Aborted");
    abort.name = "AbortError";
    expect(toAppError(abort)).toEqual(expect.objectContaining({ code: "INTERNAL" }));
  });

  it("falls back to INTERNAL with random correlation ref on unhandled errors", () => {
    const res = toAppError(new Error("Database disk full"));
    expect(res).toEqual({
      code: "INTERNAL",
      message: expect.stringMatching(/Something went wrong\. \(Ref: [a-f0-9-]+\)/),
      ref: expect.any(String),
    });
  });
});
```

## Client error hooks (useApiError)

Test that UI error hooks handle both typed `AppException` instances and plain JSON Result error objects `{ code, message, ...metadata }`:

```typescript
describe("useApiError", () => {
  it("extracts code and forwards dynamic metadata to toast notification", () => {
    const { result } = renderHook(() => useApiError());
    
    // Test plain Result error object
    const handled = result.current.handleApiError({
      code: "MODEL_DUPLICATE_IMPORT",
      duplicateCount: 3,
    });
    
    expect(handled).toBe(true);
    expect(toast.warning).toHaveBeenCalledWith(
      "3 model(s) skipped (already exist)",
      expect.any(Object),
    );
  });
});
```

## Architecture tests with Vitest

Vitest can run automated architectural checks that scan source files using `fs` to prevent regressions (such as unwrapped Server Actions):

```typescript
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ACTIONS_DIR = path.resolve(__dirname, "../../actions");
export const UNMIGRATED_ACTIONS = new Set<string>([]);

function getActionFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getActionFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

describe("Server Actions Architecture", () => {
  it("ensures every exported action uses defineAction or an entity factory", () => {
    const files = getActionFiles(ACTIONS_DIR);
    for (const filePath of files) {
      const rel = path.relative(process.cwd(), filePath);
      if (UNMIGRATED_ACTIONS.has(rel)) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const wrapped = content.includes("defineAction(") || /createEntityFactory[<(]/.test(content);
      expect(wrapped, `${rel} must wrap exported actions`).toBe(true);
    }
  });
});
```

## Coverage guidance

- Keep `app/**` and `components/**` excluded; the 80% thresholds live on logic layers (actions, lib, schemas).
- Prioritise **branch-critical logic**: auth guards, per-user scoping, empty-vs-null, optional-chain fallbacks — both sides of each decision.
- Branches is the metric that fails first; when it does, write the missing guard test rather than raising the threshold.
- Thresholds fail the run — evidence over configuration.
