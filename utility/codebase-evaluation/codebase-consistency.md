# Codebase Consistency Module

Audits the codebase for internal uniformity across topological directory structure, architectural patterns, naming conventions, type tiering, configuration validation, and import strategies.

For complete smell mappings and diagnostic criteria, see [Code Smells Matrix](references/code-smells-matrix.md).

## When to Use

Use this module when you need to:
- Audit adherence to established architectural standards and directory conventions
- Detect topological directory disorder (mixed casing, route pollution, misplaced components)
- Identify monolithic type grab-bags and missing domain model tiering
- Spot ad-hoc environment variable reads and unvalidated runtime configurations
- Detect magic literal strings and scattered URL paths lacking registries
- Evaluate naming consistency across functions, files, enums, and variables
- Check consistency of import styles (relative vs absolute path aliases)

## Key Analysis Domains

### 1. Topological Directory Architecture & Harmonization
- **Strict File & Folder Casing**: Enforcing uniform casing across tiers (e.g. strict `kebab-case` for utility files and folders, `PascalCase` for React/UI components).
- **Colocation of Private Sub-Components**: Auditing whether page-private components are colocated in a dedicated `_components/` directory adjacent to their parent view, rather than polluting the shared root `components/` catalog.
- **Framework Routing Directory Pollution**: Auditing framework route directories (e.g. `app/`, `routes/`, `pages/`) to ensure they only contain route handlers and page shells—not inline database queries, complex utilities, or domain entity models.

### 2. Domain Type Architecture (4-Tier Segregation)
Auditing `types/` for monolithic grab-bags (e.g. 500-line `types/index.ts` files). A cohesive enterprise architecture segregates models into 4 distinct tiers:
1. **Raw Database Entities**: Exact ORM schema shapes reflecting table columns.
2. **Core Domain Models**: Rich domain entities with business invariants.
3. **Data Transfer Objects (DTOs)**: API request/response contracts and external schemas.
4. **View / UI Options**: Form state types, select dropdown options, and presentational props.

### 3. Environment Configuration & Boundary Protection
- **Validated Environment Schema**: Auditing whether environment variables are validated at bootstrap via schemas (Zod, Pydantic) or read ad-hoc via scattered `process.env` / `os.environ` lookups.
- **Client-Server Environment Isolation**: Ensuring server-only secrets (database credentials, API private keys) are never accessible to client-side bundles.

### 4. Route & Static Asset Registries
- **Scattered URL Strings**: Auditing for hardcoded URL strings (`fetch('/api/users/' + id)`) versus a centralised route registry (`routes.users.byId(id)`).
- **Magic Literal Strings**: Hardcoded status strings (`"active"`, `"pending"`, `"admin"`) scattered across queries and UI instead of centralised domain enums or frozen literal union constants.
- **Static Asset Sprawl**: Hardcoded image and icon paths (`"/assets/icons/check.svg"`) missing a typed asset registry.

### 5. Naming & Import Conventions
- **Variable & Function Casing**: Consistent camelCase for methods, UPPER_SNAKE_CASE for constants, PascalCase for classes/types.
- **Boolean Prefixes**: Systematic use of `is*`, `has*`, `should*` prefixes.
- **Import Strategy**: Uniformity of path aliases (e.g. `@/components/*`) versus mixed deep relative imports (`../../../../utils/*`).

---

## Quality Principles

- **Establish Norms First** – Audit multiple modules to discover the majority pattern before flagging an isolated deviation.
- **Configuration Authority** – Treat linter configs (`tsconfig.json`, `biome.json`, `.eslintrc`, `.editorconfig`) as the primary ground truth.
- **Framework Alignment** – Honor framework-specific topological conventions (e.g. Next.js App Router rules, Django app structures).

---

## What This Module Does NOT Do

- Does not rewrite files or run auto-formatters
- Does not flag intentional, documented exceptions with architectural justification
- Does not nitpick trivial formatting whitespace when it does not impair readability

---

## Report Structure

Each finding includes:

- **Inconsistency Title** – Name of the structural or naming defect
- **Domain** – Topological Directory / Type Architecture / Configuration / Route Registry / Naming
- **Locations & Violations** – Specific file paths violating the project convention
- **Established Majority Pattern** – Reference to dominant pattern (e.g. 24/28 files follow X)
- **Diagnostic Remediation Target** – Target standardization pattern
- **Consensus Status** – Fully agreed upon or disputed

---

## Example Findings

**Example 1: Framework Route Directory Pollution**
- **Domain**: Topological Directory Architecture
- **Locations**: `src/app/api/checkout/route.ts` and `src/app/api/checkout/pdf-generator.ts`
- **Violation**: Business logic for PDF invoice generation (250 LOC) placed directly inside the Next.js routing directory.
- **Established Majority Pattern**: Next.js App Router folders only contain `route.ts` or `page.tsx`; domain services live under `src/services/` or `src/lib/`.
- **Diagnostic Remediation Target**: Move `pdf-generator.ts` to `src/services/pdf/invoice-generator.ts`.
- **Consensus Status**: Fully agreed upon

**Example 2: Ad-Hoc Environment Variable Reads**
- **Domain**: Environment Configuration
- **Locations**: `src/lib/mailer.ts` (line 12), `src/handlers/auth.ts` (line 45)
- **Violation**: Direct unvalidated reads `process.env.SMTP_PORT` and `process.env.JWT_SECRET` with missing fallback checks.
- **Established Majority Pattern**: Centralised validation module `src/config/env.ts` parses and validates env variables via Zod schema.
- **Diagnostic Remediation Target**: Route all environment reads through `src/config/env.ts`.
- **Consensus Status**: Fully agreed upon

---

## Example Invocation

```
Audit [PROJECT_PATH] for topological consistency and structural uniformity.
Audit:
- Topological directory structure and file naming casing
- Framework route directory pollution (business logic in route folders)
- Monolithic type files lacking 4-tier segregation
- Scattered ad-hoc process.env lookups vs validated env schema
- Magic literal strings vs centralised domain enums
- Inconsistent import path aliases

Provide file locations, dominant pattern evidence, and consensus verification.
```
