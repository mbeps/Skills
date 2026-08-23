# Advanced Mocking Patterns

## Overview

Mocking patterns beyond the basics: fake timers, Zustand direct state manipulation, `vi.mocked()` re-mocking, provider-layer mocks, toast/notification mocking, logger mocking, env/constants mocking, dual-format mock factories, co-located test patterns, ESLint config for tests, and coverage threshold configuration.

## When to Use

- Testing debounce, timeouts, intervals, or any time-dependent behaviour
- Testing Zustand stores via direct `getState()`/`setState()` calls
- Overriding a mocked function's return value per-test
- Mocking provider components (Supabase, auth) at the layer level
- Mocking `sonner` toasts, `@logtape/logtape` loggers, `@/lib/env` constants
- Building typed factory helpers that produce both domain models and DB rows
- Configuring Vitest coverage thresholds, co-locating tests next to source, ignoring tests from ESLint

**Not for:** basic `vi.mock` hoisting, chainable DB mocks, Next.js runtime modules — those are in `mocking-patterns.md`.

## 1. Fake Timers + act()

For debounce, timeouts, intervals — use `vi.useFakeTimers()` with `act()` from `@testing-library/react`:

```typescript
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import useDebounce from "@/hooks/use-debounce";

describe("useDebounce", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 200));
    expect(result.current).toBe("hello");
  });

  it("updates after the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: "first" } },
    );

    rerender({ value: "second" });

    act(() => { vi.advanceTimersByTime(499); });
    expect(result.current).toBe("first"); // not yet

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe("second"); // now updated
  });
});
```

For component interactions (e.g. search input debounce):

```typescript
it("pushes the search query after a debounce", () => {
  vi.useFakeTimers();
  const push = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push });
  vi.mocked(usePathname).mockReturnValue("/search");

  render(<SearchInput />);
  const input = screen.getByPlaceholderText("Search for music");
  fireEvent.change(input, { target: { value: "jam" } });

  act(() => { vi.advanceTimersByTime(500); });
  expect(push).toHaveBeenCalledWith("/search?title=jam");

  vi.useRealTimers();
});
```

Rules:
- Always call `vi.useRealTimers()` in `afterEach` — leaked fake timers corrupt every subsequent test.
- `act()` wraps `vi.advanceTimersByTime()` so React processes state updates triggered by timer callbacks.
- For `renderHook`, wrap `rerender` in `act()` if the rerender triggers side effects.

## 2. Zustand getState() Direct Manipulation

Test Zustand stores by calling `getState()` directly — no rendering needed:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import usePlayer from "@/hooks/use-player";
import { createMockSongWithAlbum } from "../helpers/mockData";

describe("Zustand stores", () => {
  afterEach(() => {
    usePlayer.getState().reset(); // reset to known state
  });

  it("manages the player queue and active song", () => {
    const state = usePlayer.getState();
    state.setIds([1, 2]);
    expect(usePlayer.getState().ids).toEqual([1, 2]);

    state.setId(2);
    expect(usePlayer.getState().activeId).toBe(2);

    state.reset();
    expect(usePlayer.getState().ids).toEqual([]);
  });

  it("adds a song to the queue without duplicates", () => {
    const song = createMockSongWithAlbum({ id: 1 });
    usePlayer.getState().setIds([1]);
    usePlayer.getState().setSongs([song]);

    usePlayer.getState().addToQueue(song);

    expect(usePlayer.getState().songs).toHaveLength(1); // not duplicated
  });

  it("places a song to play next after the active song", () => {
    const song1 = createMockSongWithAlbum({ id: 1 });
    const nextSong = createMockSongWithAlbum({ id: 3 });

    usePlayer.getState().setIds([1, 2]);
    usePlayer.getState().setId(1);
    usePlayer.getState().playNext(nextSong);

    expect(usePlayer.getState().ids).toEqual([1, 3, 2]);
  });
});
```

Rules:
- Reset to known state in `afterEach` — Zustand is global singleton, mutations persist across tests.
- Use `getState()` for reads AND writes — avoids store wrapper overhead.
- For stores with async methods, spy on them: `vi.spyOn(useStore.getState(), "createDb").mockResolvedValueOnce("id")`. Remember `restoreAllMocks`.
- For modal stores, cast to access `setState`: `(useAuthModal as { setState: (s: Record<string, unknown>) => void }).setState({ isOpen: false })`.

## 3. vi.mocked() Re-mocking

Override a mocked function's return value in a specific test using `vi.mocked()`:

```typescript
import { validateStorageLimits } from "@/lib/storage-limit/validate-storage-limits";

