# Code Smells Diagnostic Evaluation Matrix

Authoritative diagnostic catalogue mapping observed symptoms and code smells to underlying architectural defects, detection heuristics, evidence criteria, and evaluation domains.

Use this matrix during codebase evaluation to diagnose root causes objectively and provide specific, evidence-backed findings.

---

## 1. Architectural & Structural Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Circular Dependency (`A ↔ B`)** | Bidirectional imports between modules or packages; madge/dpdm cycle report | Import cycle path between files, AST import traces | `architecture-design-analysis` | **High** |
| **Peer Domain Cycle** | Feature modules importing each other horizontally instead of sharing via foundational tier | Cross-feature relative imports (`../featureB/`) | `architecture-design-analysis` | **High** |
| **Storage Impedance Mismatch** | Specialised workloads (vectors, text search, timeseries) forced into relational tables | JSON blob columns with manual scans, custom search SQL | `architecture-design-analysis` | **Medium** |
| **Monolithic Context / God Provider** | Single provider holding authentication, UI modals, websocket state, and domain caches | React context or singleton store with $>15$ unrelated fields | `architecture-design-analysis`, `ui-component-analysis` | **High** |
| **Direct Persistence Coupling** | HTTP handlers, route handlers, or UI components executing direct DB queries inline | SQL strings or raw ORM calls in controller/route files | `architecture-design-analysis` | **High** |
| **Distributed Resource Deletion Leaks** | Relational cascade deletes database row but leaves orphaned cloud files/buckets | Foreign key `ON DELETE CASCADE` lacking S3/storage cleanup hook | `architecture-design-analysis`, `security-audit` | **High** |
| **Monolithic Server Entrypoint** | God bootstrap file inlining routing, middleware, database initialisation, and error handling | Single `server.ts` or `app.py` exceeding 300 LOC with $>5$ concerns | `architecture-design-analysis` | **Medium** |
| **Multi-Action God Modules (Action Sprawl)** | Monolithic controller/actions file bundling 8–20 procedures across 350+ LOC | Single actions file exporting $>5$ disparate procedures, shared mock pollution | `architecture-design-analysis`, `quality-analysis` | **High** |
| **Unbounded Recursive Tree Depth** | Arbitrary comment or hierarchy depth without recursion guard, risking stack overflow | Recursive self-referencing model lacking max-depth check | `architecture-design-analysis` | **High** |
| **Query Cardinality Mismatch** | Exact-one operator (`.single()`) invoked on optional zero-or-one relations | Uncaught PGRST116 / 406 runtime exceptions when records are absent | `architecture-design-analysis`, `quality-analysis` | **High** |
| **Dual-Format Identifier Mismatch** | Interleaving legacy integer IDs and UUIDs across relational schema joins | Explicit type casting (`parseInt(id)`) and join failure workarounds | `architecture-design-analysis`, `codebase-consistency` | **High** |
| **N+1 Relational Hydration Waterfall** | Sequential item-by-item fetches in loops across bare stores lacking batch queries | `for` loop awaiting individual queries per item instead of batch queries | `architecture-design-analysis`, `quality-analysis` | **High** |
| **Client-Server Environment Bleed** | Monolithic env file bundling server secrets with client-exposed build constants | Private keys prefixed with client build prefixes or imported in UI | `architecture-design-analysis`, `security-audit` | **Critical** |
| **Subsystem / Transport Retirement** | Deprecated execution transport (e.g. legacy stdio/gRPC alongside HTTP) still maintained | Dual entrypoints maintaining parallel handling logic | `architecture-design-analysis` | **Medium** |

---

