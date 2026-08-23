# Mocking Playbook

## 1. vi.mock hoisting + vi.hoisted

`vi.mock(path, factory)` is hoisted above **all imports** — the factory runs before the module graph loads, so it **cannot reference outer variables**:

```typescript
// WRONG — ReferenceError: cannot access 'mockFetch' before initialization
const mockFetch = vi.fn();
vi.mock("@/lib/api", () => ({ fetchApi: mockFetch }));
```

```typescript
// RIGHT — vi.hoisted makes the variable available to the hoisted factory
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchApi: mockFetch }));
```

Rules:

- Everything shared between a mock factory and test assertions goes in `vi.hoisted`.
- Because mocking is hoisted, "mock before imports" ordering is automatic — you can write `vi.mock` after the imports and it still runs first.
- `vi.doMock`/`vi.doUnmock` are **not** hoisted — only for dynamic-import tests.

## 2. Return/reject APIs + typed assertions

| API                                                     | Behaviour                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `mockReturnValue(v)`                                    | always returns `v` (sync)                                         |
| `mockReturnValueOnce(v)`                                | next call only, then fallback                                     |
| `mockResolvedValue(v)`                                  | resolves `v` (type-checked against the original fn's return type) |
| `mockResolvedValueOnce(v)`                              | next call resolves `v`                                            |
| `mockRejectedValue(e)` / `mockRejectedValueOnce(e)`     | rejects with `e`                                                  |
| `mockImplementation(fn)` / `mockImplementationOnce(fn)` | full control per call                                             |
| `vi.mocked(obj)`                                        | type-only helper — gives typed `.mockResolvedValue` etc.          |

Assertions: `toHaveBeenCalled()`, `toHaveBeenCalledOnce()`, `toHaveBeenCalledWith(...)`, `toHaveBeenCalledTimes(n)`, `toHaveBeenNthCalledWith(n, ...)`.

```typescript
vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));
vi.mocked(getSignedUrl).mockResolvedValueOnce("https://example.com/signed");
```

## 3. Cleanup semantics

| API                 | Call history | Implementation                  | Spy originals                  |
| ------------------- | ------------ | ------------------------------- | ------------------------------ |
| `clearAllMocks()`   | clears       | **keeps**                       | keeps                          |
| `resetAllMocks()`   | clears       | **wipes** (undefined-returning) | keeps                          |
| `restoreAllMocks()` | clears       | restores                        | **restores** (`vi.spyOn` only) |

- Recommended baseline: `afterEach(() => vi.restoreAllMocks())`.
- Used `vi.spyOn`? → `restoreAllMocks` (a plain `clearAllMocks` leaves the spy intercepting the next test).
- Chainable mock (see §5)? → `resetAllMocks` + re-link every default in `beforeEach`. Tests override intermediate impls per test (`mockImplementation`, `mockResolvedValueOnce`), and `clearAllMocks` would keep a leftover override.
- Plain value defaults (resolved sessions, SDK returns) set in `beforeEach` or hoisted? → `clearAllMocks` is safest (keeps them).
- `resetAllMocks` wipes everything — you **must** re-link chainable methods and re-set the session default in `beforeEach` (see §4–5).

```mermaid
flowchart TD
  A["Do tests use vi.spyOn?"] -->|Yes| B["afterEach: vi.restoreAllMocks()"]
  A -->|No| C["Chainable mock — tests override impls per test?"]
  C -->|Yes| D["beforeEach: vi.resetAllMocks() + re-link defaults (see §5)"]
  C -->|No| E["beforeEach: vi.clearAllMocks() (keeps impls)"]
```

## 4. Safety-net mocks (import-time crashes)

Mock env **first** — `lib/env.ts` throws on missing vars at import time, and every action imports it transitively. Then mock the DB and auth so nothing connects or reads cookies:

```typescript
// env: the module is mocked so the schema never runs — include every var the
// code under test actually reads at runtime, or it sees undefined
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    ENCRYPTION_SECRET: "test-encryption-secret",
    NODE_ENV: "test",
    NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: "true",
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
// ... chainable DB mock (§5) ...
vi.mock("@/lib/auth/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));
```

Import the unit under test after the mocks (visual order irrelevant — hoisting handles it).

## 5. Chainable Drizzle mock

Drizzle officially offers `drizzle.mock({ schema })` (typed, non-connecting), but the row-returning behaviour must be hand-built. Verified pattern — a self-returning builder plus terminal methods:

```typescript
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select", "from", "leftJoin", "limit",
    "insert", "values", "update", "set", "delete",
  ]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn().mockImplementation(() => c);   // intermediate → returns chain
  c.orderBy = vi.fn().mockImplementation(() => c); // overridden below → terminal
  c.offset = vi.fn().mockImplementation(() => c);
  c.$dynamic = vi.fn().mockImplementation(() => c);
  c.returning = vi.fn();                            // terminal → resolves rows
  c.transaction = vi.fn();
  for (const m of [
    "select", "from", "leftJoin", "limit",
    "insert", "values", "update", "set", "delete",
  ]) {
    c[m].mockImplementation(() => c);
  }
  c.orderBy.mockResolvedValue([]);
  c.returning.mockResolvedValue([]);
  c.transaction.mockImplementation(
    async (fn: (tx: typeof c) => Promise<unknown>) => fn(c),
  ); // tx = same chainable
  return c;
});
vi.mock("@/drizzle/db", () => ({ db: chainable }));
```

Contract:

- **Intermediate** methods (`select`, `from`, `where`, `leftJoin`, `limit`, `insert`, `values`, `update`, `set`, `delete`, `offset`, `$dynamic`) return the chainable itself — the chain survives `await`.
- **Terminal** methods resolve rows: `returning` and `orderBy` — `chainable.returning.mockResolvedValueOnce([CHAT_ROW])`. `orderBy` is **terminal**, not intermediate: `listChats` awaits it and reads the rows, so `beforeEach` re-links it with `mockResolvedValue([])`, never as chain-returning.
- `transaction` passes the same chainable as `tx`, so `db.transaction(async (tx) => tx.select()...)` works.
- `beforeEach` does `vi.resetAllMocks()` then **re-links every default** (reset wipes them):

```typescript
beforeEach(() => {
  vi.resetAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  // ... every intermediate method ...
  chainable.where.mockImplementation(() => chainable);
  chainable.orderBy.mockResolvedValue([]); // terminal — resolves rows, not chain-returning
  chainable.returning.mockResolvedValue([]);
  chainable.transaction.mockImplementation(
    async (fn: (tx: typeof chainable) => Promise<unknown>) => fn(chainable),
  );
  vi.mocked(requireSession).mockResolvedValue({ user: { id: "user-1" }, session: { id: "session-1" } });
});
```

- Multi-query actions: count calls with a closure, returning different rows per call:

```typescript
let whereCallCount = 0;
chainable.where.mockImplementation(() => {
  whereCallCount++;
  if (whereCallCount === 1) return Promise.resolve([{ chat: CHAT_ROW }]);
  return chainable; // intermediate in a later query
});
chainable.orderBy.mockResolvedValueOnce([MESSAGE_ROW]);
```

## 6. Next.js runtime modules

`next/navigation`, `next/headers`, `next/cache` read request-scoped globals and throw outside a request context. Mock anything the unit (or its imports) touches:

```typescript
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: mockPush, refresh: mockRefresh }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));
```

Then assert navigation: `expect(mockPush).toHaveBeenCalledWith("/chat/chat-abc")`.

## 7. Class-constructor SDKs (AWS S3, Postmark)

Constructors are mocked with `vi.fn().mockImplementation(function () { return { ... } })`, returning a plain object shaped like the instance. Commands become plain objects carrying their params; assert via `mock.calls[0][0]`:

```typescript
const mockSend = vi.hoisted(() => vi.fn());
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  PutObjectCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "PutObjectCommand", ...params };
  }),
  // GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand,
  // HeadBucketCommand, CreateBucketCommand: same pattern
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://example.com/presigned?token=abc"),
}));
```

```typescript
// Postmark
const mockSendEmail = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ MessageID: "test-msg-id" }),
);
vi.mock("postmark", () => ({
  ServerClient: vi.fn().mockImplementation(function () {
    return { sendEmail: mockSendEmail };
  }),
}));
```

Assertions: `expect(mockSend).toHaveBeenCalledOnce(); expect(mockSend.mock.calls[0][0]).toMatchObject({ Bucket: "test-bucket", Key: key })`. Re-arm the resolved value in each `beforeEach` (`clearAllMocks` keeps hoisted defaults, so only override what changed).

## 8. global.fetch + mock SSE streams

jsdom has no fetch that talks to your API; stub `global.fetch` and build a constructed `Response` wrapping a `ReadableStream` for streaming tests:

```typescript
function createMockSseStream(events: Array<{ type: string; data: unknown }>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      events.forEach(({ data }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      });
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

beforeEach(() => { global.fetch = vi.fn(); });
afterEach(() => { vi.restoreAllMocks(); });

it("accumulates streamed tokens", async () => {
  (global.fetch as any).mockResolvedValue(
    createMockSseStream([
      { type: "data", data: { type: "text", delta: "Hello" } },
      { type: "data", data: { type: "text", delta: " world" } },
      { type: "data", data: { type: "done", id: "assistant-1", metadata: {} } },
    ]),
  );
  const { result } = renderHook(() => useStreamResponse("chat-1"));
  await act(async () => {
    await result.current.streamResponse("user-1", "Hi", null, [], "gpt-4");
  });
  expect(mockAddMessage).toHaveBeenCalledWith(
    "chat-1", "assistant", "Hello world", "user-1", "assistant-1", "{}",
    undefined, undefined,
  );
});
```

For failures: `(global.fetch as any).mockRejectedValueOnce(new Error("network"))`, run the hook, then assert the error toast/state via your hoisted `mockToastError`.

## 9. importOriginal — partial mocks

Mock only some exports, keep the rest real:

```typescript
vi.mock(import("@/lib/chat/build-prompt"), async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/chat/build-prompt")>();
  return { ...mod, buildPrompt: vi.fn() };
});
```
