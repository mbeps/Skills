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

## Server actions

Test matrix (verified against the real suite):

| Scenario                   | Setup                                                                        | Assertion                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Happy path                 | `chainable.returning.mockResolvedValueOnce([ROW])`                           | `expect(result).toEqual(ROW)`                                                                                                                                                  |
| Validation failure         | pass invalid args                                                            | `rejects.toThrow(z.ZodError)` (import `{ z }` from `"zod"`) — constructor match beats message matching: Zod v4 error messages are JSON strings, so a message string is fragile |
| Unauthenticated            | `vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"))` | `rejects.toThrow("Unauthorized")`                                                                                                                                              |
| Defaults when args omitted | call with no args                                                            | `chainable.values` called with `objectContaining({ title: "New Chat" })`                                                                                                       |
| Per-user scoping           | session has `user.id: "user-1"`                                              | `values` called with `objectContaining({ userId: "user-1" })` — always from session, never from args                                                                           |
| Ownership guard            | `chainable.where.mockResolvedValueOnce([])`                                  | `rejects.toThrow("Not Found")`                                                                                                                                                 |
| Query contract             | —                                                                            | `insert`/`update`/`delete` `toHaveBeenCalledOnce()`; `set` with `objectContaining({...})`                                                                                      |

```typescript
it("binds the authenticated user id", async () => {
  chainable.returning.mockResolvedValueOnce([CHAT_ROW]);
  await createChat("My Chat");
  expect(chainable.values).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "user-1" }),
  );
});
```

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
- Streaming: stub `global.fetch` with a constructed SSE `Response` (§8 of mocking-patterns.md); assert the assembled message args.
- Failure paths: mock the action/fetch to reject; assert the error toast fired and loading state reset.

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

## Coverage guidance

- Keep `app/**` and `components/**` excluded; the 80% thresholds live on logic layers (actions, lib, schemas).
- Prioritise **branch-critical logic**: auth guards, per-user scoping, empty-vs-null, optional-chain fallbacks — both sides of each decision.
- Branches is the metric that fails first; when it does, write the missing guard test rather than raising the threshold.
- Thresholds fail the run — evidence over configuration.
