# Dependency Usage Module

Identifies opportunities to reduce custom boilerplate by leveraging existing project dependencies and modern standard libraries, while auditing for dependency bloat, micro-package drag, and toolchain sprawl.

For diagnostic taxonomies and smell mappings, see [Code Smells Matrix](references/code-smells-matrix.md).

## When to Use

Use this module when you need to:
- Identify custom utility code that reinvents existing standard libraries or project dependencies
- Audit for "Reinventing the Wheel"—hand-rolled parsing, date formatting, or cloning missing edge cases
- Detect "Micro-Package Dependency Drag"—installing third-party packages for trivial 1-line tasks
- Identify Multi-Tool Toolchain Sprawl—competing linters, formatters, and build plugins
- Flag blocker dependency incompatibilities preventing runtime or framework modernization
- Calculate code reduction metrics (lines deleted vs lines added) while guaranteeing functional parity

## Key Analysis Areas

### 1. Reinventing the Wheel (Hand-Rolled Utility Sprawl)
Custom implementations of utilities that duplicate standard library functions (e.g. `structuredClone`, `Intl.DateTimeFormat`, `URLSearchParams`, Python's `datetime`, `dataclasses`) or battle-tested dependencies already present in `package.json` / `pyproject.toml`.
- *Common Culprits*: Custom deep clone functions, custom date parsers, bespoke URL query string builders, ad-hoc JSON validators.

### 2. Under-Utilised Project Dependencies
Existing packages declared in dependencies that are only imported in 1–2 files while other modules write custom code accomplishing the exact same operations.

### 3. Micro-Package Dependency Drag
Third-party external packages installed for trivial tasks (e.g. `is-number`, `left-pad`, single-icon micro-packages). These add supply-chain attack surface, node_modules bloat, and license risks without providing meaningful engineering leverage.
- *Remediation Principle*: Replace micro-packages with lightweight internal primitive facades.

### 4. Multi-Tool Toolchain Sprawl
Maintaining fragmented, overlapping tooling configurations (e.g. ESLint + Prettier + standard lint plugins + custom AST scripts). Evaluate whether toolchains can be unified into modern high-performance engines (e.g. Biome, Ruff) to prune configuration friction.

### 5. Blocker Dependencies & Ecosystem Lockout
Auditing dependencies for abandoned or pinned legacy packages that prevent core framework upgrades (e.g. pinning an outdated React or Node version).

### 6. Functional Parity & Edge Case Auditing
Before recommending a library replacement, verify that the library preserves 100% behavioral parity across:
- Edge case handling (e.g. DST transitions, timezone offsets, leap years in dates)
- Serialization and prototype handling (symbols, undefined, circular references)
- Bundle size overhead vs lines saved

---

## Quality Principles

- **Behavioural Parity First** – Never suggest a dependency replacement that alters runtime behaviour or fails edge cases.
- **Zero Supply Chain Bloat** – Do not recommend adding heavy external dependencies for tasks that can be accomplished cleanly in $<15$ lines of standard library code.
- **Prefer Standard Libraries** – Prioritise modern standard library features over introducing new third-party packages.

---

## What This Module Does NOT Do

- Does not suggest massive framework migrations (e.g. Next.js to Astro)
- Does not recommend adding libraries for trivial tasks ($<5$ lines of code)
- Does not suggest replacing core proprietary business domain logic
- Does not modify package manifest files

---

## Report Structure

Each finding includes:

- **Finding Title** – Descriptive title of the utility or dependency issue
- **Category** – Reinventing the Wheel / Under-Utilised Dependency / Micro-Package Drag / Toolchain Sprawl
- **Location** – File paths and line numbers of the custom logic or dependency
- **Current Logic Assessment** – Summary of custom implementation and edge case risks
- **Standard or Dependency Alternative** – Exact method or library replacement
- **Net Code Reduction** – Estimated lines deleted vs lines added
- **Parity & Bundle Assessment** – Impact on bundle size and confirmation of functional equivalence

---

## Example Findings

**Example 1: Hand-Rolled Deep Clone Duplicating Native structuredClone**
- **Category**: Reinventing the Wheel
- **Location**: `src/utils/clone.ts` (lines 1–45)
- **Current Logic Assessment**: Custom recursive cloning function that fails on Date objects, RegExp instances, and Maps.
- **Standard Alternative**: Native `structuredClone()` (supported across all modern runtimes).
- **Net Code Reduction**: 45 lines deleted, 0 lines added; removes fragile recursive edge cases.
- **Parity & Bundle Assessment**: 100% parity; 0 KB bundle addition (native browser/Node feature).

**Example 2: Micro-Package Dependency Drag for Single Icon Set**
- **Category**: Micro-Package Dependency Drag
- **Location**: `package.json` (`react-feather@^2.0.0`, adding 18 MB to `node_modules`)
- **Current Logic Assessment**: Entire library imported for only 3 icons (`Check`, `ChevronDown`, `X`).
- **Standard Alternative**: Inline SVGs wrapped in internal primitive icon component.
- **Net Code Reduction**: Eliminates 1 external dependency; drops bundle size by 35 KB.
- **Parity & Bundle Assessment**: Confirmed visually identical.

---

## Example Invocation

```
Analyse [PROJECT_PATH] for dependency usage and utility sprawl.
Audit:
- Custom utility functions that reinvent standard libraries or existing packages
- Under-utilised dependencies already in package manifests
- Micro-package dependencies that should be replaced with internal primitives
- Competing or fragmented toolchain configurations
- Blocker dependencies preventing upgrades

Verify 100% behavioural parity and calculate net code reduction for each finding.
```
