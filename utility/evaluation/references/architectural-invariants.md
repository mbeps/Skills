# Architectural & Code Invariants Reference

Authoritative diagnostic reference adapting core engineering invariants and quality disciplines (derived from large-scale refactorings across modern distributed, protocol-driven, and full-stack systems) into objective evaluation criteria.

Use this reference during codebase evaluations to verify that systems adhere to foundational architectural invariants.

---

## 1. Foundational Disciplines & Safety Invariants

1. **Preserve External Observable Behaviour**: Architectural decoupling and refactoring must never alter public API contracts, database schemas, or observable runtime behaviour without explicit, intentional migration gates.
2. **Clean Baseline First**: Evaluate whether codebases maintain passing test suites, clean static analysis checks, and green production builds before structural modifications.
3. **Characterisation Safety Nets**: Modules flagged as high-churn or high-complexity must maintain comprehensive characterisation tests before any refactoring or structural extractions are attempted.
4. **Enforce Shrink-Only Baselines**: Legacy systems must enforce tool baselines (e.g. linter/typechecker baseline files) so that technical debt only decreases and zero regressions enter CI.
5. **Trace Reachability Before Deleting**: AST call trees, test mocks, and reflection references must be fully traced before declaring any symbol, export, or migration script dead.

---

## 2. Data, Persistence & API Contract Invariants

6. **Schema & Migration Parity**: ORM schema changes must be validated against dry-run migration generations to guarantee zero unintended database drift.
7. **Distributed Cascade Integrity**: Polyglot storage architectures (e.g. relational database rows paired with cloud object storage files) must implement explicit application-level cascade cleanup hooks when foreign key rows are deleted.
8. **Identifier-Only Request Contracts**: Network boundaries must pass resource identifiers and delta payloads rather than trusting client-supplied full state objects, preventing context spoofing.
9. **Atomic Mutations Over Read-Modify-Write**: High-concurrency counters, balances, and quotas must execute atomic database expressions (`SET quota = quota - delta WHERE quota >= delta RETURNING quota`) rather than multi-step SELECT-modify-UPDATE sequences in application memory.
10. **Eliminate Magic Strings with Domain Enums**: Entity statuses, roles, and action identifiers must be centralised in domain enums or frozen string literal unions across application and test code.
11. **Four-Tier Model Segregation**: Systems must maintain strict model segregation:
    - *Raw Database Entities*: Mirroring table schemas.
    - *Core Domain Models*: Rich entities encapsulating domain invariants.
    - *Data Transfer Objects (DTOs)*: Serialised transport contracts.
    - *View / UI Options*: Presentational models and form state.
12. **Standardise Action Result Envelopes**: Server actions and API routes must return uniform envelopes (`{ success: boolean, data?: T, error?: string }`) paired with structured error logging.
13. **Persistence Layer Decoupling (DAO / Repository)**: Direct database and ORM driver queries must be abstracted behind dedicated repositories or domain services, isolating transport handlers from underlying persistence mechanisms.
14. **Chunked Concurrent Batching for Datastores**: Queries taking unbounded arrays in `IN` clauses must partition inputs into fixed batches matching datastore limits and resolve concurrently with `Promise.all` or worker pools.
15. **Nil-Tolerant Zero-or-One Queries**: Optional relations (favourites, drafts, profiles) must invoke nil-tolerant zero-or-one operators (`.maybeSingle()`, `findFirst()`) rather than exact-one assertions (`.single()`) to eliminate 406 / PGRST116 runtime crashes.
16. **Net Impact Quota Replacements**: File updates and asset replacements must compute net difference `(newSize - oldSize)` against user/tenant quotas rather than adding `(currentUsage + newSize)`, preventing false quota rejections for users near limits.
17. **Local Token Claims Verification in Gateway Middleware**: Edge middleware and API gateways must verify cryptographically signed token claims locally (`getClaims()`) instead of triggering blocking network-bound database lookups on every HTTP hop.
18. **Static Reverse-Index Precomputation**: Replace repeated multi-collection scans ($O(N \times M)$) on static or read-heavy datasets with precomputed reverse-index maps (`Map<Key, Entity>`) constructed at module initialisation.

---

## 3. UI, State & Component Invariants

