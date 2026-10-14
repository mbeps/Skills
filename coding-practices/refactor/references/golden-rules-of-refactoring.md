# The Golden Rules of Refactoring

## Overview
These 100 engineering rules represent timeless, language-agnostic disciplines extracted from large-scale refactorings across modern distributed, protocol-driven, and full-stack software systems. Adhere strictly to these principles before, during, and after any structural code modification.

---

## 1. Foundational Disciplines & Safety Invariants

1. **Preserve External Behavior**: Unit tests, public APIs, and runtime contracts must produce identical observable behavior before and after refactoring. Refactoring changes code structure, never observable business logic.
2. **Establish Baseline First**: Verify passing tests, clean static analysis checks, and green builds before modifying code—never refactor broken code.
3. **Lock Down Characterization Safety Nets**: Expand test coverage across critical paths before high-churn refactoring (e.g. from smoke coverage to comprehensive integration suites).
4. **Take Baby Steps**: Make small, incremental modifications and verify tests after each isolated change rather than performing broad multi-file edits simultaneously.
5. **Commit at Every Green State**: Create atomic checkpoint commits at every passing step to enable instant rollback.
6. **Trace Before Deleting**: Trace symbol reachability, AST call trees, and test mocks before deleting; purge unused local declarations to prevent linter errors.
7. **Full-Spectrum Verification**: Conclude every refactor with unit tests, typechecks, linters, formatter, and production build.
8. **Enforce Shrink-Only Baselines**: Use tool baselines on legacy code to ensure technical debt only decreases and zero regressions enter CI.

---

## 2. Data, Persistence & API Contracts

9. **Schema & Contract Parity**: Run dry-run migration generation to guarantee zero unintended database drift when refactoring ORM models.
10. **Distributed Cascade Integrity**: Explicitly implement application-level cleanup cascades when decoupling monolithic state across polyglot datastores (relational rows + object storage files).
11. **Identifier-Only Request Contracts**: Pass resource identifiers and deltas across network boundaries; reconstruct state and enforce security on the server to prevent context spoofing.
12. **Atomic Mutations Over Read-Modify-Write**: Replace multi-step SELECT-modify-UPDATE sequences with atomic database expressions and RETURNING clauses to prevent race conditions.
13. **Eliminate Magic Strings with Domain Enums**: Centralize entity statuses, roles, and action types in domain enums or string literal unions across application and test code.
14. **Four-Tier Model Segregation**: Enforce distinct contracts between raw database rows, core domain models, serialized transport DTOs, and UI view options.
15. **Standardize Action Result Envelopes**: Return uniform `{ success: boolean, data?: T, error?: string }` responses paired with structured logging across server actions and APIs.
16. **Persistence Layer Decoupling (DAO / Repository Pattern)**: Abstract direct database and ORM queries behind dedicated repository and domain service boundaries, isolating transport handlers from underlying persistence mechanisms.
17. **Chunked Concurrent Batching for Datastores**: When querying datastores with unbounded ID arrays, partition inputs into fixed chunk batches matching engine `IN` limits and resolve concurrently with `Promise.all` / worker pools.
18. **Nil-Tolerant Zero-or-One Queries**: When querying optional relations (favorites, drafts, profile records), invoke nil-tolerant zero-or-one query operators (`.maybeSingle()`, `findFirst()`, `firstOrNull()`) rather than exact-one assertions (`.single()`) to eliminate HTTP 406 / PGRST116 errors and false APM telemetry alerts.
19. **Enforce Fine-Grained Domain Result Contracts**: Model server action and API responses with dedicated domain result types in `types/<domain>/` providing uniform `{ ok: boolean, data?: T, error?: string }` contracts isolated from database schemas.
20. **Account for Net Impact in Quota Replacements**: Enforce tenant/user quotas before global infrastructure capacity, and calculate net difference `(newFileSize - oldFileSize)` on file updates to prevent false quota rejections for users near their limit.
21. **Stateless Local Token Claims Verification in Gateway Middleware**: In edge middleware, API gateways, and reverse proxies, verify cryptographically signed token claims locally (`getClaims()`) instead of triggering network-bound database user lookups on every request, keeping page navigations instant.
22. **Entity-Scoped Data Mapper Isolation**: Decompose monolithic data transformation files into single-responsibility, entity-scoped mapper modules (`mappers/<domain>.ts`) to isolate domain mapping, prevent cross-domain merge conflicts, and simplify unit testing.
23. **Static Reverse-Index Precomputation**: Replace repeated multi-collection scans ($O(N \times M)$) across relations or tags with precomputed reverse-index maps (`Map<Key, number>` or `Map<Key, Entity[]>`) constructed at module initialization or build time. Convert runtime linear scans into instant $O(1)$ lookups.
24. **Keyed Dictionary Transformation & Identity Pruning**: Model static and relational dataset collections as keyed dictionary records (`Record<EntityKey, EntityInterface>`) rather than flat arrays. Prune redundant internal `slug`/`id` properties from the entity contract (the dictionary key *is* the identity) and enforce strongly-typed key enums.
25. **Temporal Value Objectification & Pure Duration Calculation**: Replace unparsed human-readable date strings (e.g. `"Sep 2022 - Present"`) in domain models with structured value objects (`{ month: string, year: number }`) and sentinel constants (`"Present"`). Extract temporal math, date formatting, and experience duration aggregation into pure functions in `lib/` to enable deterministic sorting, range filtering, and clean unit testing.
26. **Static Data Hoisting & Pre-Enrichment**: Replace runtime enrichment loops (functions dynamically inspecting disk assets, thumbnails, or computing fallback media on every render/query pass) with statically declared or build-time attached properties in entity dictionaries. Store entities in their ready-to-render state to eliminate runtime I/O and async waterfall overhead.

