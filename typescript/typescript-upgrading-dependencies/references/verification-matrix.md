# Multi-Gate Verification & Diagnostics Reference

This document provides the standard multi-gate verification matrix to guarantee that dependency upgrades introduce zero runtime regressions, type errors, lint warnings, or broken builds.

---

## 1. Multi-Gate Verification Matrix

All gates must pass sequentially before declaring an upgrade complete.

| Gate                                 | Verification Goal                                            | Standard Command                               | Success Criteria                                                                                                        |
| :----------------------------------- | :----------------------------------------------------------- | :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Gate 1: Type Safety**              | Zero TypeScript compilation errors                           | `pnpm tsc --noEmit` or `yarn tsc --noEmit`     | Exit code 0, 0 type errors                                                                                              |
| **Gate 2: Code Quality & Linting**   | Strict compliance with zero warnings (Biome or ESLint)       | `biome check .` or `eslint . --max-warnings=0` | Exit code 0, 0 warnings, 0 errors                                                                                       |
| **Gate 3: Unit & Integration Tests** | Full test suite execution                                    | `vitest run` or `jest`                         | Exit code 0, 100% test suites passed                                                                                    |
| **Gate 4: Test Coverage**            | Regressions prevented across statements, branches, and lines | `vitest run --coverage`                        | Meets configured thresholds (e.g. >= 80% or 100%)                                                                       |
| **Gate 5: Production Build & SSG**   | Turbopack/Webpack compilation & Static Page Generation       | `next build --turbopack` (or `--turbo`)        | Exit code 0, all static & dynamic routes compiled                                                                       |
| **Gate 6: Outdated Verification**    | Confirm only intentionally pinned major versions remain      | `yarn outdated` or `pnpm outdated`             | Clean manifest with documented exemptions (yarn outdated returns code 1 if packages are outdated, code 0 if 100% clean) |

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

### Scenario D: Vitest 5 Unmet Peer Dependency (`vite`)
- **Symptom**: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite' imported from .../vitest/...` or warning about unmet peer dependency `vite@^6.0.0 || ^7.0.0 || ^8.0.0`.
- **Cause**: Vitest 5 unbundled Vite; non-Vite applications (e.g. Next.js with Turbopack) do not automatically have Vite in `node_modules`.
- **Resolution**: Add `vite` (`^8.2.2` or supported range) directly to `devDependencies`.

### Scenario E: Static Page Generation (SSG) Route Param Errors
- **Symptom**: Build fails at `Generating static pages (X/Y)` with `TypeError: Cannot read properties of undefined`.
- **Cause**: `generateStaticParams` return shape changed or dynamic route param Promises were not awaited.
- **Resolution**: Check the route component and ensure all `params` and `searchParams` are awaited in Next.js 15/16 App Router.

### Scenario F: TypeScript 7 Removed `baseUrl` Option
- **Symptom**: `tsconfig.json:X:Y - error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.`
- **Cause**: TypeScript 7.0 dropped the legacy `baseUrl` option in favor of standard root-relative `"paths"`.
- **Resolution**: Remove `"baseUrl": "."` from `tsconfig.json` and declare root-relative paths directly (e.g. `"paths": { "@/*": ["./*"] }`). Ensure `vitest.config.ts` includes `resolve.alias` if test directories are excluded from `tsconfig.json`.

### Scenario G: Yarn Outdated Non-Zero Exit Code on Pinned Packages
- **Symptom**: `yarn outdated` exits with status code 1 even though all planned upgrades were completed.
- **Cause**: Yarn exits with code 1 by design whenever any outdated dependency exists in the output.
- **Resolution**: Review output packages. If only intentionally pinned versions remain (e.g., `@types/node` pinned to match an older LTS), the check passes. An exit code of 0 confirms 0 outdated packages.

### Scenario H: Runtime Prototype / Singleton Mismatch (`e.changedRange is not a function`)
- **Symptom**: `TypeError: ... is not a function` (e.g. `e.changedRange is not a function`) or `[tiptap warn]: prosemirror-model is loaded more than once` on page mount, despite unit tests passing 100%.
- **Cause**: Unit tests completely mocked the component (`vi.mock`), masking runtime failures. The package manager hoisted an older transitive version of a singleton library to root while nesting the newer version.
- **Resolution**: Add `"resolutions"` (Yarn) or `"overrides"` (npm/pnpm) in `package.json` to enforce unified modern versions, prune unreferenced direct dependencies, and add an unmocked integration test (e.g. `BlockNoteEditor.create()`).

### Scenario I: Git Index Truncation During Intensive Package / Test Operations
- **Symptom**: `fatal: .git/index: index file smaller than expected`.
- **Cause**: `.git/index` truncated to 0 bytes by concurrent process I/O or sandbox synchronization during heavy package updates.
- **Resolution**: Run `rm .git/index && git reset` unsandboxed to safely reconstruct `.git/index` from HEAD without losing uncommitted working tree changes.

### Scenario J: Newly Published Major Version Verification
- **Symptom**: `yarn outdated` shows a new major version, but web search engines or AI models report that the version is unreleased or in alpha.
- **Cause**: Web indexes and model training data lag behind real-time package registry publishes.
- **Resolution**: Query `npm view <pkg> dist-tags` and `npm view <pkg> time` to verify the actual published version and release time. Read official release notes or raw repository migration guides via curl (`https://raw.githubusercontent.com/<owner>/<repo>/...`) before making upgrade decisions.

### Scenario K: Prisma 7 Driver Adapter & MongoDB Incompatibility
- **Symptom**: Prisma client generation fails, or runtime errors indicate missing SQL driver adapters or unsupported datasource provider `mongodb`.
- **Cause**: Prisma 7 dropped the embedded binary query engine and removed MongoDB support.
- **Resolution**: Retain the latest release of the 6.x line (`prisma@^6.19.x` and `@prisma/client@^6.19.x`). Verify both packages match, as `prisma` CLI dist-tags may publish pre-release RCs under `latest`.

### Scenario L: React Hook Form TS2322 Type Incompatibility with ZodResolver
- **Symptom**: `error TS2322: Type 'Resolver<...>' is not assignable to type 'Resolver<FieldValues, any, FieldValues>'` when passing `resolver: zodResolver(Schema)` to `useForm<FieldValues>()`.
- **Cause**: In `@hookform/resolvers@5` with React Hook Form 7, `zodResolver(Schema)` returns a typed resolver `Resolver<z.infer<typeof Schema>>`, which is incompatible with unconstrained `FieldValues` (`Record<string, any>`) when the schema has required fields.
- **Resolution**: Type the form hook with the schema type (`useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema) })`) or omit the type argument for automatic inference. For reusable form components (e.g. `<Input />`), type the `register` prop as `UseFormRegister<any>` or use a generic `UseFormRegister<TFieldValues>`.



