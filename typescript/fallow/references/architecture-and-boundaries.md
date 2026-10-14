# Fallow: Architecture & Boundaries

This reference covers configuring architecture boundary zones, enforcing module access rules, and breaking circular dependencies.

---

## 1. Architectural Boundary Zones

Boundary rules prevent architectural erosion by restricting which layers or modules can import each other. For example:
- Preventing UI components from importing database pools directly.
- Restricting domain logic from depending on UI components.
- Enforcing feature isolation (preventing feature A from importing feature B internals).

### Boundary Configuration in `.fallowrc.json`

```json
{
  "boundaries": {
    "zones": [
      {
        "name": "ui",
        "patterns": ["components/**", "app/**"]
      },
      {
        "name": "services",
        "patterns": ["actions/**", "lib/services/**"]
      },
      {
        "name": "data",
        "patterns": ["drizzle/**", "lib/db/**"]
      },
      {
        "name": "shared",
        "patterns": ["lib/utils.ts", "types/**", "config/**"]
      }
    ],
    "rules": [
      {
        "from": "ui",
        "allow": ["ui", "services", "shared"],
        "allowTypeOnly": ["data"]
      },
      {
        "from": "services",
        "allow": ["data", "shared", "services"]
      },
      {
        "from": "data",
        "allow": ["shared"]
      }
    ]
  }
}
```

### Boundary Options
- `allow`: List of target zones this source zone may import values from.
- `allowTypeOnly`: Permits `import type` crossings while still forbidding runtime value imports (e.g. allowing UI components to import database table types for prop typing without importing runtime schema objects).
- `boundaries.coverage.requireAllFiles`: Flag files that do not belong to any defined zone (`boundary-coverage`).

---

## 2. Forbidden Callee Patterns (`boundaries.calls`)

In addition to imports, Fallow can restrict specific runtime function calls within zoned files:

```json
{
  "boundaries": {
    "calls": {
      "forbidden": [
        {
          "zone": "ui",
          "patterns": ["node:child_process.*", "fs.*", "db.query.*"]
        }
      ]
    }
  }
}
```

---

## 3. Resolving Import Cycles

Fallow detects three distinct forms of import cycles:

### 1. Module Circular Dependencies (`circular-dependencies`)
Direct or indirect value import cycles (e.g., `A -> B -> C -> A`).
- **Risks**: Causes runtime `undefined` imported values at initialization, prevents effective tree-shaking, and tightly couples modules.
- **Remediation Techniques**:
  - **Extract Shared State**: Move shared variables, types, or interfaces into a third module (`A -> Shared <- B`).
  - **Inversion of Control (Callbacks/Events)**: Pass dependencies as function parameters or registry callbacks rather than top-level imports.
  - **Remove Barrel Re-Exports**: If a barrel file (`index.ts`) re-exports an action that imports back from the barrel, break the re-export and have consumers import directly from the leaf module.

### 2. Re-Export Cycles (`re-export-cycles`)
Occurs when barrel files re-export from each other in a loop (`Kind: multi-node`), or a barrel re-exports itself.
- **Remediation**: Eliminate the mutual re-export between the barrels.

### 3. Package Cycles (`package-cycles`)
Occurs in monorepos when package A depends on package B, and package B depends on package A.
- **Remediation**: Move shared types/utilities into a dedicated `@workspace/common` package.
