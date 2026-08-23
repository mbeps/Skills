# Vitest Configuration for Next.js

## package.json scripts

| Script          | Command                 | Use                                 |
| --------------- | ----------------------- | ----------------------------------- |
| `test`          | `vitest run`            | CI — run once, exit code on failure |
| `test:watch`    | `vitest`                | Watch mode during development       |
| `test:coverage` | `vitest run --coverage` | Coverage report + threshold gate    |

Dev dependencies (TS projects): `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event vite-tsconfig-paths @vitest/coverage-v8`.

## vitest.config.ts

Full example, verified working in a Next.js 16 project:

```typescript
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "__tests__/**/*.test.{ts,tsx}",
      "lib/actions/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      exclude: [
        "prisma/**",
        "**/node_modules/**",
        "**/.next/**",
        "**/migrations/**",
        "app/**",
        "components/**",
        "types/**",
        "scripts/**",
        "proxy.ts",
        "models.ts",
        "lib/env.ts",
        "lib/auth/auth.ts",
        "lib/auth/client.ts",
      ],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
```

Key points:

- `defineConfig` comes from `vitest/config` (not `vite`).
- Vite-level options (`plugins`, `resolve.alias`) live at the config root, **not** inside `test`.
- `@vitejs/plugin-react` enables JSX in `.tsx` tests; `vite-tsconfig-paths` resolves tsconfig path aliases (the `@` alias is then configured twice — harmless).
- `globals: true` — `describe`/`it`/`expect`/`vi` without imports; also enables Testing Library auto-cleanup.
- `setupFiles` runs before every test file in the same process (unlike `globalSetup`, which runs once in a separate scope).
- `include` controls which test files run; `coverage.exclude` is separate from `test.exclude` — a file can be excluded from coverage but still run.
- Excluding UI dirs (`app/**`, `components/**`) keeps thresholds reachable; logic layers (actions, lib, schemas) carry the 80% bar.
- Exclude `lib/env.ts` from coverage — it throws on missing vars at import time (it is mocked in every test file anyway).
- Positive thresholds = minimum percentages; the run **fails** below them. **Branches is the hardest** (every `if`/ternary/`??` needs both sides exercised).

## vitest.setup.ts

```typescript
import "@testing-library/jest-dom/vitest";
```

- The `/vitest` suffix is **required** — the bare import is the Jest entry and silently does nothing here.
- Provides DOM matchers: `toBeInTheDocument`, `toBeVisible`, `toHaveTextContent`, etc.
- With `globals: true` this is the whole setup file; Testing Library registers its own `afterEach` DOM cleanup.

## Per-file environment override

jsdom is the default. For pure Node code (networking, crypto, streams, fake-timer logic), put this comment as the **first line** of the file:

```typescript
// @vitest-environment node
```

Use for DNS guards, timeout helpers, or crypto utils that never touch the DOM.

## jsdom gotchas

- `window.matchMedia` is **not implemented** in jsdom — code calling it throws. Stub it (verified pattern):

```typescript
window.matchMedia = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});
```

- `window.innerWidth` is a read-only getter in jsdom — shadow it with `defineProperty`:

```typescript
Object.defineProperty(window, "innerWidth", {
  writable: true,
  configurable: true,
  value: 375, // mobile width
});
```

### window.matchMedia stubbing

For hooks that depend on viewport size (`useIsMobile`), override both `innerWidth` and `matchMedia`:

```typescript
Object.defineProperty(window, "innerWidth", {
  writable: true,
  configurable: true,
  value: 1024, // or 500 for mobile tests
});

window.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: query.includes("(max-width: 767px)") ? false : true,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
```

This works because jsdom does not implement `window.matchMedia`. The mock inspects the query string to return appropriate `matches` values.

- React 19 logs `console.warn` (React 18: `console.error`) for state updates outside `act` — wrap async work in `await act(async () => ...)`.
- jsdom has no layout engine; offset/geometry reads return 0.
- `tsconfig.json` typically excludes `__tests__/**` and the Vitest config — tests are transformed by Vitest, not type-checked by `next build`.

## Vitest 5 (upcoming — note only)

- `vi.mock` calls must sit at file top level, not inside `describe` (opt-in in v4, enforced in v5).
- `clearMocks` defaults to `true` (revert with `test: { clearMocks: false }`).
- `test.workspace` renamed to `test.projects`.