vi.mock("@/lib/storage-limit/validate-storage-limits", () => ({
  validateStorageLimits: vi.fn(),
}));

it("returns error from validateStorageLimits if it fails", async () => {
  // Override the default mock implementation for this test only
  vi.mocked(validateStorageLimits).mockResolvedValue({
    ok: false,
    error: "Limit exceeded",
  });

  const result = await validateStorageForUpload(5000);
  expect(result.ok).toBe(false);
  expect(result.error).toBe("Limit exceeded");
});
```

Rules:
- `vi.mocked()` is a **type-only** helper — it tells TypeScript the fn has `.mockResolvedValue` etc.
- Use when you need different return values across tests for the same mock.
- Combine with `mockResolvedValueOnce` / `mockRejectedValueOnce` for one-off overrides.
- If the mock was set up with `mockImplementation`, use `mockImplementationOnce` instead.

## 4. Provider-Layer Mocks

Mock entire provider components (not just their hooks) so they render children without crashing:

```typescript
// vitest.setup.tsx
vi.mock("@/providers/supabase-provider", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSessionContext: vi.fn(() => ({
    session: null,
    isLoading: false,
    supabaseClient: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
        })),
      })),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      },
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })),
        })),
      },
    },
  })),
  useSupabaseUser: vi.fn(() => null),
}));
```

Then in individual tests, override specific hook returns:

```typescript
const mockGetUser = vi.hoisted(() => vi.fn());
vi.mocked(useSessionContext).mockReturnValue({
  supabaseClient: {
    from: vi.fn((table) => ({ select: vi.fn(() => ({ eq: mockGetUser })) })),
  },
});
```

Rules:
- Provider mocks go in `vitest.setup.tsx` — they apply to all tests.
- The provider component itself renders `{children}`; its hooks return mock values.
- Per-test overrides use `vi.mocked(HookName)` to change what the hook returns.
- Full mock client shape matters — code may call nested methods (`from().select().eq().single()`).

## 5. Toast Notification Mocking

Mock `sonner` toasts to assert success/error messages:

```typescript
const toastError = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => {}, // or capture similarly
  },
}));

it("handles errors when fetching a song", async () => {
  fetchResponse.error = { message: "not found" };
  const { result } = renderHook(() => useGetSongById(999));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(toastError).toHaveBeenCalledWith("Could not play/fetch song(s)");
});
```

Rules:
- Capture the toast fn in `vi.hoisted` so you can assert called-with payloads.
- Mock at module level — don't mock inside `beforeEach`.
- Assert the exact message string — it's the observable contract between action and UI.

## 6. Logger Mocking

Mock logging libraries (`@logtape/logtape`) to verify error/warning/info calls:

```typescript
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => ({
    error: (...args: unknown[]) => mockLogger.error(...args),
    warn: (...args: unknown[]) => mockLogger.warn(...args),
    info: (...args: unknown[]) => mockLogger.info(...args),
    debug: (...args: unknown[]) => mockLogger.debug(...args),
  })),
}));

it("logs error and continues if RPC fails", async () => {
  mockRPC.mockResolvedValue({ data: null, error: { message: "RPC Error" } });
  const result = await getStorageUsage();
  expect(mockLogger.error).toHaveBeenCalled();
  expect(result.globalUsage).toBe(0); // graceful degradation
});
```

For `@logtape/logtape` specifically (partial mock keeping real exports):

```typescript
vi.mock("@logtape/logtape", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@logtape/logtape")>();
  return {
    ...actual,
    getLogger: vi.fn(() => ({
      error: (...args: unknown[]) => mockLogger.error(...args),
      // ... other levels
    })),
  };
});
```

Rules:
- Capture log calls in `vi.hoisted` objects — assert `mockLogger.error` was called with expected args.
- Logger mocks should NOT throw — they're defensive, tests shouldn't fail because of them.
- Test both that errors were logged AND that the code continued gracefully.

## 7. Env/Constants Mocking

Mock environment variable modules or feature flag constants:

```typescript
vi.mock("@/lib/env", () => ({
  FILE_LIMITS: {
    USER_STORAGE_LIMIT_BYTES: 100,
    GLOBAL_STORAGE_LIMIT_BYTES: 1000,
  },
}));