---

## 3. UI, State & Component Architecture

27. **Server vs Client State Separation**: Confine client stores to ephemeral UI state; execute direct server mutations and rely on framework cache revalidation for authoritative data.
28. **State Scope & Lifecycle Segregation**: Decouple static client singletons, authoritative identity providers, and ephemeral UI atoms to eliminate re-render cascades.
29. **Single Source of Truth Navigation**: Consolidate multi-surface navigation links and authorization checks into declarative registry configurations with dedicated surface adapters.
30. **Unified Dual-Mode Entity Forms**: Consolidate near-identical Create and Edit entity forms into single parametric components to prevent clone drift.
31. **Headless Presentation-Logic Decoupling**: Extract mutation orchestration, URL query synchronization, and side-effects into headless hooks/controllers, keeping UI markup presentational.
32. **Insulate via Design System Facades**: Route UI primitive consumption through an internal design system facade layer to insulate features from third-party library churn.
33. **Vertical Hook & Composable Decomposition**: Split monolithic state hooks bundling multiple capabilities into single-responsibility, fine-grained reactive hooks colocated in domain folders.
34. **Deterministic Progressive Disclosure**: Replace fragile observer loops with deterministic manual pagination ("Load More" controls) to eliminate runaway network churn, layout shift, and accessibility barriers.
35. **Schema-Driven Form Architecture**: Centralize form validation in declarative schemas with resolver integration, inferring TypeScript submission contracts directly and decoupling submit triggers.
36. **Harmonize with Design System Primitives**: Eliminate bespoke hand-rolled widgets (password reveals, option cards, tab switchers) by consuming accessible, pre-built design system primitives with native theme tokens and ARIA compliance.
37. **Parametric Confirmation Dialogs**: Consolidate high-risk destructive action confirmations (deletions, membership leaves, revocations) into a unified, accessible modal dialog contract.
38. **Declarative Surface Permission Guards**: Standardize restricted or private feature presentation with a shared restriction banner and disabled interaction feedback rather than scattering ad-hoc condition checks.
39. **Depth-Bounded Hierarchical Invariants**: Enforce explicit maximum depth limits on recursive data structures (nested comments, category trees) in domain schemas and UI renderers to prevent mobile layout crushing and recursive query exhaustion.
40. **Synchronize Long-Lived Listeners with Mutable Refs**: Guard audio drivers, streaming media callbacks, WebSocket handlers, and interval loops against stale closures by bridging reactive state into mutable refs or querying authoritative store accessors directly inside the callback.
41. **Invert Control via Compound Extension Slots**: Replace invasive absolute wrapper overlays with designated child component slots (`rightAction`) and explicit mobile action triggers with `stopPropagation()` to eliminate hit-test collisions and gesture latency.
42. **Consolidate Secondary Actions into Dropdown Facades**: Eliminate responsive header button clutter by consolidating multiple adjacent icon buttons into a unified contextual dropdown menu with clear destructive action segregation.
43. **Prune Redundant Inherited Route Boundaries**: Delete duplicate subroute error and loading templates to let errors bubble to root/layout boundaries naturally, reserving specialized boundary files strictly for dynamic entity 404s (`[id]/not-found.tsx`).
44. **Segregate Context Providers from Consumer Hooks**: Place React Context Provider components in `providers/` and lightweight consumer hooks in `hooks/` with fail-fast assertions, keeping hook modules free of JSX and component rendering logic.
45. **Action Lifecycle & Notification Orchestration Hooks**: Consolidate repetitive mutation calls, asynchronous feedback toast promises (`toast.promise`), and router redirects from UI views into dedicated action orchestration hooks (`use<Domain>Actions`).
46. **Insulate Headless Primitive Upgrades Behind Component Facades**: Route primitive migrations (e.g. Radix to Base UI) strictly through internal design system wrappers (`components/ui/*`), shielding consumer components from third-party API churn.
47. **Flatten Redundant Route Group Directories**: Eliminate superfluous organizational route group directories (e.g. `(routes)`) that add path depth without providing layouts, error boundaries, or middleware guards.
48. **URL State Machine Modernization**: Retire custom, bespoke URL query string synchronization loops, manual history pushes, and hand-rolled parameter parsers in favor of battle-tested, type-safe URL query state adapters (e.g. `nuqs`, TanStack SearchParams). Ensure query-to-state parity across drawers, modals, and faceted search.
49. **Strip Over-Abstracted Presentational Wrappers**: Prune trivial single-line wrapper components (e.g. `<Heading1>`, `<SlideUp>`, `<CenteredBox>`) that merely apply isolated CSS classes or forward props without encapsulating accessible state or compound behavior; leverage global typography style layers and design system tokens instead.
50. **Server-Client Component Boundary Refactoring**: Push interactivity boundaries down to leaf interactive controls; convert static presentational components back into server components to eliminate client hydration overhead. Replace client JavaScript scroll scripts with native CSS `scroll-behavior: smooth` and HTML anchor navigation (`<a href="#section">`).
51. **Controller-View Responsibility Segregation in Faceted Listings**: Main entity listing views must be read-only consumers of filter state and collections. Segregate URL query synchronization, debounced text inputs, and filter modal state into dedicated, autonomous filter control components (`FilterSection`), eliminating prop drilling and keeping views purely presentational.