## 2. Code Quality & Complexity Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **High Cognitive Complexity** | SonarQube cognitive complexity $>15$ (warning) or $>30$ (critical hotspot) | Nesting depth $>3$, multiple structural jumps, break/continue | `quality-analysis` | **Critical/High** |
| **Deeply Nested Conditionals (Arrow Code)** | Nesting level $\ge 4$ indentation blocks (`if` inside `for` inside `if`) | Code pyramid indentation, missing early guard returns | `quality-analysis` | **High** |
| **Long Method / God Function** | Single function exceeding 50 lines or handling $>3$ execution phases | Function LOC, lines spanning validation + computation + persistence | `quality-analysis` | **High** |
| **God Class / Object** | Single class with $>10$ public methods or $>500$ LOC handling $>1$ domain concern | Class method count, disparate imported dependencies | `quality-analysis` | **High** |
| **Primitive Obsession** | Raw strings/numbers representing domain concepts (emails, currency, postal codes) | Missing Value Objects, repeated ad-hoc regex validation | `quality-analysis` | **Medium** |
| **Long Parameter List** | Functions taking $\ge 4$ positional arguments | Function signature inspection; arguments susceptible to positional drift | `quality-analysis` | **Medium** |
| **Feature Envy** | Method calls more methods on another object than on its own enclosing class | Call graph inspection, accessing multiple getters on foreign object | `quality-analysis` | **Medium** |
| **Linear Scan on Static Collections** | Repeated $O(N)$ scans (`.find()`, `.filter()`) on static or read-heavy datasets | Linear search loops inside hot rendering or query paths without reverse index | `quality-analysis` | **Medium** |
| **Runtime Static Data Enrichment Loop** | Dynamic runtime loops inspecting disk assets or computing fallbacks on every render | Asynchronous filesystem I/O executing inside component render passes | `quality-analysis`, `ui-component-analysis` | **Medium** |
| **Unstructured Temporal Obsession** | Storing dates as formatted strings (`"Sep 2022 - Present"`) in domain models | Regex string splitting on dates; inability to sort chronologically | `quality-analysis`, `codebase-consistency` | **Medium** |
| **Naive Additive Quota Checks** | Quota evaluated as `current + new > limit` instead of net delta on file replacement | False quota rejection errors when users update existing assets | `quality-analysis`, `security-audit` | **High** |
| **Read-Modify-Write Concurrency Races** | Non-atomic `SELECT` followed by in-memory logic followed by `UPDATE` | Concurrent mutation without atomic SQL expressions or row locking | `quality-analysis`, `security-audit` | **Critical** |
| **Silent Input Degradation / Swallowed Errors** | Empty `catch` blocks or silent omission of unsupported capabilities | `catch (e) {}` with no logging or typed error rethrow | `quality-analysis` | **High** |
| **Unshielded Resource Handles (I/O Leaks)** | Unclosed database connections, file handles, or network sockets lacking finally/disposal | Missing `try...finally`, `using`, or auto-closable wrappers | `quality-analysis` | **High** |
| **Untyped Bag-of-Keys / Opaque Parameters** | `Record<string, any>`, `dict`, or `object` passed across system boundaries | Missing schema validation (Zod, Pydantic) at API/module borders | `quality-analysis` | **High** |
| **High CRAP Score** | $	ext{comp}^2 \cdot (1 - 	ext{cov})^3 + 	ext{comp} > 30$ | Cyclomatic complexity $>10$ with $<50\%$ test coverage | `quality-analysis` | **High** |

---

## 3. Redundancy & Duplication Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Exact Clones** | Identical lines of code ($\ge 6$ lines) across 2 or more locations | Line-for-line diff comparison across files | `code-duplication` | **High** |
| **Declarative Model / Schema Duplication** | Repeated column definitions (timestamps, IDs, audit fields) across ORM tables | Identical column definitions across $\ge 3$ schema files | `code-duplication` | **Medium** |
| **Scattered Inline Variations** | Ad-hoc one-off transformations (e.g. date formatting, currency parsing) diverging slightly | Diff of multiple utility variations across UI or controller files | `code-duplication` | **Medium** |
| **Competing Engine Duplication** | Multiple libraries performing the same task (e.g. `marked` and `markdown-it`, `date-fns` and `dayjs`) | `package.json` audit showing dual competing packages | `code-duplication`, `use-dependencies` | **High** |
| **Call-Site Guard Redundancy** | Identical validation pre-checks repeated across call sites rather than inside target function | Repeated null/bound checks preceding every invocation | `code-duplication` | **Low** |
| **Fragmented Micro-Routines** | Boilerplate routines (stream chunking, token counting, header extraction) duplicated inline | Repeated low-level loop patterns across handlers | `code-duplication` | **Medium** |

---

## 4. Dead Code & Obsolescence Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Unreachable Logic** | Code following unconditional returns, throws, or impossible branch predicates | AST reachability analysis, dead conditional paths | `dead-code` | **Medium** |
| **Unused Public Exports** | Exported functions, classes, or types never imported anywhere in the project repository | Knip / Fallow export reachability trace with zero references | `dead-code` | **Medium** |
| **Phantom Event Dispatching** | Emitting event signals (event emitter, pub/sub topic) with zero active subscribers | Search for event name across repo shows producers but 0 consumers | `dead-code` | **Medium** |
| **Zombie Migration Scripts** | One-off migration, backfill, or bridge scripts retained after deployment completion | Ephemeral scripts in root or `/scripts` past operational lifespan | `dead-code` | **Low** |
| **Speculative Domain Model Bloat** | Interfaces, DTOs, or enums defined for anticipated features that have 0 implementation | Types declared in `types/` with zero production references | `dead-code`, `over-abstraction` | **Medium** |
| **Orphaned Test Files** | Test files testing deleted or renamed modules, or abandoned mocks | Tests with dead imports or tests skipped permanently | `dead-code` | **Low** |

