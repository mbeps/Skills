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

### React 19 Removed APIs
- `defaultProps` on functional components is removed. Use ES6 default parameters.
- `useFormState` in `react-dom` is deprecated/removed in favor of `useActionState` in `react`.
- Implicit `children` in `React.FC` is removed. Explicitly type props with `React.PropsWithChildren<T>`.

---

## 5. UI & Utility Libraries Intercompatibility

- **`@base-ui/react`**: Check for breaking prop or accessibility attribute changes (e.g. `dir` removals, popup timing changes). Minor/patch updates are drop-in replacements.
- **`framer-motion` / `motion`**: Rebranded from `framer-motion` to `motion`. When upgrading within `framer-motion@13.x`, standard `<motion.div>` props remain compatible. Avoid CSS-in-JS prop-forwarding dependencies without explicit `MotionConfig`.
- **`nuqs`**: Ensure type adapters match Next.js App Router (`import { NuqsAdapter } from "nuqs/adapters/next/app"`).
- **`katex`**: Use `katex.renderToString(expr, options)` with standard options (`throwOnError: false`, `output: "html"`).
- **`sharp`**: Keep sharp synchronized with Next.js built-in image optimization requirements.