---

## 4. Domain Services, Modularity & Hotspots

52. **Sub-Threshold Helper Decomposition**: Ensure decomposed helpers do not remain complexity hotspots; push evaluation down to single items.
53. **Standardize Wheels & Wrap External Utilities**: Replace fragile hand-rolled logic with vetted standard/community libraries wrapped in canonical domain facades.
54. **Consolidate Repetitive Mutations**: Parameterize common cross-cutting auth, validation, and tenancy logic into higher-order mutation factories.
55. **Fail-Fast Capability Guards**: Reject unsupported capabilities early with typed domain errors and status codes instead of silently degrading input.
56. **Eliminate Trivial Passthrough Wrappers**: Inline 1–2 line wrappers lacking business logic or invariant enforcement to reduce cognitive indirection.
57. **Hybrid Cached Configuration**: Store dynamic operational settings in the database with static fallback constants, read-through caching, and immediate on-demand cache revalidation.
58. **Topological Directory Harmonization**: Colocate private subcomponents with their routes, enforce kebab-case naming, and group actions, schemas, and types by domain entity.
59. **File-Per-Function Endpoint Isolation**: Decompose monolithic action and controller files into single-responsibility, file-per-function modules colocated in domain folders with 1:1 unit test files to maximize dead-code elimination.
60. **Framework-Free Pure Domain Logic**: Extract raw database transactions, vendor SDK calls, and business computations into pure, framework-agnostic functions in `lib/`, keeping reactive hooks as thin state orchestrators.
61. **Store-Free Domain Type Centralization**: Declare domain entities and contracts in dedicated, framework-free `types/` modules so that non-UI services, pure functions, and server actions never import UI state management runtimes.
62. **Centralize Static Asset Registries**: Declare image and media asset paths with canonical alt text in structured registry constants (`config/assets.ts`) to prevent broken links and missing accessibility attributes on renames.
63. **Prune Micro-Dependencies with Internal Primitives**: Replace single-purpose external visual packages (spinners, simple toolbars) with lightweight internal primitives composed from existing icon sets and design system utility classes.
64. **Decoupled Client & Server Environment Validation**: Strictly decouple public client and server-only configuration schemas. Never evaluate server secrets eagerly during browser or SSR client bundle evaluation. Provide an eager, browser-safe client configuration singleton, and evaluate server secrets lazily on demand (via accessors or proxies). Pass explicit dictionary keys for bundler inlining, and support `SKIP_ENV_VALIDATION` for hermetic builds.
65. **The Granularity Goldilocks Rule (Balancing Micro-Files vs God Files)**: Avoid both god modules and micro-file explosion. High-granularity file-per-function decomposition is reserved for endpoints, mutations, and distinct services with disparate dependencies. For tightly coupled pure domain helpers operating on the same data shape, co-locate them in cohesive domain helper modules (`skillUsageHelpers.ts`).
66. **Generic Option & Facet Aggregation Pipeline**: Parameterize repetitive extract-deduplicate-sort-prepend loops across entity listings into a single reusable higher-order pipeline function (`generateFilterOptions<T>`), eliminating boilerplate across faceted filters.
67. **Higher-Order Predicate Filter Abstraction**: Parameterize repetitive multi-entity filtering logic with higher-order predicate filters (`filterKeysByPredicate`), separating iteration, key extraction, and null-checking boilerplate from pure domain predicates.
68. **Type-Enum Decoupling across Interface Boundaries**: Isolate domain enums, status flags, and discriminated union tags from structural interface files into dedicated modules (`enums/` or `types/`) to eliminate circular dependencies between data maps, filters, validators, and UI controls.
69. **Content & Markdown Pipeline Streamlining**: Replace brittle custom regex syntax splitters, ad-hoc inline element handlers, and specialized parser wrappers with standard, extensible AST processing pipelines (e.g., Unified / Remark / Rehype in JavaScript, Goldmark in Go, Mistune in Python) paired with centralized typography stylesheets.

