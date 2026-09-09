# Next.js, TypeScript & React Intercompatibility Reference

This reference outlines version alignment rules, compiler architectural constraints, and dependency compatibility across Next.js, TypeScript, React 19, and Node.js LTS.

---

## 1. TypeScript Version Compatibility (TS 6 vs TS 7)

### Compiler Architecture Shift
- **TypeScript 7.0+ Architecture**: TypeScript 7.0 is a complete rewrite in Go designed for native compilation speed (5x–12x faster).
- **JavaScript Compiler API Shift**: TypeScript 7 drops legacy JavaScript AST compiler APIs (`lib/typescript.js`), retaining standard CLI compiler binary and type checking.

### Resolution Protocol
| Toolchain / Scenario               | Recommended Strategy                                                                                                                                                         | Rationale                                                                                                                                                     |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Next.js 16+ with Biome**         | **Upgrade to TypeScript 7.x** (`typescript@^7.0.x`)                                                                                                                          | Next.js 16+ with Turbopack and Biome fully supports TS 7 CLI type checking (`tsc --noEmit`) with massive performance gains and zero AST plugin blockers.      |
| **Legacy ESLint with AST Plugins** | **Pin to TypeScript 6.x** (`typescript@^6.0.x`)                                                                                                                              | Legacy ESLint plugins (e.g. `@typescript-eslint` v7/v8 rules calling `lib/typescript.js`) fail on TS 7. Pin to TS 6 until plugins migrate or switch to Biome. |
| **Strict No-Hack Rule**            | Do **not** use hacky workarounds (e.g. side-by-side package aliasing `npm:@typescript/typescript6` alongside `@typescript/native`) unless officially documented as standard. | Ensures clean, maintainable dependency trees.                                                                                                                 |

### Compiler Options Modernization (TS 7.0)
- **`baseUrl` Removal**: In TypeScript 7.0, `baseUrl` is removed (`error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration`). Remove `"baseUrl": "."` and declare root-relative paths directly (`"paths": { "@/*": ["./*"] }`).
- **Side-Effect Imports (`TS2882`)**: TypeScript 6.0 and 7.0 enable `noUncheckedSideEffectImports` by default, triggering `error TS2882: Cannot find module or type declarations for side-effect import of './globals.css'`. Declare ambient module types in a root declaration file (e.g. `global.d.ts` with `declare module "*.css";`) rather than relaxing compiler checks.

---

## 2. Next.js `tsconfig.json` Scope & Test Exclusion

During `next build`, Next.js automatically invokes TypeScript type-checking using the root `tsconfig.json`.

### Best Practices:
1. **Exclude Test Files from Production Build Config**:
   ```json
   {
     "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
     "exclude": ["node_modules", "tmp", "__tests__", "tests", "coverage"]
   }
   ```
2. **Dedicated Test Type Config (`tsconfig.test.json`)**:
   If test-specific types (e.g. `vitest/globals`, `@testing-library/jest-dom`) or loose mock signatures are needed, isolate them into `tsconfig.test.json` so test mock declarations never block production application builds.
3. **Vitest / Vite Path Resolution with Excluded Tests**:
   When test folders (`__tests__`) are excluded from `tsconfig.json`, plugins like `vite-tsconfig-paths` may skip path mappings inside test files. Always configure explicit alias fallback in `vitest.config.ts`:
   ```typescript
   resolve: {
     alias: {
       "@": path.resolve(__dirname, "./"),
     },
   }
   ```

---

## 3. Node.js LTS Alignment & Engine Constraints

### Node.js Release Cycle & Target Synchronization
- Always target active LTS versions of Node.js (e.g., Node 24 LTS, Node 26 LTS).
- Never upgrade `@types/node` past the target Node.js runtime version configured for production deployments.

### Synchronization Rules
1. **Engine Field**: Check `package.json` -> `engines.node`.
2. **Environment Files**: Check `.nvmrc`, `.node-version`, Dockerfile base images (`FROM node:26-alpine`), and CI workflow files (`.github/workflows/*.yml`).
3. **Type Pinning**: Match `@types/node` major version to the lowest supported runtime major:
   ```json
   {
     "engines": {
       "node": ">=26.0.0"
     },
     "devDependencies": {
       "@types/node": "^26.4.0"
     }
   }
   ```
4. **Third-Party Engine Constraints & Resolution Protocol (e.g., `jsdom@30`)**:
   - Some major package updates enforce strict Node engine ranges (e.g. `jsdom@30.0.1` requires `^22.22.2 || ^24.15.0 || >=26.0.0`).
   - **Resolution Path A (Upgrade Host Node)**: If `@types/node` and deployment infrastructure target a newer LTS (e.g. Node 26), upgrade the local/CI Node runtime via NVM (`nvm install 26 && nvm alias default 26`) to unlock the latest package majors cleanly.
   - **Resolution Path B (Pin to Prior Major)**: If the host environment cannot be upgraded, pin the package to the latest release of the previous major (e.g. `jsdom@29.1.1`). **Never** bypass engine validation with `--ignore-engines`.

---

## 4. React 19 & Next.js App Router Compatibility

### Async Route Parameters (Next.js 15 & 16)
In modern Next.js App Router, dynamic route parameters and search parameters in Server Components are Promises:

```typescript
// app/projects/[projectKey]/page.tsx
type PageProps = {
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { projectKey } = await params;
  const query = await searchParams;

  return <div>Project: {projectKey}</div>;
}
```

