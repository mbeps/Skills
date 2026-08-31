# Next.js, TypeScript & React Intercompatibility Reference

This reference outlines version alignment rules, compiler architectural constraints, and dependency compatibility across Next.js, TypeScript, React 19, and Node.js LTS.

---

## 1. TypeScript Version Compatibility (TS 6 vs TS 7)

### Compiler Architecture Shift
- **TypeScript 7.0+ Architecture**: TypeScript 7.0 is a complete rewrite in Go designed for native compilation speed (8x–12x faster).
- **Dropped JavaScript Compiler API (`lib/typescript.js`)**: TypeScript 7 no longer ships the legacy JavaScript compiler API entrypoints.
- **Next.js Dependency on JS Compiler API**:
  - Next.js (versions 15.x and 16.x) utilizes the JavaScript Compiler API internally for in-process type-checking during `next build`, evaluating TypeScript configurations (`next.config.ts`), and generating route type definitions (`.next/types`).
  - Attempting to use `typescript@^7.0` directly with standard Next.js build pipelines causes missing module errors (`Cannot find module 'typescript/lib/typescript.js'`) or broken in-process type checks.

### Resolution Protocol
| Scenario                     | Recommended Strategy                                                                                                                                                                                                     |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Standard Next.js Project** | **Pin to TypeScript 6.x** (`typescript@^6.0.x`). This is the latest stable major version compatible with Next.js's in-process compiler.                                                                                  |
| **Strict No-Hack Rule**      | Do **not** use hacky workarounds (e.g. side-by-side package aliasing `npm:@typescript/typescript6` alongside `@typescript/native`, or unstable experimental flags) unless officially documented as the standard pattern. |
| **TypeScript 7 Standalone**  | Only adopt TS 7 if type-checking is fully decoupled from the Next.js build lifecycle (e.g., `tsc --noEmit` standalone CLI in CI, with Next.js build type-checking bypassed).                                             |

---

## 2. Node.js LTS Alignment & `@types/node` Pinning

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
     "dependencies": {
       "@types/node": "^26.4.0"
     }
   }
   ```

---

## 3. React 19 & Next.js App Router Compatibility

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

## 4. UI & Utility Libraries Intercompatibility

- **`@base-ui/react`**: Check for breaking prop or accessibility attribute changes (e.g. `dir` removals, popup timing changes). Minor/patch updates are drop-in replacements.
- **`framer-motion` / `motion`**: Rebranded from `framer-motion` to `motion`. When upgrading within `framer-motion@13.x`, standard `<motion.div>` props remain compatible. Avoid CSS-in-JS prop-forwarding dependencies without explicit `MotionConfig`.
- **`nuqs`**: Ensure type adapters match Next.js App Router (`import { NuqsAdapter } from "nuqs/adapters/next/app"`).
- **`katex`**: Use `katex.renderToString(expr, options)` with standard options (`throwOnError: false`, `output: "html"`).
- **`sharp`**: Keep sharp synchronized with Next.js built-in image optimization requirements.

