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
    testTimeout: 15000,
  },
});
```

Key points:

- `defineConfig` comes from `vitest/config` (not `vite`).
- Vite-level options (`plugins`, `resolve.alias`) live at the config root, **not** inside `test`.
- `testTimeout: 15000` prevents false-positive timeouts when running full suites under parallel V8 coverage collection.
- `@vitejs/plugin-react` enables JSX in `.tsx` tests; `vite-tsconfig-paths` resolves tsconfig path aliases. **Crucial**: when `__tests__` is excluded in `tsconfig.json` to keep `next build` clean, `vite-tsconfig-paths` will ignore path mapping for files inside `__tests__`. You MUST define `resolve.alias: { "@": path.resolve(__dirname, ".") }` in `vitest.config.ts` so imports resolve regardless of `tsconfig.json` exclusions.
- `globals: true` — `describe`/`it`/`expect`/`vi` without imports; also enables Testing Library auto-cleanup.
- `setupFiles` runs before every test file in the same process (unlike `globalSetup`, which runs once in a separate scope).
- `include` controls which test files run; `coverage.exclude` is separate from `test.exclude` — a file can be excluded from coverage but still run.
- Excluding UI dirs (`app/**`, `components/**`) keeps thresholds reachable; logic layers (actions, lib, schemas) carry the 80% bar.
- Exclude `lib/env.ts` from coverage — it throws on missing vars at import time (it is mocked in every test file anyway).
- Positive thresholds = minimum percentages; the run **fails** below them. **Branches is the hardest** (every `if`/ternary/`??` needs both sides exercised).

## vitest.setup.ts

```typescript
import "@testing-library/jest-dom/vitest";

// Stub ResizeObserver for cmdk, Base UI, Radix modals/popovers
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Stub scrollIntoView called by cmdk/listbox focus management
Element.prototype.scrollIntoView = vi.fn();
HTMLElement.prototype.scrollIntoView = vi.fn();
```

- The `/vitest` suffix is **required** — the bare import is the Jest entry and silently does nothing here.
- Provides DOM matchers: `toBeInTheDocument`, `toBeVisible`, `toHaveTextContent`, etc.
- With `globals: true`, Testing Library registers its own `afterEach` DOM cleanup.

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

- `ResizeObserver` is undefined in jsdom — components using `cmdk`, Base UI, or Radix throw `ReferenceError: ResizeObserver is not defined`. Stub in setup file.
- `scrollIntoView` is undefined in jsdom — focus-managed listboxes (`cmdk`) throw `TypeError: ...scrollIntoView is not a function` on mount/navigation. Stub both `Element` and `HTMLElement` prototypes.
- React 19 logs `console.warn` (React 18: `console.error`) for state updates outside `act` — wrap async work in `await act(async () => ...)`.
- jsdom has no layout engine; offset/geometry reads return 0.

## TypeScript, Linter & IDE Integration

Tests are transformed and executed by Vitest/Vite directly, not by `next build` or production linters. Exclude tests from production compilation and linting to avoid false failures and editor noise:

### 1. tsconfig.json — Exclude Tests from Next.js Build
In `tsconfig.json`, add test files and configs to `exclude`:
```json
"exclude": [
  "node_modules",
  "__tests__",
  "tests",
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "vitest.config.mts",
  "vitest.setup.ts"
]
```
`next build` and root `tsc --noEmit` will skip tests, speeding up builds and preventing test assertions from failing production compilation.

### 2. Linter Ignore (Biome & ESLint)
- **Biome (`biome.json`)**: Add test patterns to `files.includes`. In Biome 2.2+, folder ignores use `!__tests__` without trailing `/**`:
```json
"files": {
  "includes": [
    "**",
    "!node_modules",
    "!__tests__",
    "!tests",
    "!**/*.test.*",
    "!**/*.spec.*",
    "!vitest.config.*",
    "!vitest.setup.*"
  ]
}
```
- **ESLint (`eslint.config.mjs`)**: Use `globalIgnores(["__tests__/**", "tests/**", "**/*.test.*"])`.

### 3. VS Code — Suppress Unwanted Diagnostics in Tests
To prevent VS Code from background-scanning excluded or non-project test files into the Problems panel:
```json
// .vscode/settings.json
{
  "js/ts.tsserver.experimental.enableProjectDiagnostics": false
}
```
*(Note: `typescript.tsserver.experimental.enableProjectDiagnostics` is deprecated; use `js/ts.tsserver.experimental.enableProjectDiagnostics`)*.

### 4. Stale Next.js Route Cache Invalidation (`.next/types/validator.ts`)
When restructuring route files (e.g., removing route groups like `(routes)`, moving page routes, or updating route folders), Next.js's generated `.next/types/validator.ts` holds onto deleted file paths. Running `tsc --noEmit` will fail with:
```
.next/types/validator.ts: error TS2307: Cannot find module '../../app/(routes)/.../page.js'
```
Even if all tests and code are correct, stale cached validators fail TypeScript checks. **Action**: run `rm -rf .next` before running `tsc --noEmit` or `next build` after any route directory structure changes.

## Vitest 5 (upcoming — note only)

- `vi.mock` calls must sit at file top level, not inside `describe` (opt-in in v4, enforced in v5).
- `clearMocks` defaults to `true` (revert with `test: { clearMocks: false }`).
- `test.workspace` renamed to `test.projects`.