---

## 5. Tooling, Migrations & Testability

70. **Linter & Formatter Hygiene**: Run automated formatting and lint checks after edits to prevent CI failures from whitespace discrepancy.
71. **Expand Boundary Coverage on Swaps**: Broaden test coverage across full scale domains (zeros, negatives, billions, precision limits) when swapping utilities.
72. **Prune Phantom Signals & Orphan Tests**: Remove event dispatches lacking consumers, and co-delete obsolete test suites alongside retired modules.
73. **Approval-Gated Subsystem Retirement**: Obtain explicit user approval before retiring protocols or transports; execute the 7-step retirement playbook.
74. **Sunset Ephemeral Migration Assets**: Prune one-off data migration scripts and temporary bridges once verified to prevent zombie compilation debt.
75. **Hermetic Test Harness Configuration**: Populate deterministic dummy environment variables in test runners to guarantee test suites execute cleanly in CI without live credentials.
76. **The Refactoring-to-Testability Flywheel**: Use granular decomposition (pure functions, focused hooks, validated schemas) to collapse mocking overhead and rapidly scale unit test suites from smoke coverage to exhaustive domain verification.
77. **Synchronize Test Topologies & Prune Duplicate Suites**: Relocate and rename test files synchronously whenever refactoring domain directories, and purge duplicate test files testing the same contract to prevent CI bloat.
78. **Prune Blocker Dependencies from Dead Code Before Major Upgrades**: When major toolchain or compiler upgrades fail peer dependency resolution, audit whether the blocking package belongs to an unused component. Pruning dead code immediately clears the dependency upgrade path.
79. **Dual-Format Identifier Interoperability**: When refactoring persistence drivers, ORMs, or auth engines, always query across both raw string and native object identifier formats (e.g., MongoDB `ObjectId` vs string, UUID vs string) and normalize record identifiers to domain contracts (`fromDoc`) at the repository boundary to insulate consumer layers.
80. **Relational Hydration via Batched Key-Map Joins**: When replacing an ORM that provided automatic relational inclusion (`include`) with a bare driver or document store, eliminate $N+1$ query loops by extracting parent foreign keys into a `Set`, executing a single batched lookup query, indexing into an in-memory `Map`, and hydrating child collections in memory.
81. **Compiler-Enabled Manual Memoization Stripping**: When upgrading to optimizing compilers (React Compiler, Svelte 5 runes, Vue Vapor), systematically audit and strip manual `useMemo` and `useCallback` hooks to eliminate brittle dependency arrays, closure traps, and verbose boilerplate.
82. **Speculative Infrastructure Schema Pruning**: Prune database models, columns, and foreign keys for features that lack operational backend infrastructure (e.g., email verification tokens without an SMTP server, subscription tables without a billing provider) to eliminate ghost schema debt.
83. **Redundant Navigation Pathway & Action Decoupling**: Consolidate secondary user management actions (Profile, Security, Sessions, Logout) exclusively into contextual profile dropdowns/modals. Strip action callbacks and SDK imports from route navigation hooks, keeping them pure, declarative navigation structures.
84. **Subdirectory Documentation Debt Pruning**: Purge decaying, low-signal micro-README files scattered in leaf code directories (`components/`, `hooks/`, `types/`, `actions/`) in favor of centralized root architecture docs (`README.md`, `CLAUDE.md`, `AGENTS.md`), strong typing, and automated test suites.
85. **Test Runner DOM Isolation & Server Environment Validation Parity**: Ensure environment validation distinguishes between true browser runtimes and DOM-simulated Node.js test environments (`typeof window === "undefined" || Boolean(process.env.VITEST || process.env.JEST_WORKER_ID)`) so server-side schemas validate properly during unit tests under jsdom.
86. **Feature-Frozen Architectural Engine Migration**: When replacing foundational engines (auth providers, ORMs, build tools), achieve 100% behavioral and API parity in the initial migration commit before introducing new features or capabilities in subsequent commits.
87. **Infrastructure Orchestration Simplification**: Collapse sprawling, bespoke multi-directory Dockerfiles and scripts into a single, standardized root orchestration manifest (e.g. `docker-compose.yml`) to reduce environment drift and maintenance friction.
88. **Declarative Gateway & Endpoint Schema Validation Parity**: Replace ad-hoc imperative field checks and manual regex tests in API routes and server actions with declarative schema validation (`schema.safeParse(body)`). Return uniform structured 400 error payloads (`fieldErrors`) and share identical validation schemas between client forms and backend route handlers to ensure full contract parity across network boundaries.
89. **Decoupled Route Hierarchy vs Application Architecture**: Segregate file-system-based routing directories (e.g. Next.js `app/`, Remix `routes/`) strictly to route segment definition (`page.tsx`, `layout.tsx`, `route.ts`, and private `_components/`). Move cross-cutting application concerns (`components/`, `hooks/`, `schemas/`, `types/`, `actions/`, `config/`, `providers/`, `utils/`) to root-level domain directories to eliminate routing tree pollution, prevent circular path traverses, and enable modular testing.
90. **Domain-Grouped Route Registry with Clean Access Control Separation**: When refactoring centralized route registries, group paths into hierarchical domain records using base path constants (`BASE = "/..."`), static `path` strings, and typed dynamic path builders (`detail: (id) => ...`). Strictly isolate authentication policies and middleware route guards (`isProtected`) from the route registry itself into dedicated middleware/proxy configurations to prevent leaking authorization concerns into navigation addresses.

