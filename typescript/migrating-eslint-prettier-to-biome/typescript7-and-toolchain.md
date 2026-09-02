# TypeScript 7.0 & Modern Toolchain Reference

Comprehensive guide to TypeScript 7.0 architecture, why it was blocked by legacy ESLint, how Biome provides native support, and integration with Next.js 16 (Turbopack) and Vitest.

---

## 1. TypeScript 7.0 Architecture (Go Rewrite)

TypeScript 7.0 represents a generational compiler rewrite from JavaScript to **Go** (`microsoft/typescript-go`), delivering native AOT-compiled execution.

```
Traditional tsc (TS 5.x / 6.x)                TypeScript 7.0 (Native Go)
┌─────────────────────────────────────┐      ┌───────────────────────────────────┐
│ Node.js V8 Runtime (Single-Thread)  │      │ Native OS Binary (AOT Compiled)   │
│ ┌─────────────────────────────────┐ │      │ ┌───────────────────────────────┐ │
│ │ JavaScript Heap (GC Pauses)     │ │      │ │ Go Goroutines & OS Threads    │ │
│ └─────────────────────────────────┘ │      │ └───────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │      │ ┌───────────────────────────────┐ │
│ │ Sequential AST Traversal        │ │      │ │ Parallel Work-Stealing Pool   │ │
│ └─────────────────────────────────┘ │      │ └───────────────────────────────┘ │
└─────────────────────────────────────┘      └───────────────────────────────────┘
```

### Performance Benchmarks
- **Type Checking Speed**: **8x – 12x faster** cold checks via parallel goroutines.
- **Memory Footprint**: Up to **7x reduction** in peak RAM usage.
- **Startup Latency**: Sub-15ms native execution vs 250ms+ Node.js boot time.

---

## 2. Why ESLint / `@typescript-eslint` Was Blocked on TypeScript 7.0

For over a decade, `@typescript-eslint` depended directly on importing TypeScript as a Node.js JavaScript library to instantiate in-process ASTs and type checkers:

```typescript
// Legacy @typescript-eslint pattern (Broken in TS 7.0)
import ts from "typescript";

const program = ts.createProgram([filePath], compilerOptions);
const checker = program.getTypeChecker();
const type = checker.getTypeAtLocation(node);
```

### The Breakdown:
1. **Loss of In-Process JS Compiler API**: TypeScript 7.0 is distributed as precompiled Go native executables. It dropped the legacy in-process Node.js JavaScript API (`ts.createProgram`, `ts.TypeChecker`).
2. **IPC / Serialization Bottleneck**: Calling Go-native `tsc` over IPC sockets or FFI from single-threaded ESLint incurs severe serialization latency, slowing down linting by 5x-20x.
3. **Fragile Workarounds**: Teams were forced into dual-package aliasing hacks (`typescript@npm:@typescript/typescript6` for ESLint alongside `typescript-7` for building).

---

## 3. How Biome Unblocks TypeScript 7 Cleanly

Biome does **not** import the `typescript` npm package or depend on the TypeScript JS compiler API.

```
                      TypeScript 7 Source Code (.ts / .tsx)
                                      │
                     ┌────────────────┴────────────────┐
                     ▼                                 ▼
         TypeScript 7 Compiler (Go)           Biome Linter & Formatter (Rust)
         ┌─────────────────────────┐         ┌───────────────────────────────┐
         │ • Type Validation       │         │ • biome_js_parser (Rowan CST) │
         │ • .d.ts Generation      │         │ • Semantic Scope Analyzer     │
         │ • Diagnostics & Emit    │         │ • Fast Style & Quality Lints  │
         │ • Multi-core Go Engine  │         │ • Formatting Engine           │
         └─────────────────────────┘         └───────────────────────────────┘
                     │                                 │
                     ▼                                 ▼
             Type-Safe Output                  Clean, Formatted Code
```

### Technical Advantages:
- **Independent Rust Parser (`biome_js_parser`)**: Parses all TypeScript syntax (including decorators, `satisfies`, const generics, `using`) into a fault-tolerant Rowan CST.
- **Internal Semantic Engine**: Handles scope analysis, variable resolution, and dead-code detection directly in Rust.
- **Zero Package Shims**: Removing ESLint allows upgrading `"typescript": "^7.0.0"` directly in `package.json` with zero hacks or aliasing.

---

## 4. Framework & Bundler Integration

### 4.1 Next.js 16 with Turbopack
Next.js 16 decouples `next build` from ESLint and transpiles TypeScript using Rust-native Turbopack.

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "lint": "biome check .",
    "format": "biome format --write .",
    "ci": "biome ci ."
  }
}
```

### 4.2 Vitest 4+ Configuration
Vitest transforms TypeScript via esbuild/Vite without calling `tsc`. Modern Vite supports native `resolve.tsconfigPaths: true` (or `vite-tsconfig-paths` plugin):

```typescript
// vitest.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true, // Native path alias resolution in Vite 6+
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
});
```

### 4.3 Recommended Modern `tsconfig.json` Flags & Test Isolation

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": [
    "node_modules",
    "__tests__/**/*",
    "**/__tests__/**/*",
    "vitest.config.ts",
    "vitest.setup.ts"
  ]
}
```

> **Note:** Explicitly excluding test files from `tsconfig.json` ensures `next build` type-checking focuses purely on production application code and is never blocked by loose test mock signatures.

