# Code Duplication Module

Rigorously identifies exact duplications, structural clones, declarative schema redundancies, and missed reuse opportunities across the codebase.

For diagnostic taxonomies and smell mappings, see [Code Smells Matrix](references/code-smells-matrix.md).

## When to Use

Use this module when you need to:
- Detect exact, line-for-line duplicated code blocks across files
- Identify semantic clones that use different variable names or formatting but identical control flow
- Spot declarative schema and model duplication across database entities (ORM tables, DTOs)
- Locate scattered inline variations where common transformations are re-implemented ad-hoc
- Detect competing engine duplications where multiple libraries perform identical responsibilities
- Identify call-site guard redundancy and fragmented low-level micro-routines
- Evaluate whether extraction improves maintainability or creates undesirable coupling

## Analysis Categories

### 1. Exact Clones
Identical blocks of code ($\ge 6$ lines) repeated in multiple locations, differing at most in whitespace or variable names.

### 2. Functional & Semantic Clones
Code blocks with different syntax, order, or identifiers that accomplish identical underlying business logic and state transitions. Evaluated via Abstract Syntax Tree (AST) comparison.

### 3. Declarative Model & Schema Duplication (Group-Level Clones)
Repeated identical column definitions, foreign key references, or audit timestamp declarations across database ORM schemas (Drizzle, Prisma, TypeORM, SQLAlchemy) or API DTOs.
- *Diagnostic Target*: Tables repeating identical ID, tenant, and timestamp column declarations instead of composable schema helpers.

### 4. Scattered Inline Variations (Ad-Hoc Transformations)
Ad-hoc, one-off variations of parsing, string manipulation, or currency/date formatting written directly inside UI components or API handlers instead of calling a centralised domain utility.

### 5. Competing Engine Duplication
Multiple libraries performing the exact same technical task present in the repository (e.g. `date-fns` and `dayjs`, `marked` and `markdown-it`, `axios` and native `fetch`). Results in bundle bloat and divergent runtime behaviour.

### 6. Ignored Shared Utilities
Writing custom duplicate logic when an existing, tested utility function is already present in the shared library or dependencies.

### 7. Call-Site Guard Redundancy
Defensive precondition checks (null validation, permission asserts, bound checks) repeated identically at every call site rather than consolidated at the boundary guard or function entry.

---

## Quality Principles

- **DRY with Context** – Eliminate duplication when it represents a single, shared business concept. Do not force code sharing between disparate business domains that evolve independently.
- **Rule of Three** – Require at least three occurrences before flagging an abstraction opportunity unless the logic is complex or security-sensitive.
- **Single Responsibility Preservation** – Ensure proposed consolidations do not create tightly coupled, monolithic helper functions.

---

## What This Module Does NOT Do

- Does not rewrite or refactor code
- Does not flag standard framework boilerplate (e.g. controller decorators, route parameters) as duplication
- Does not count dead or commented-out code as active duplication
- Does not recommend sharing code between modules that have fundamentally different rates of change

---

## Report Structure

Each finding includes:

- **Duplication Pattern Name** – Clear title referencing the clone type
- **Classification** – Exact Clone / Semantic Clone / Declarative Schema Duplication / Competing Engine / Scattered Inline Variation
- **Locations** – File paths and line numbers for all occurrences
- **Explanation** – Concrete rationale detailing how the logic overlaps and the maintenance liability
- **Proposed Simplification** – High-level extraction recommendation (e.g. composable schema mixin, canonical domain facade)
- **Impact** – Estimated lines of code saved and maintainability improvement

---

## Example Findings

**Example 1: Declarative Schema Duplication Across ORM Entities**
- **Classification**: Declarative Schema Duplication
- **Locations**:
  - `src/db/schema/projects.ts` (lines 8–18)
  - `src/db/schema/documents.ts` (lines 10–20)
  - `src/db/schema/comments.ts` (lines 7–17)
- **Explanation**: All 3 tables duplicate identical primary key UUID generation, foreign key tenant references, and `createdAt`/`updatedAt` timestamp column definitions.
- **Proposed Simplification**: Extract composable schema helper functions (`entityIdColumn()`, `tenantForeignKeyColumn()`, `timestampColumns()`).
- **Impact**: Removes ~30 lines of boilerplate; guarantees identical migration snapshots across all entities.

**Example 2: Competing Markdown Engines**
- **Classification**: Competing Engine Duplication
- **Locations**:
  - `package.json` (`marked@^9.0.0` and `markdown-it@^13.0.0`)
  - `src/components/MarkdownViewer.tsx` (uses `marked`)
  - `src/services/DocumentationParser.ts` (uses `markdown-it`)
- **Explanation**: Two distinct markdown rendering engines installed and used simultaneously. Increases bundle size by ~45 KB and causes rendering discrepancies (different footnote and table extension support).
- **Proposed Simplification**: Standardise on a single markdown engine via a unified parser wrapper.
- **Impact**: Cuts bundle size; harmonizes content rendering behaviour across UI and server.

---

## Example Invocation

```
Identify code duplication and clone patterns in [PROJECT_PATH].
Cross-reference modules for:
- Exact line-for-line clones across files
- Declarative schema/model duplication across ORM tables
- Scattered inline variations of formatting/parsing routines
- Competing engine duplications in dependencies
- Redundant call-site guards

Provide file paths, line numbers, clone classification, and estimated lines saved.
```