---

## 6. Protocols, Interface Boundaries, Engines & Lifecycle Invariants

91. **Action-Dispatcher Interface Consolidation**: In agentic, RPC, and CLI systems where micro-endpoints proliferate, consolidate fine-grained operations into domain-grouped multi-action endpoints parameterized by an explicit `action` enum. Keep underlying implementation functions modular and single-responsibility while presenting a compact, context-efficient API surface to callers, preventing prompt/context exhaustion and tool hallucination.
92. **Composition Root & Router-Layer Decoupling**: Isolate server bootstrap and transport runtimes (FastMCP, Express, FastAPI, Gin) from route definitions. Keep the entrypoint (`main.py` / `server.ts`) purely as a composition root that mounts modular domain router packages (`routes/<domain>`), preventing monolithic controller bloat and coupling.
93. **Domain-Model & Typed Contract Parity**: Replace untyped bags-of-keys (`dict`, `dict[str, Any]`, `map[string]interface{}`, opaque JSON blobs) across service boundaries with strongly typed domain models (Pydantic, TypedDict, dataclasses, Zod). Enforce strict contract parity between declared endpoint signatures and actual runtime return payloads to eliminate silent validation failures and deserialization drift.
94. **High-Fidelity Engine Unification**: When managing complex structured file formats or documents, standardize mutations exclusively on the authoritative engine that preserves semantic fidelity (styles, formulas, metadata, AST structures), relegating analytical engines strictly to read-only projections to prevent formatting corruption and data degradation.
95. **Speculative Model & Dead Type Pruning**: Systematically audit type registries and model files against the AST call graph to delete speculative models, unreferenced TypedDicts, and dead constants. Prune corresponding orphan tests so test suites verify active production contracts rather than zombie abstractions.
96. **Canonical Boundary Guard Encapsulation**: Enforce authorization, security checks, and path validation strictly inside canonical library wrappers (`load_safe`, `save_safe`). Prune redundant defensive pre-checks from calling tools to eliminate call-site boilerplate and guarantee consistent protection across all consumers.
97. **Harmonized Security Invariants across Evaluators**: Centralize dynamic evaluation security checks (AST visitors, dangerous attribute bans, safe function allowlists) into shared security invariants, ensuring every evaluation path applies identical constraints without sandbox escape vectors or inconsistent rule enforcement.
98. **Guaranteed Resource Lifecycle Invariants**: Enforce deterministic resource closure (file descriptors, sockets, database transactions) using language context managers or explicit `try / finally` cleanup blocks wrapping all early-return and error paths to prevent resource exhaustion and file lockouts under concurrency.
99. **Canonical Low-Level Utility Consolidation**: Parameterize repeated 3–5 line low-level routines (attribute copying, hidden metadata persistence, coordinate arithmetic) into shared canonical utilities, widening signatures to support common variations and deleting private redundant wrappers.
100. **Protocol & Server Decoupling via Dummy Test Adapters**: Create lightweight in-memory test doubles (Noop/Mock server adapters) implementing framework registration interfaces so endpoint registration and domain logic can be tested in sub-second unit test runs without spinning up external servers, networks, or process runtimes.

