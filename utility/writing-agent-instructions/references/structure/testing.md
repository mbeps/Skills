# Specification: `.agents/testing.md`

Captures project-specific testing setup, runner commands, unique mock overrides, and coverage thresholds. Like conventions, **it is a thin pointer that must NOT duplicate general testing skills** (e.g. `writing-nextjs-vitest-tests`):

---

## File Template

```markdown
---
description: Load when writing, running, or mocking unit, integration, or E2E tests.
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
- **Test Commands**: `pnpm test` (`vitest run`), `pnpm test:watch`, `pnpm test:coverage`.
- **Directory Layout**: Mirrored test suites in `__tests__/` matching source structure; action tests in `lib/actions/**/*.test.{ts,tsx}`.
- **Global Setup (`./vitest.setup.ts`)**: Documents what the setup file handles automatically (fallback env vars, browser stubs, Inngest spies).

## 3. Project-Specific Mocking Overrides & Gotchas
- Document only project-specific mock nuances (e.g. `requireSession` vs `getSession`, dual-mock logger exports, Drizzle query decoupling).

## 4. Coverage Thresholds
- State the project's configured thresholds (e.g. 80% configured in `vitest.config.ts`, aiming for 100% on tested units).
```

