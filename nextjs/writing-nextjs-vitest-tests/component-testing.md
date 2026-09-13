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

// ❌ Avoid — index-based selection breaks when layout/icons change
screen.getAllByRole("button")[1];
```

> **Base UI / Radix focus guards**: Focus-trap primitives inject hidden `<span data-base-ui-focus-guard="" role="button" />` elements. Querying unlabelled buttons with `{ name: "" }` or bare `getAllByRole("button")` will collide with them. Target buttons by explicit accessible name, icon class, or scoped container.

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

### SVG element class assertions

In jsdom, `(svg as HTMLElement).className` returns an `SVGAnimatedString` object (`[object SVGAnimatedString]`), so `.className.includes(...)` or `.className.toContain(...)` fails. Use `toHaveClass` or `getAttribute`:

```typescript
const icon = screen.getByTestId("status-icon");
// ✅ Correct
expect(icon).toHaveClass("text-muted-foreground");
expect(icon.getAttribute("class")).toContain("text-muted-foreground");

// ❌ Throws or fails: icon.className is SVGAnimatedString, not string
// expect(icon.className).toContain("text-muted-foreground");
```

### Preserving compound subcomponents (e.g. Component.Skeleton)

When partially mocking a parent component using `importOriginal`, returning a new function component drops attached static properties (e.g. `Item.Skeleton`), causing React error `Element type is invalid: expected string or class/function but got: undefined`:

```typescript
vi.mock("@/components/item", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/item")>();
  const MockItem = ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  );
  // Re-attach static subcomponents
  MockItem.Skeleton = actual.Item.Skeleton;
  return { ...actual, Item: MockItem };
});
```

### Isolating click events in dialog/modal mock wrappers

When mocking dialog wrappers (e.g. `ConfirmModal`), rendering an unisolated wrapper `<div>` allows click events from dialog buttons to bubble up to parent rows or cards (e.g. unintentionally triggering a parent row's `router.push`):

```typescript
vi.mock("@/components/modals/confirm-modal", () => ({
  ConfirmModal: ({ children, onConfirm }: any) => (
    <div onClick={(e) => e.stopPropagation()}>
      {children}
      <button onClick={(e) => { e.stopPropagation(); onConfirm(); }}>
        Confirm
      </button>
    </div>
  ),
}));
```

### Headless UI Dialog / Transition exit animations in jsdom

Headless UI `<Transition show={isOpen}>` leaves the component in the DOM during exit transitions. In jsdom, transition completion events do not fire automatically. Synchronously asserting `expect(screen.queryByText(...)).not.toBeInTheDocument()` after `rerender(<Modal isOpen={false} />)` will fail because the leaving node remains mounted.

- **Recommended**: Test the closed state on an initial mount (`render(<Modal isOpen={false} ... />); expect(...).not.toBeInTheDocument()`), and test the open state in a separate render.
- Alternatively, wait for removal using `await waitFor(() => expect(screen.queryByText(...)).not.toBeInTheDocument())`.

### Avoiding nested button collision in wrapper mocks (e.g. CldUploadButton)

When partially mocking wrapper components that render children buttons (such as `CldUploadButton` wrapping a `<Button>Change</Button>`), returning `<button onClick=...>{children}</button>` creates nested `<button><button>Change</button></button>` elements. This causes `screen.getByRole("button", { name: "Change" })` to fail with `"Found multiple elements with the role button"`.

```typescript
// ✅ Correct: Use a non-button container to preserve child button role
vi.mock("next-cloudinary", () => ({
  CldUploadButton: ({ children, onSuccess }: any) => (
    <div
      role="none"
      onClick={() => onSuccess({ info: { secure_url: "https://example.com/img.png" } })}
    >
      {children}
    </div>
  ),
}));
```

### Spinner and loader element queries

Libraries like `react-spinners` (`ClipLoader`, `PulseLoader`) render `<span>` elements styled with CSS borders and keyframes, NOT `<svg>` icons. Asserting `expect(container.querySelector("svg")).toBeInTheDocument()` fails; assert on container class, role, or `span` presence instead.

### Radix UI / Base UI / Dialog Portal act(...) warnings

When interacting with components containing Dialogs, Popovers, Dropdowns, or dropzones (e.g. Radix UI, Base UI), clicking triggers or dropping files initiates asynchronous state transitions and portal mounting effects. Synchronous `fireEvent` calls queue microtasks that update React state after the event finishes, causing:
`stderr | An update to DialogPortal / MenuTrigger inside a test was not wrapped in act(...)`

To eliminate these warnings:
1. Wrap interactions that open/close portals or trigger file readers in `await act(async () => ...)`:
```typescript
await act(async () => {
  fireEvent.click(screen.getByRole("button", { name: /settings/i }));
});
```
2. Or use `@testing-library/user-event` (`const user = userEvent.setup(); await user.click(button);`), which handles `act` flushing automatically.
3. Always wait for dialog visibility or state changes to settle using `await waitFor(...)`:
```typescript
await waitFor(() => {
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
```

## Red Flags

- Using `container.querySelector` instead of `screen.getBy*` — breaks multi-root queries
- Index-based element queries (`getAllByRole("button")[1]`) instead of accessible names or icons
- Direct `.className` inspection on SVG elements (`SVGAnimatedString` in jsdom)
- Modal/dialog mock wrappers that allow click events to bubble to parent container handlers
- Dropping static compound subcomponents (`Component.Skeleton`) when mocking components
- Asserting on CSS classes as primary assertion — classes can change; roles/text are stable
- Missing `beforeEach` cleanup — leftover mocks leak between tests
- Not mocking child components that have side effects — causes import-time crashes
- Testing implementation details (state shape, internal refs) instead of observable output