---

## 5. Consistency & Topological Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Topological Directory Disorder** | Mixed file naming (camelCase vs kebab-case vs PascalCase) within the same folder tier | Directory listing showing inconsistent naming schemes | `codebase-consistency` | **Low** |
| **Framework Routing Directory Pollution** | Placing business logic, helpers, and domain services directly inside framework route directories | Route folders containing non-page/non-route service files | `codebase-consistency`, `architecture-design-analysis` | **Medium** |
| **Monolithic Type Dumps** | Hundreds of mixed interfaces dumped into a single `types/index.ts` file | Giant type file ($>300$ LOC) mixing DB, DTO, and UI state models | `codebase-consistency` | **Medium** |
| **Static Constant vs Managed Config Drift** | Hardcoded policy constants requiring code releases rather than managed configuration | Commit history showing releases purely to update static constants | `codebase-consistency`, `architecture-design-analysis` | **Medium** |
| **Redundant Identity Properties in Keyed Entities** | Storing entities in keyed records where entity redundantly contains its own key | Entity interface declaring `slug: string` stored in `Record<Slug, Entity>` | `codebase-consistency` | **Low** |
| **Ad-Hoc Environment Reads** | Direct unvalidated `process.env` or `os.environ` accesses scattered across files | Grep for raw env lookups outside centralised validation schema | `codebase-consistency`, `security-audit` | **High** |
| **Magic Literal Strings** | Hardcoded status, role, or action strings scattered across handlers and tests | Raw string literals used instead of centralised union constants/enums | `codebase-consistency` | **Medium** |
| **Scattered URL Strings & Query Bugs** | Hand-rolled URL path concatenation and query string construction | Template literals like `fetch(\`/api/v1/users/\${id}?tab=\${tab}\`)` | `codebase-consistency` | **Medium** |
| **Static Asset String Sprawl** | Hardcoded asset paths (`"/images/logo.png"`) scattered across UI components | Missing centralised asset registry; missing alt text standards | `codebase-consistency` | **Low** |

---

## 6. Over-Abstraction Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Trivial Passthrough Wrappers** | 1–2 line functions or classes that merely forward arguments without transformation | Wrapper method with zero domain logic or parameter modification | `over-abstraction` | **Medium** |
| **Interfaces for One** | Interface or abstract class with exactly one concrete implementation and no test mock need | 1:1 interface to implementation ratio without polymorphism | `over-abstraction` | **Medium** |
| **Lasagna Code** | Data passing through $\ge 4$ layers (Controller → Adapter → Service → Manager → Repo) unchanged | Call trace showing identical data passed without mutation | `over-abstraction`, `architecture-design-analysis` | **High** |
| **Redundant Inherited Route Boundaries** | Copy-pasting boilerplate `loading.tsx` or `error.tsx` into child routes unnecessarily | Duplicate boundary files across subroutes without specialized UI | `over-abstraction`, `codebase-consistency` | **Low** |
| **Speculative Infrastructure Schema Debt** | Anticipatory multi-tenancy columns, organization IDs, or plugin hooks for a single-tenant app | Unused columns or abstract lifecycle hooks with 0 consumers | `over-abstraction` | **Medium** |
| **Micro-Tool / Micro-Endpoint Catalog Sprawl** | Excessively granular tools/endpoints creating selection fatigue and context bloat | Dozens of single-parameter endpoints doing micro-tasks | `over-abstraction` | **Medium** |
| **Excessive Granularity (Micro-File Explosion)** | Fragmentation where every 3-line function lives in an isolated file across deep folder hierarchies | Feature of $<100$ LOC split into $\ge 8$ micro-files | `over-abstraction` | **Low** |
| **Over-Abstracted UI Wrappers** | Custom `<TypographyP>` or `<Box>` components merely wrapping standard HTML tags without tokens | Passthrough UI wrappers adding zero behaviour or styles | `over-abstraction`, `ui-component-analysis` | **Low** |

---

## 7. Dependency & Tooling Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Reinventing the Wheel (Utility Sprawl)** | Hand-rolled date calculation, deep cloning, query parsing, or UUID generation missing edge cases | Custom utility in `utils/` duplicating standard library or vetted package | `use-dependencies` | **High** |
| **Micro-Package Dependency Drag** | Adding third-party NPM/pip packages for trivial tasks (e.g. `is-number`, `left-pad`, icon packages) | Small single-function dependencies adding supply chain risk | `use-dependencies` | **Medium** |
| **Multi-Tool Toolchain Sprawl** | Competing linters, formatters, and compilers (ESLint + Prettier + TSLint + Babel) causing conflict | Conflicting config files (`.eslintrc`, `.prettierrc`, `biome.json`) | `use-dependencies` | **Medium** |
| **Blocker Dependency Incompatibilities** | Outdated core dependencies pinning sub-dependencies and blocking security patches | Package manager peer dependency conflict errors | `use-dependencies`, `security-audit` | **High** |

