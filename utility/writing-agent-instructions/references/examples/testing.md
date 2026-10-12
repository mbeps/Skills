# Example: `.agents/testing.md`

Below is a canonical example of `.agents/testing.md` for a full-stack Next.js web application:

```markdown
---
description: Load when writing, running, or mocking unit, integration, or E2E tests in the Next.js AI chat client.
applyTo: '**/*.test.ts, **/*.test.tsx, **/*.spec.ts, **/*.spec.tsx'
---

# Testing Conventions & Guidelines

## 1. Skills
Follow these skills as the single source of truth for general testing patterns:
- `writing-nextjs-vitest-tests` — Primary reference for Vitest + jsdom setup, hoisting rules (`vi.hoisted`), module graph pre-import mocking (env/db/auth), Next.js runtime mocks (`next/navigation`, `next/headers`, `next/cache`), chainable query builders, and component testing.
- `tdd` & `test-driven-development` — Red-green-refactor loop before writing production code.
- `playwright-skill` — End-to-end browser automation workflows.
- `systematic-debugging` — Diagnosing test runner failures or flaky assertions.
- `verification-before-completion` — Running test suites to verify passing behaviour before finishing.

## 2. Project-Specific Test Setup & Commands
- **Test Commands**:
  - `pnpm test` (`vitest run`): Run full test suite once.
  - `pnpm test:watch` (`vitest`): Interactive test runner.
  - `pnpm test:coverage` (`vitest run --coverage`): Run tests with V8 coverage report.
- **Directory Layout**:
  - Mirrored test suites live in `__tests__/` matching source structure (e.g. `__tests__/actions/`, `__tests__/lib/`).
  - Server action tests also match `lib/actions/**/*.test.{ts,tsx}`.
- **Global Setup (`./vitest.setup.ts`)**:
  - Automatically injects fallback environment variables for test execution (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `S3_*`, `INNGEST_*`).
  - Stubs missing browser globals in `jsdom` (`ResizeObserver`, `window.matchMedia`).
  - Pre-configures global spies for Inngest (`inngest.send` and `inngest.realtime.publish`) in `beforeEach`.

## 3. Project-Specific Mocking Overrides & Gotchas
- **Better Auth Mocking**:
  - For middleware/proxy tests: Mock `@/lib/auth/auth` with `{ auth: { api: { getSession: vi.fn() } } }`.
  - For server actions: Mock `@/lib/auth/require-session` (`requireSession`) rather than drilling into deep auth internals.
- **LogTape Logger Mocking**:
  - When mocking `@/lib/logger`, use dual mock exports: `{ getLogger: vi.fn(() => mockLog), logger: mockLog }` so both domain-scoped `getLogger(["app", ...])` and facade `logger` succeed.
- **Drizzle Query Mock Decoupling**:
  - When a tested action performs both `db.update` and `db.select`, decouple update mocks (`mockUpdateWhere`) from select mocks (`mockSelectWhere`) to avoid queue contention on chained `.where()` calls.

## 4. Coverage Thresholds
- `vitest.config.ts` enforces 80% thresholds across statements, branches, functions, and lines on tested modules.
```