19. **Server vs Client State Separation**: Client stores must be confined to ephemeral UI state (modals, active tabs, client-side drafts); authoritative data mutations must execute on the server and leverage framework cache revalidation.
20. **State Scope & Lifecycle Segregation**: Decouple static client singletons, authoritative identity sessions, and ephemeral UI atoms to eliminate global re-render cascades.
21. **Single Source of Truth Navigation**: Consolidate multi-surface navigation links, labels, and permission gates into declarative registry configurations with dedicated surface adapters.
22. **Unified Dual-Mode Entity Forms**: Consolidate near-identical Create and Edit entity forms into single parametric components to prevent clone drift.
23. **Headless Presentation-Logic Decoupling**: Extract mutation orchestration, URL query synchronisation, and side effects into headless hooks/composables, keeping UI components purely presentational.
24. **Design System Component Facades**: Route primitive UI consumption through internal design system wrappers (`components/ui/*`) to insulate feature components from third-party headless library churn.
25. **Vertical Hook Decomposition**: Decompose monolithic state hooks bundling $>5$ capabilities into single-responsibility, fine-grained reactive hooks colocated in domain folders.
26. **Deterministic Progressive Disclosure**: Replace fragile intersection observer loops with deterministic manual pagination ("Load More" controls) to eliminate runaway network churn, layout shift, and accessibility barriers.
27. **Harmonise with Design System Primitives**: Eliminate bespoke hand-rolled widgets (comboboxes, dropdown menus, modals) by consuming accessible, pre-built design system primitives with native theme tokens and ARIA compliance.
28. **Synchronise Long-Lived Listeners with Mutable Refs**: Guard audio drivers, media callbacks, WebSocket handlers, and interval loops against stale closures by bridging reactive state into mutable refs or store accessors.
29. **Compound Extension Slots Over Invasive Overlays**: Replace invasive absolute wrapper overlays (`position: absolute; inset: 0`) with designated child component slots (`rightAction`) and explicit event propagation boundaries.
30. **URL State Machine Modernisation**: Replace custom, bespoke URL query string synchronisation loops and manual history pushes with type-safe URL query state adapters (e.g. `nuqs`, TanStack SearchParams).
31. **Push Interactivity Boundaries to Leaves**: Push client component boundaries down to leaf interactive controls, converting static presentational wrappers back into server components to eliminate hydration overhead.

---

## 4. Domain Services, Modularity & Granularity Invariants

32: **Sub-Threshold Helper Decomposition**: When decomposing high-complexity functions, ensure extracted helpers do not remain complexity hotspots; push evaluation down to single items.
33. **Standardise Wheels & Wrap External Utilities**: Replace fragile hand-rolled logic (deep cloning, date manipulation, UUID generation) with vetted standard/community libraries wrapped in canonical domain facades.
34. **Fail-Fast Capability Guards**: Reject unsupported capabilities early with typed domain errors and status codes instead of silently degrading input.
35. **Topological Directory Harmonisation**: Colocate private subcomponents in `_components/`, enforce kebab-case naming, and group actions, schemas, and types by domain entity.
36. **Vertical-Slice File-Per-Function Endpoint Isolation**: Decompose monolithic controller and actions files into single-responsibility, file-per-function modules colocated in domain folders with 1:1 unit test files to maximise dead-code elimination.
37. **Framework-Free Pure Domain Logic**: Extract raw database transactions, vendor SDK calls, and business computations into pure, framework-agnostic functions in `lib/`, keeping reactive hooks as thin state orchestrators.
38. **Store-Free Domain Type Centralisation**: Declare domain entities and contracts in dedicated, framework-free `types/` modules so that non-UI services, pure functions, and server actions never import UI state management runtimes.
39. **Decoupled Client & Server Environment Validation**: Strictly decouple public client and server-only configuration schemas. Never evaluate server secrets eagerly during browser or SSR client bundle evaluation. Provide an eager, browser-safe client configuration singleton, and evaluate server secrets lazily on demand.
40. **The Granularity Goldilocks Zone**: Avoid both monolithic god files ($>500$ LOC) and micro-file explosion ($<10$ LOC). Reserve file-per-function decomposition for endpoints/actions with divergent dependencies, while colocating cohesive pure domain helpers operating on identical data shapes.

---

## 5. Tooling, Security & Boundary Invariants

41. **Acyclic Dependency Principle**: The module dependency graph must be a directed acyclic graph (DAG); zero bidirectional import cycles (`A ↔ B`) or peer domain cycles.
42. **Centralised Gateway Authorisation**: Security rules and role checks must be enforced authoritatively at gateway and middleware boundaries rather than scattered ad-hoc across controller conditionals.
43. **Zero Competing Tooling Engines**: The codebase must maintain a unified toolchain without overlapping, conflicting linters, formatters, or parsing engines.
44. **Sunset Ephemeral Migration Assets**: One-off backfills, temporary bridges, and data migration scripts must follow an explicit sunset protocol and be pruned from source control once deployed.
