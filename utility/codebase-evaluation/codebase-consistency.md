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
- **Decoupled Client & Server Environment Bundles**: Auditing whether environment modules decouple client-safe schemas (`clientEnvSchema`) from server-only schemas (`serverEnvSchema`). Importing unified eager `env` singletons into client components triggers server validation during SSR/static compilation when server secrets are omitted. Server configuration must be accessed lazily on demand (via getters or Proxies).
- **Empty-String Normalization & CI / Build Fallbacks**: Auditing whether schema parsers normalize empty strings `""` to `undefined` before validating optional variables, and verifying whether module-level eager validation includes test-runner bypasses (`SKIP_ENV_VALIDATION`) or placeholder fallbacks to prevent test suite and build crashes in CI/CD.
- **CI/CD Workflow Action Secret Injection Parity**: Auditing CI/CD workflow configurations (`.github/workflows/*.yml`) against bootstrap environment schemas to ensure newly added secrets and endpoints are declared symmetrically across local `.env.example` and CI workflow action jobs, preventing false pipeline failures.
- **Strict Client Origin Resolution (No Unsafe Localhost Fallbacks)**: Auditing client-side auth clients, API base URLs, and SDK endpoints to ensure they do not hardcode fallback defaults like `process.env.APP_URL || "http://localhost:3000"`, which silently directs production or preview traffic to the end-user's local device when environment variables are omitted.

### 4. Route & Static Asset Registries
- **Scattered URL Strings**: Auditing for hardcoded URL strings (`fetch('/api/users/' + id)`) versus a centralised route registry (`routes.users.byId(id)`).
- **Canonical Root-Relative Asset & API Resolution**: Auditing asset path builders, constants, and client fetch calls to ensure all static assets, media endpoints, internal links, and API calls begin with a root slash (`/api/...`, `/projects/...`) rather than relative slices (`api/...`, `projects/...`), preventing broken relative path resolution on deep nested subroutes (`/conversations/[id]/api/...`).
- **Canonical Site URL Origin Normalization**: Auditing for ad-hoc origin resolution (`window.location.origin`, unnormalized `process.env.SITE_URL`) versus a centralized `getSiteUrl()` utility that enforces protocols, strips trailing slashes, and correctly resolves preview vs production hostnames.
- **Bidirectional Route Protection Consistency**: Auditing route middleware and configuration to ensure route protection is applied symmetrically (protected routes redirect guests to sign-in; guest authentication routes redirect authenticated users to the home/dashboard).
- **Magic Literal Strings**: Hardcoded status strings (`"active"`, `"pending"`, `"admin"`) scattered across queries and UI instead of centralised domain enums or frozen literal union constants.
- **Static Asset Sprawl**: Hardcoded image and icon paths (`"/assets/icons/check.svg"`) missing a typed asset registry.
- **Dynamic Route-Level 404 Boundary Uniformity**: Auditing dynamic route segments (`app/[id]`, `app/[slug]`) to ensure route-level 404 handlers (`not-found.tsx`) are uniformly colocated with all dynamic segment leaves, preventing inconsistent fallback behavior or unhandled routing crashes across pages.
- **Static Dynamic Route Parameter Generator Parity**: Auditing dynamic route folders (`app/[id]`, `app/[key]`) in static-export or SSG frameworks to ensure parameter generators (`generateStaticParams`, `getStaticPaths`) are declared uniformly across all dynamic route leaves, preventing production deployment 404s.

### 5. Naming & Import Conventions
- **Variable & Function Casing**: Consistent camelCase for methods, UPPER_SNAKE_CASE for constants, PascalCase for classes/types.
- **Boolean Prefixes**: Systematic use of `is*`, `has*`, `should*` prefixes.
- **Import Strategy**: Uniformity of path aliases (e.g. `@/components/*`) versus mixed deep relative imports (`../../../../utils/*`).

### 6. Composite Identifier Format Parity
- **Composite Key Divergence**: Auditing cross-module composite key construction (e.g. `${serverId}:tool:${toolName}`). Divergence where a producer constructs keys using database UUIDs while a consumer looks them up or filters using human-readable display names (or vice versa) causes silent omission of items without runtime errors.
- **Centralised Identifier Construction**: Mandating centralised helper functions (`buildId(...)`, `parseId(...)`) shared across producers and consumers to guarantee identifier parity.

### 7. Symmetrical Upload & Validation Limits
- **File Limit Desynchronization**: Auditing file upload size limits, MIME type filters, and validation rules across architectural layers. When client-side validation schemas (e.g. upload form Zod schemas), user-facing UI labels ("Max 10MB"), and server-side validation/action handlers define limits independently with hardcoded magic numbers, divergence causes valid files to be rejected on the client or rejected unexpectedly by the server. Mandating a single, shared configuration constant (e.g. `FILE_LIMITS`) imported symmetrically across all tiers.

### 8. Inherited Route Boundary Pruning (Hoisting Redundant Boundaries)
- **Nested Boundary Duplication**: Auditing route directories for redundant copies of boilerplate boundary files (`loading.tsx`, `error.tsx`). In hierarchical routing architectures (e.g. Next.js App Router), base ancestor boundaries cascade automatically to child subroutes. Copying identical boundary implementations into every individual subroute directory introduces dead maintenance weight, UI styling divergence, and code duplication. Auditing to ensure subroutes only declare boundary files when specialized, non-inherited UI presentation is strictly required.

### 9. Toolchain Exclusion Negation Syntax Consistency
- **Linter & Formatter Exclusion Globs**: Auditing toolchain configurations (`biome.json`, `.eslintrc`, Prettier) for inverted glob negation syntax. Ensuring directories intended to be ignored (e.g. `!__tests__`, `!graphify-out`) carry explicit negation prefixes in file-matching arrays rather than being mistakenly matched for active linting.

### 10. Static Data Map Relational Symmetry & Key Invariants
- **Bidirectional Relational Integrity**: Auditing static entity databases, seed datasets, and relation maps for symmetric integrity (e.g. if Entity A links to Entity B, Entity B links to Entity A) and absence of dangling keys to deleted entities.
- **Display Label vs Key Lookup Decoupling**: Ensuring global search, filters, and relationship resolvers query canonical entity keys rather than display names or nested object values.

### 11. Canonical Data Ingestion & Syntax Normalization Consistency
- **Standardized Canonical Parsing**: Auditing parsers and serializers to ensure standard formats (ISO 8601 timestamps, standard decimal representations) are ingested deterministically without ambiguous locale-guessing heuristics (`dayfirst=True`, local comma inferences) that corrupt canonical strings.
- **Operator & Syntax Flexibility**: Auditing query, formula, and filter evaluators for consistent syntax normalization. Parsers should uniformly map common syntactic and operator variants (e.g. `=` and `==`, `<>` and `!=`, case-insensitive keyword tokens `and` vs `AND`) into canonical domain enums rather than throwing brittle syntax rejection errors.

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