### React 19 Removed APIs & Type Shifts
- `defaultProps` on functional components is removed. Use ES6 default parameters.
- `useFormState` in `react-dom` is deprecated/removed in favor of `useActionState` in `react`.
- Implicit `children` in `React.FC` is removed. Explicitly type props with `React.PropsWithChildren<T>`.
- `useRef<T>(null)` returns `RefObject<T | null>` (not `RefObject<T>`). Update component props typed as `RefObject<T>` to `RefObject<T | null>`.

---

## 5. UI & Utility Libraries Intercompatibility

- **`vitest@5.x`**: Vitest 5 unbundles Vite. In Next.js projects (which use Turbopack/Webpack), add `vite` (`^6.4.0 || ^7.0.0 || ^8.0.0`) as an explicit `devDependency` to prevent `ERR_MODULE_NOT_FOUND`.
- **`@base-ui/react`**: Check for breaking prop or accessibility attribute changes (e.g. `dir` removals, popup timing changes). Minor/patch updates are drop-in replacements.
- **`prosemirror-*` & Rich Text Editors (`@blocknote/*`, `@tiptap/*`)**: `@blocknote/core@0.54.0+` requires `prosemirror-transform@^1.12.0` (providing `Transform.prototype.changedRange`). When older transitive dependencies request loose ranges, package managers hoist older versions (e.g. `1.10.5`) to root and nest newer versions, causing runtime `TypeError: tr.changedRange is not a function` and dual-instance `prosemirror-model` warnings. Unify versions via `"resolutions"` (Yarn) or `"overrides"` (npm/pnpm) and prune unreferenced direct dependencies.
- **`@clerk/nextjs` (v6 to v7)**: Props like `afterSignOutUrl` on `<UserButton />` are removed in v7. Configure redirect URLs globally in `<ClerkProvider>` or rely on `<UserButton />` default redirection.
- **`react-day-picker` (v9 vs v10 with shadcn/ui)**: `react-day-picker@10` dropped `getDefaultClassNames` and `DayButton`, which are foundational to shadcn/ui `components/ui/calendar.tsx`. Pin to the latest v9 release (`react-day-picker@^9.14.0`) until the calendar component is explicitly rewritten for v10.
- **`framer-motion` / `motion`**: Rebranded from `framer-motion` to `motion`. When upgrading within `framer-motion@13.x`, standard `<motion.div>` props remain compatible. Avoid CSS-in-JS prop-forwarding dependencies without explicit `MotionConfig`.
- **`nuqs`**: Ensure type adapters match Next.js App Router (`import { NuqsAdapter } from "nuqs/adapters/next/app"`).
- **`katex`**: Use `katex.renderToString(expr, options)` with standard options (`throwOnError: false`, `output: "html"`).
- **`sharp`**: Keep sharp synchronized with Next.js built-in image optimization requirements.
- **`better-auth@1.7.x`**: Requires `drizzle-orm@^0.45.2`. Audits database schemas during build/boot; if plugin columns are missing (e.g. `twoFactor.verified`, `twoFactor.failedVerificationCount`, `invitation.createdAt`), run `npx auth generate` (`--yes`) and synchronize table definitions. For database-backed sessions, remove deprecated `session.cookieCache.refreshCache: true` (intended only for stateless setups). On the client SDK, `authClient.unlinkAccount` expects `{ accountId }` without `providerId`, and `authClient.twoFactor.enable` returns a union requiring type narrowing (`"totpURI" in result.data`). On MongoDB adapters, assign `@default([])` to scalar list fields (e.g. `conversationIds String[] @default([])`) in `schema.prisma` to prevent required-column mismatch warnings during user insert.
- **`prisma` & `@prisma/client` (v6 vs v7 MongoDB Constraint)**: Prisma 7 removed the embedded binary query engine for relational driver adapters and dropped MongoDB support. Projects using MongoDB must remain pinned to the latest stable 6.x release (`prisma@^6.19.x` and `@prisma/client@^6.19.x`). Verify both CLI and client share identical versions, as `prisma` npm dist-tag `latest` may occasionally point to pre-release RCs (e.g. `8.0.0-rc.x`).
- **`@hookform/resolvers@5` & `zod@4` Type Alignment**: In `@hookform/resolvers@5`, `zodResolver(Schema)` returns `Resolver<z.infer<typeof Schema>>`. Avoid typing form instances as `useForm<FieldValues>()`, which causes `TS2322` when schemas contain required properties; use `useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema) })` (or omit type argument for automatic inference). In reusable input wrapper components, broaden the `register` prop to `UseFormRegister<any>` or `UseFormRegister<TFieldValues extends FieldValues>` to avoid strict variance conflicts across distinct form schemas.
- **`zod@4` Error Message Schema Assertion Shift**: Zod 4 changed the default error message for missing string fields from `"Required"` (Zod 3) to `"Invalid input: expected string, received undefined"`. Update unit test assertions inspecting raw Zod issue messages to match.
- **`bcryptjs@3.x` Native Types**: `bcryptjs@3` ships built-in TypeScript declarations with zero dependencies. Remove the deprecated DefinitelyTyped stub `@types/bcryptjs`.
- **`lucide-react@1.x`**: Dropped trademarked brand icons (e.g. GitHub, Discord, Slack) and legacy UMD builds, significantly reducing bundle size. Migrate brand icons to inline SVGs or Simple Icons.
- **`postmark@5.x`**: Rewritten on native Fetch API with zero runtime dependencies and minimum Node.js `>=18.0.0`. Core `ServerClient.sendEmail(...)` signatures remain backward-compatible.


