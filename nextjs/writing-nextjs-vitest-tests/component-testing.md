# Component Testing with @testing-library/react

## Overview

Rendering components under jsdom, asserting DOM output, firing events, and testing UI behaviour with `@testing-library/react`. Distinct from hook/store tests — this is about **what the user sees and does**.

## When to Use

- Writing tests for React components (not hooks, not stores)
- Asserting rendered output: text, classes, roles, visibility
- Firing user interactions: clicks, input changes, form submissions
- Testing component props, conditional rendering, fallback states
- Testing shadcn/ui or custom UI primitives

**Not for:** hooks (`renderHook`), Zustand stores (`getState()`), server actions (assert DB call args).

## Setup

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MyComponent from "@/components/my-component";
```

The `/vitest` suffix on `@testing-library/jest-dom/vitest` (in `vitest.setup.tsx`) provides DOM matchers: `toBeInTheDocument`, `toBeVisible`, `toHaveTextContent`, `toHaveClass`, etc.

## Basic Pattern

```typescript
describe("MyComponent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the heading when prop is provided", () => {
    render(<MyComponent heading="Welcome" />);
    const heading = screen.getByRole("heading", { name: "Welcome" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass("text-foreground", "text-3xl");
  });

  it("does not render a heading when omitted", () => {
    render(<MyComponent />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders children alongside the heading", () => {
    render(
      <MyComponent heading="Search">
        <p>child content</p>
      </MyComponent>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
```

## Query Methods

| Method     | Behaviour                 | Use case                                       |
| ---------- | ------------------------- | ---------------------------------------------- |
| `getBy*`   | Throws if not found       | Happy path — element MUST exist                |
| `queryBy*` | Returns null if not found | Negative assertions — element should NOT exist |
| `findBy*`  | Waits + retries (async)   | Elements that appear after async work          |

Query priority (best to worst): **role > label > text > test-id > placeholder**.

```typescript
// ✅ Best — semantic, resilient to refactoring
screen.getByRole("button", { name: "Submit" });

// ✅ Good — accessible label
screen.getByLabelText("Email");

// ⚠️ OK — text content
screen.getByText("Welcome back");

// ❌ Avoid — brittle, implementation detail
screen.getByTestId("submit-button");
```

## Firing Events

```typescript
// Click
fireEvent.click(screen.getByRole("button", { name: "Delete" }));

// Input change
const input = screen.getByPlaceholderText("Search");
fireEvent.change(input, { target: { value: "jam" } });

// Form submit
fireEvent.submit(screen.getByRole("form"), {
  target: { email: { value: "test@example.com" } },
});
```

For async interactions (debounce, navigation), combine with fake timers (§1 of advanced-mocks.md):

```typescript
vi.useFakeTimers();
fireEvent.change(input, { target: { value: "jam" } });
act(() => { vi.advanceTimersByTime(500); });
expect(mockPush).toHaveBeenCalledWith("/search?q=jam");
vi.useRealTimers();
```

## Mocking Dependencies

Components import hooks, providers, and child components. Mock them at the module level:

```typescript
vi.mock("@/hooks/use-on-play", () => ({
  default: () => onPlayMock,
}));

vi.mock("@/components/song/song-item", () => ({
  __esModule: true,
  default: ({ data, onClick }: { data: SongWithAlbum; onClick: (id: number) => void }) => (
    <button onClick={() => onClick(data.id)}>{data.title}</button>
  ),
}));
```

Provider mocks are typically in `vitest.setup.tsx`. If a component needs specific mock values, use `vi.mocked()`:

```typescript
const { result } = render(<MyComponent />, { wrapper: TestWrapper });
vi.mocked(useRouter).mockReturnValue({ push: mockPush, ... });
```

## Test Wrapper Pattern

When a component needs multiple providers, compose them in a helper:

```typescript
// __tests__/helpers/TestWrapper.tsx
import SupabaseProvider from "@/providers/supabase-provider";
import UserProvider from "@/providers/user-provider";

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <SupabaseProvider>
    <UserProvider>{children}</UserProvider>
  </SupabaseProvider>
);

export default TestWrapper;
```

Usage:

```typescript
render(<MyComponent />, { wrapper: TestWrapper });
```

Providers must be mocked in `vitest.setup.tsx` (they throw without a real request context). The wrapper uses the **actual provider components**, which render their children but whose hooks return mock values.

## Shadcn/ui Component Tests

Test shadcn/ui primitives for class merging, disabled state, and prop passthrough:

```typescript
import { Input } from "@/components/ui/input";

it("merges classes and applies disabled styles", () => {
  const { getByRole } = render(<Input disabled className="custom-class" />);
  const el = getByRole("textbox");
  expect(el).toHaveClass("custom-class");
  expect(el).toHaveClass("opacity-50"); // disabled style
});
```

## Common Patterns

### Empty-state fallback

```typescript
it("shows a fallback when there is no data", () => {
  render(<SongsGrid songs={[]} />);
  expect(screen.getByText("No songs available.")).toBeInTheDocument();
});
```

### Event forwarding

```typescript
it("forwards click events to the callback", () => {
  render(<SongsGrid songs={[song]} />);
  fireEvent.click(screen.getByText("Track One"));
  expect(onPlayMock).toHaveBeenCalledWith(song.id);
});
```

### Conditional rendering based on auth state

```typescript
it("shows login prompt when unauthenticated", () => {
  vi.mocked(useUser).mockReturnValue({ user: null });
  render(<ProtectedPage />);
  expect(screen.getByText("Please log in")).toBeInTheDocument();
});

it("shows content when authenticated", () => {
  vi.mocked(useUser).mockReturnValue({ user: { id: "1" } });
  render(<ProtectedPage />);
  expect(screen.getByText("Dashboard")).toBeInTheDocument();
});
```

## Red Flags

- Using `container.querySelector` instead of `screen.getBy*` — breaks multi-root queries
- Asserting on CSS classes as primary assertion — classes can change; roles/text are stable
- Missing `beforeEach` cleanup — leftover mocks leak between tests
- Not mocking child components that have side effects — causes import-time crashes
- Testing implementation details (state shape, internal refs) instead of observable output
