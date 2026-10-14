# Fallow: Gotchas & Suppressions

This reference details inline suppression syntax, handling false positives, stale suppression cleanup, and common CLI pitfalls.

---

## 1. Inline Suppression Syntax

When an intentional unused export, circular dependency, or boundary crossing must be preserved, suppress it using explicit comments:

### Line Suppressions
Place directly above the flagged line:

```typescript
// fallow-ignore-next-line unused-export
export const DEBUG_METRICS_KEY = "internal_debug_key";

// fallow-ignore-next-line circular-dependency
import { helper } from "./helpers";

// fallow-ignore-next-line boundary-violation
import { directDbPool } from "@/lib/db/pool";

// fallow-ignore-next-line code-duplication
const clonedMappingLogic = { ... };
```

### File-Level Suppressions
Place at the top of the file:

```typescript
// fallow-ignore-file unused-file
// fallow-ignore-file duplicate-export
```

### JSDoc `@expected-unused`
For libraries or exported APIs that are deliberately unused within the repository itself:

```typescript
/**
 * Public SDK export for third-party consumers.
 * @expected-unused
 */
export function initializeSdkClient(): Client { ... }
```

---

## 2. Stale Suppression Detection

Fallow actively guards against obsolete suppressions. If code is refactored and an issue no longer occurs, Fallow flags the outdated comment as a `stale-suppression`:

```bash
# Detect and list active or stale suppressions
fallow suppressions
```

To prevent silent suppression accumulation, you can enforce that every suppression includes an explanation reason in `.fallowrc.json`:

```json
{
  "rules": {
    "require-suppression-reason": "error"
  }
}
```

```typescript
// fallow-ignore-next-line unused-export: Exported for third-party SDK consumers
export const publicApi = ...;
```

---

## 3. Critical Gotchas

### Gotcha 1: `fallow fix` Hangs in Non-TTY Environments
`fallow fix` asks for interactive confirmation `[y/N]`. In agent environments or CI, stdin is non-interactive. You **must** provide `--yes`:

```bash
# WRONG (exits with error or hangs)
fallow fix

# CORRECT
fallow fix --dry-run      # preview
fallow fix --yes          # apply
```

### Gotcha 2: Do Not Create Unnecessary Config
Fallow has zero-config auto-detection for Next.js, React, Vitest, Biome, Drizzle, Vite, and 100+ frameworks. Do **not** create `.fallowrc.json` unless you need custom ignores, component exemptions, or rule changes. An improper `entry` config can mask real framework routes.

### Gotcha 3: Syntactic (AST) vs Type-Aware
By default, Fallow runs ultra-fast Rust syntactic AST graph analysis. It does not run the TypeScript typechecker. For cases where symbol identity across complex re-exports or interfaces must be strictly verified, use:

```bash
fallow dead-code --type-aware
```

### Gotcha 4: Workspace Scoping in Monorepos
In monorepos, passing `--workspace <name>` scopes which findings are *reported*, but Fallow still analyzes the full repository graph to correctly resolve inter-package dependencies.
