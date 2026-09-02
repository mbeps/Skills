# Multi-Gate Verification & Diagnostics Reference

This document provides the standard multi-gate verification matrix to guarantee that dependency upgrades introduce zero runtime regressions, type errors, lint warnings, or broken builds.

---

## 1. Multi-Gate Verification Matrix

All gates must pass sequentially before declaring an upgrade complete.

| Gate                                 | Verification Goal                                            | Standard Command                               | Success Criteria                                  |
| :----------------------------------- | :----------------------------------------------------------- | :--------------------------------------------- | :------------------------------------------------ |
| **Gate 1: Type Safety**              | Zero TypeScript compilation errors                           | `pnpm tsc --noEmit` or `yarn tsc --noEmit`     | Exit code 0, 0 type errors                        |
| **Gate 2: Code Quality & Linting**   | Strict compliance with zero warnings (Biome or ESLint)       | `biome check .` or `eslint . --max-warnings=0` | Exit code 0, 0 warnings, 0 errors                 |
| **Gate 3: Unit & Integration Tests** | Full test suite execution                                    | `vitest run` or `jest`                         | Exit code 0, 100% test suites passed              |
| **Gate 4: Test Coverage**            | Regressions prevented across statements, branches, and lines | `vitest run --coverage`                        | Meets configured thresholds (e.g. >= 80% or 100%) |
| **Gate 5: Production Build & SSG**   | Turbopack/Webpack compilation & Static Page Generation       | `next build --turbopack` (or `--turbo`)        | Exit code 0, all static & dynamic routes compiled |
| **Gate 6: Outdated Verification**    | Confirm only intentionally pinned major versions remain      | `yarn outdated` or `pnpm outdated`             | Clean manifest with documented exemptions         |

---

## 2. Common Build & Test Diagnostic Scenarios

### Scenario A: Sandboxed Build Network Block on External Fonts
- **Symptom**: `next/font: error: Failed to fetch Inter from Google Fonts (status 403)`.
- **Cause**: Next.js downloads Google Fonts during production builds. Secure sandboxes without network access block external HTTP requests.
- **Resolution**: Run the build step outside the sandbox (`BypassSandbox: true`) so Next.js can download font assets.

### Scenario B: Test Mocks Failing Next.js Build Type Check
- **Symptom**: `next build` fails during type-checking on `__tests__/**/*.test.ts(x)` (e.g., `vi.fn()` mock call tuple indexing or mock return shapes).
- **Cause**: `tsconfig.json` includes `**/*.ts` without excluding `__tests__`, causing Next.js to type-check test mock files against production compiler options.
- **Resolution**: Exclude test directories in `tsconfig.json` (`"exclude": ["node_modules", "tmp", "__tests__", "tests", "coverage"]`) and let Vitest manage test typing.

### Scenario C: Package Manager Node Engine Rejection
- **Symptom**: `error pkg@X.Y.Z: The engine "node" is incompatible with this module. Expected version "^22.22.2 || ^24.15.0 || >=26.0.0". Got "24.11.1"`.
- **Cause**: Upgrading to a major package version that requires a higher minor/patch Node LTS version than the current host environment.
- **Resolution**: Check host Node version (`node --version`) and pin the dependency to the latest release of the prior major (e.g. `jsdom@29.1.1`) until the runtime environment is upgraded.

### Scenario D: Vitest / Vite Unmet Peer Dependencies
- **Symptom**: `warning "vitest" has unmet peer dependency "vite@^6.0.0 || ^7.0.0"`.
- **Cause**: `vitest` and `vite-tsconfig-paths` specify Vite peer dependencies, but Next.js projects often bundle their own bundler (Turbopack/Webpack).
- **Resolution**: Verify that `vitest run` executes tests cleanly. These warnings are expected in non-Vite Next.js applications unless Vite is explicitly installed as a devDependency.

### Scenario E: Static Page Generation (SSG) Route Param Errors
- **Symptom**: Build fails at `Generating static pages (X/Y)` with `TypeError: Cannot read properties of undefined`.
- **Cause**: `generateStaticParams` return shape changed or dynamic route param Promises were not awaited.
- **Resolution**: Check the route component and ensure all `params` and `searchParams` are awaited in Next.js 15/16 App Router.