---

## 8. UI & Frontend Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Monolithic Page / View Component** | Inlining layout, data fetching, form state, and dialogs into a single view ($>300$ LOC) | Component file combining markup with multi-step orchestration | `ui-component-analysis` | **High** |
| **Listing God View** | Main listing view combining data display, filter state, and URL mutation orchestration | List view $>300$ LOC handling table rendering and query string serialization | `ui-component-analysis` | **High** |
| **Presentation-Mutation Coupling** | Components mixing JSX rendering with inline asynchronous mutations, URL sync, and storage | Inline `fetch` / DB calls inside presentational components | `ui-component-analysis` | **High** |
| **God Hook / Mega-Composable** | Hook managing $>5$ unrelated pieces of state and operations (e.g. search, pagination, auth, cart) | Hook returning $>10$ functions and state variables | `ui-component-analysis` | **High** |
| **Stale Closure Trap in Listeners** | Event handlers or interval loops capturing state without mutable refs or store accessors | Stale state values inside callbacks, missing cleanup in `useEffect` | `ui-component-analysis`, `quality-analysis` | **High** |
| **Dual-Mode Form Clone Drift** | Separate `AddEntityForm.tsx` and `EditEntityForm.tsx` sharing $>80\%$ identical markup/validation | Cloned form components with divergent styling or validation rules | `ui-component-analysis`, `code-duplication` | **Medium** |
| **Bespoke UI Widget Syndrome** | Custom hand-rolled dropdowns, comboboxes, modals, or tooltips lacking accessibility (ARIA) | Missing keyboard navigation, focus trap, or screen reader tags | `ui-component-analysis` | **High** |
| **Bespoke Confirmation Dialog Sprawl** | Independent confirmation modal implementations written across $\ge 5$ different screens | Repetitive modal components handling standard delete/confirm | `ui-component-analysis` | **Medium** |
| **Compiler-Redundant Manual Memoization** | Ubiquitous `useMemo` / `useCallback` wrapping trivial primitives in modern compiler pipelines | Memoization around simple arithmetic or object literals | `ui-component-analysis` | **Low** |
| **Invasive Interaction Overlays** | Absolute-positioned overlay elements stealing click events from underlying interactive targets | CSS `position: absolute; inset: 0` without `pointer-events: none` | `ui-component-analysis` | **Medium** |
| **Runaway Observer / Infinite Scroll Loops** | Intersection observers without boundary guards causing continuous re-fetching and layout shift | Observer callback firing continuously at list boundary | `ui-component-analysis` | **High** |
| **Hook-Provider Conflation** | Context Provider component and consumer hook exported from the same file in `hooks/` | Mixed component JSX and hook logic violating topological separation | `ui-component-analysis`, `codebase-consistency` | **Low** |

---

## 9. Security & Concurrency Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Fragmented Security Sandboxing & Gateway Bypasses** | Microservices or endpoints accessible directly without passing through auth gateway guards | Public route handlers lacking security middleware decorators | `security-audit` | **Critical** |
| **Redundant Remote Session Introspection** | Edge gateways making blocking database queries on every hop instead of local token verification | Remote DB/auth API call in edge route middleware adding 50–200ms latency | `architecture-design-analysis`, `security-audit` | **High** |
| **Route Registry Authorization Bleed** | Coupling route path definitions directly with user role checks or access control rules | Route registry objects containing permission callback functions | `codebase-consistency`, `security-audit` | **Medium** |
| **Unbounded In-Clause Quota Crashes** | Querying datastores with unbounded ID arrays exceeding database parameter limits | `WHERE id IN (...)` without chunked batch partitioning | `security-audit`, `quality-analysis` | **High** |

---

## 10. Documentation & Specification Smells

| Smell / Symptom | Detection Heuristic & Thresholds | Diagnostic Evidence Required | Affected Module | Severity |
|---|---|---|---|---|
| **Subdirectory Micro-Documentation Rot** | Abandoned or conflicting READMEs in subdirectories that contradict root architecture | Subdirectory markdown files referencing deleted functions or obsolete APIs | `project-evaluation` | **Medium** |
| **API Contract & Schema Drift** | API route handlers producing responses that diverge from documented DTOs / schemas | Route handlers returning undeclared fields or omitting required contract fields | `project-evaluation`, `codebase-consistency` | **High** |