it("uses configured limits", async () => {
  const result = await validateGlobalStorageLimit(50);
  expect(result.ok).toBe(true); // 900 + 50 = 950 < 1000
});
```

Rules:
- Include **every** var the code under test actually reads — missing vars cause undefined behaviour.
- Set `NODE_ENV: "test"` — some code branches on it.
- Mock at module level, not in `beforeEach`.
- Snapshot `process.env` in `beforeEach` and restore in `afterEach` if the code reads raw `process.env` flags.

## 8. Dual-Format Mock Factories

Build typed factory helpers that produce both **domain model** objects and **raw DB row** objects:

```typescript
// __tests__/helpers/mockData.ts
export const createMockSong = (overrides?: Partial<Song>): Song => ({
  id: 1, title: "Test Song", albumId: "album-1", trackNumber: 1,
  songPath: "test-song.mp3", uploaderId: "user-1",
  createdAt: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

// DB row format (snake_case, what Supabase returns before mapping)
export const createMockSongRow = (overrides?: Record<string, unknown>) => ({
  id: 1, title: "Test Song", album_id: "album-1", track_number: 1,
  song_path: "test-song.mp3", uploader_id: "user-1",
  created_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

export const createMockSongWithAlbumRow = (overrides?: Record<string, unknown>) => ({
  ...createMockSongRow(),
  albums: {
    id: "album-1", title: "Test Album", release_date: null,
    cover_image_path: "test-cover.jpg", uploader_id: "user-1",
    created_at: "2025-01-01T00:00:00.000Z",
    album_artists: [{ artists: { id: "artist-1", name: "Test Artist", image_url: null, uploader_id: null, created_at: "2025-01-01T00:00:00.000Z" } }],
  },
  ...overrides,
});
```

Usage in action tests:

```typescript
const songRow = createMockSongWithAlbumRow();
const mappedSong = createMockSongWithAlbum();

mockOrder.mockResolvedValue({ data: [songRow], error: null });
const result = await getSongs();
expect(result).toEqual([mappedSong]);
```

Rules:
- Separate domain models (camelCase) from DB rows (snake_case) — mappers transform between them.
- Factory functions accept partial overrides — DRY across tests.
- Nested relations (albums→artists) must be fully constructed — incomplete nesting causes `undefined` crashes in mapper code.
- Keep factories in `__tests__/helpers/mockData.ts` — shared across all test files.

## 9. Coverage Threshold Configuration

Set minimum coverage percentages in `vitest.config.ts` — the run **fails** below them:

```typescript
test: {
  coverage: {
    provider: "v8",
    reporter: ["text", "lcov"],
    reportsDirectory: "coverage",
    exclude: [
      "drizzle/**", "**/node_modules/**", "**/.next/**",
      "app/**", "components/**", "types/**",
      "lib/env.ts", // throws on missing vars at import
    ],
    thresholds: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
}
```

Rules:
- Exclude UI dirs (`app/**`, `components/**`) — keep thresholds on logic layers (actions, lib, schemas).
- Exclude `lib/env.ts` — it throws on missing vars; it's mocked everywhere anyway.
- **Branches is the hardest metric** — every `if`/ternary/`??` needs both sides exercised.
- When branches fails, write the missing guard test rather than lowering the threshold.
- Thresholds are evidence over configuration — failing the run proves gaps exist.

## 10. Co-located Tests

Place tests next to source files using `lib/actions/**/*.test.{ts,tsx}` pattern:

```typescript
// vitest.config.ts
include: [
  "__tests__/**/*.test.{ts,tsx}",   // traditional location
  "lib/actions/**/*.test.{ts,tsx}", // co-located
  "tests/**/*.test.{ts,tsx}",       // alternative location
]
```

Rules:
- Co-located tests live beside the source: `lib/actions/chats/create-chat.test.ts` next to `create-chat.ts`.
- Traditional `__tests__/` keeps all tests in one place — better for small projects.
- Both patterns work; pick one convention and stick to it.
- Co-located tests make it easier to find tests when navigating source code.

## 11. ESLint Ignore for Tests

Exclude test directories from linting rules that don't apply:

```typescript
// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**", "out/**", "build/**",
    "coverage/**", "node_modules/**",
    "__tests__/**", // ignore test files from linting
  ]),
]);
```

Rules:
- Test files often use patterns that lint rules flag (unused imports, globals, etc.).
- `globalIgnores` excludes paths from ALL lint rules.
- Consider whether you want linting on co-located tests (`lib/actions/**/*.test.ts`) — if so, don't glob-ignore them.

## Red Flags

- Leaking `vi.useFakeTimers()` — every test after yours runs with fake timers
- Using `container.querySelector` instead of `screen.getBy*` — breaks multi-root queries
- Not resetting Zustand stores in `afterEach` — mutations persist across tests
- Mocking providers without providing full client shape — nested method calls crash
- Asserting CSS classes as primary assertion — classes change; roles/text are stable
- Missing `NODE_ENV: "test"` in env mock — some code branches on it
- Incomplete mock factory nesting — `undefined` crashes in mapper code
