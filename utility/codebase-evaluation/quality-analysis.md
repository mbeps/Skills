# Quality Analysis Module

Evaluates code quality, cognitive complexity, and design patterns against industry standards and clean code disciplines. Combines quantitative complexity metrics with empirical code smell detection to pinpoint structural risks without suggesting fixes.

For detailed metric formulas and the 147-smell catalog, see [Complexity & Hotspots Reference](references/complexity-and-hotspots.md) and [Code Smells Matrix](references/code-smells-matrix.md).

## When to Use

Use this module when you need to:
- Audit code quality against clean code standards and architectural principles
- Measure Cognitive and Cyclomatic complexity to identify god functions and arrow code
- Compute CRAP scores to evaluate whether complex code is adequately protected by tests
- Prioritise technical debt using the Churn × Complexity Hotspot Matrix
- Detect code smells: Long Methods, God Classes, Primitive Obsession, Feature Envy
- Identify concurrency hazards (Read-Modify-Write races) and resource handle leaks
- Review database schema normalisation and query patterns

## Quantitative Metrics & Gates

### 1. Cognitive Complexity vs Cyclomatic Complexity
- **Cognitive Complexity (SonarQube)**: Measures mental effort to understand control flow. Increases with nesting depth.
  - $\le 15$: Acceptable / Healthy.
  - $16 - 30$: Warning. Elevated maintenance burden.
  - $> 30$: **Critical Hotspot**. High probability of defect introduction.
- **Cyclomatic Complexity (McCabe)**: Measures linearly independent paths. Threshold: $> 10 - 20$.

### 2. CRAP Metric (Change Risk Anti-Patterns)
$$\text{CRAP}(m) = \text{comp}(m)^2 \cdot (1 - \text{cov}(m))^3 + \text{comp}(m)$$
- $\text{CRAP} \le 30$: Healthy testing safety net.
- $\text{CRAP} > 30$: **High-Risk Untested Debt**. Flag as high priority because any modification risks severe regressions.

### 3. Churn × Complexity Hotspot Triaging
Correlate Cognitive Complexity with git commit churn:
- **Red Alert (High Complexity × High Churn)**: Frequently modified god modules. Flag as top-priority critical debt.
- **Yellow / Sleeping Monster (High Complexity × Low Churn)**: Stable legacy code. Note the complexity, but advise leaving it alone until business requirements demand modification.

---

## Code Smell Diagnostic Catalog

### 1. Control Flow & Function Smells
- **Deeply Nested Conditionals (Arrow Code)**: Nesting depth $\ge 4$ indentation levels. Indicates missing early guard clauses or uncomposed pipelines.
- **Long Method / God Function**: Functions exceeding 50 LOC or spanning multiple lifecycle phases (validation, computation, networking, persistence).
- **Long Parameter Lists**: Functions accepting $\ge 4$ positional arguments, causing parameter ordering bugs.

### 2. Domain Modeling & Encapsulation Smells
- **God Class / Monolithic Object**: Classes with $>10$ public methods or $>500$ LOC handling multiple unrelated responsibilities.
- **Primitive Obsession**: Relying on raw primitives (`string`, `number`) for domain concepts (e.g. monetary values, coordinates, phone numbers) instead of dedicated Value Objects with invariant validation.
- **Feature Envy**: Methods calling multiple getters or accessing fields on external objects rather than encapsulating behaviour near data.
- **Untyped Bag-of-Keys**: Passing `Record<string, any>`, `dict`, or loose tuples across service boundaries without schema validation (Zod, Pydantic).

### 3. Reliability & Concurrency Smells
- **Read-Modify-Write & Check-Then-Act Races**: Reading a record to check existence (`SELECT`) and conditionally updating or inserting in application memory rather than using database-level atomic upserts (`ON CONFLICT DO UPDATE`) or optimistic concurrency locks.
- **Shared Handle Registry Eviction**: Prematurely deleting handles in shared resource registries (cancellation tokens, socket pools) without instance equality verification, or running unpartitioned background jobs on the same aggregate entity.
- **Unbounded Context Bloat**: Persisting unabridged worker transcripts, debug outputs, or raw file dumps into conversation history without condensation adapters (`toModelOutput`).
- **Silent Synthesis Drop on Step Budget Exhaustion**: Multi-step agentic or workflow loops stopping on step limits without a fallback synthesis turn, resulting in empty responses.
- **Unresolved Tool-Call Protocol Parity Violation**: Interrupted, failed, or throwing tool executions omitted from tool results, leaving orphaned `tool-call` items in conversational history that crash subsequent model turns.
- **Unpersisted Pipeline Mutation (Silent State Loss)**: Multi-step workflows executing mutating tools without verifying output artifact persistence, causing subsequent steps or downloads to present stale data.
- **Silent Input Degradation / Swallowed Errors**: Empty `catch` blocks or quiet truncation of inputs when capabilities are missing.
- **Unshielded Resource Handles (I/O Leaks)**: Database clients, file streams, or sockets missing deterministic disposal (`try...finally`, `using`).
- **Query Cardinality & Join Polymorphism Fragility**: Using strict `.single()` assertions on existence or nullable queries throwing runtime errors (e.g. PGRST116) on empty sets, and failing to defensively normalize polymorphic join query returns (`Array.isArray(rel) ? rel[0] : rel`).
- **Binary Base64 Serialization Bloat**: Encoding multi-megabyte binary uploads into base64 data URLs for JSON transport rather than streaming via native `FormData`, inflating payload size by ~33% and causing client heap exhaustion.
- **Event-Handler Parameter Bleed**: Passing action dispatchers taking optional parameters directly to DOM/Synthetic event listeners (`onClick={fn}`), which causes event objects to be passed as arguments and corrupts downstream URLs or parameters.
- **Generic Trigger Column Assumptions on Junction Tables**: Applying schema-wide database triggers (e.g. `set_updated_at`) that assume uniform audit columns across all tables, causing fatal database exceptions on join/junction tables lacking target columns.
- **Unstable Dependency Reference Thrashing**: Passing unmemoized collection fallbacks (`props.items || []`, `{}`) into reactive effect dependency arrays, breaking reference equality on every render pass and inducing infinite re-render cascades.
- **Closed-Enum Error Dictionary Assumption & Missing Fallback**: Mapping external service or SDK error codes to user-facing strings via a dictionary without providing a chained fallback (`MAP[code] || error.message || DEFAULT_MESSAGE`), causing blank error alerts on network timeouts or unmapped 5xx responses.
- **Bulk Query Parameter Partitioning & IN-Clause Overflow**: Querying datastores with unbounded ID arrays in `IN` clauses without partitioning into driver-safe batch sizes, crashing in production on large collections exceeding parameter limits.
- **Mount-Time Listener Stale Closures**: Registering event callbacks in third-party or long-lived hooks at mount time without accessing mutable refs or store accessors, causing callbacks to execute with stale initial closure state.
- **Server Action Boolean Return Ambiguity**: Returning bare booleans (`return true / false`) from server actions or mutations rather than structured result envelopes (`{ ok: boolean, data?: T, error?: string }`), preventing callers from diagnosing failure reasons.
- **Missing Pre-Submit File Validation Gate**: Client upload form accepting invalid files into state without pre-submit schema validation (`safeParse`) on file change, causing unvalidated files to persist in input state or fail late with unhandled server rejections.
- **Unmetered Storage Quota Allocation**: Permitting storage writes without user-facing capacity metering and pre-upload quota verification, causing operations to fail silently or throw fatal database/bucket exceptions when account limits are reached.
- **Asynchronous Route Segment Parameter Access**: In modern full-stack frameworks (e.g. Next.js 15+), reading dynamic segment parameters (`params`) or search query parameters (`searchParams`) synchronously without `await` in Server Components or `React.use()` in Client Components, producing runtime warnings and type compilation errors.
- **Isomorphic Module-Level Secret Parsing**: Eagerly validating server-only environment variables at module import time across isomorphic modules, triggering build failures during static analysis or SSR when private keys are not supplied.
- **Unawaited Asynchronous Recursion & Floating Cascades**: Calling recursive async functions or cascade mutations without `await`, causing parent handlers to complete prematurely before descendants are updated or database transactions finalize.
- **Client-Only Browser API Access Without Mount Gating**: Accessing browser globals (`window.location`, `localStorage`) or rendering client-only portals/modals during SSR/initial render without `isMounted` gating, causing client-server hydration mismatch errors.
- **Markdown / Text Regex Code Span Ingestion**: Preprocessing text, formulas, or templating tags using global regex string replacement on raw markdown without shielding inline code spans (`` `...` ``) alongside fenced blocks, corrupting code snippets in body text.
- **Test Mock Hoisting TDZ & Module Path Drift**: Referencing unhoisted variables inside mock factories (`vi.mock` / `jest.mock`) causing Temporal Dead Zone runtime errors, or allowing string mock specifiers to drift from actual refactored module paths.
- **Static Route Parameter Generator Parity on Dynamic Routes**: Failing to export static parameter generators (`generateStaticParams`, `getStaticPaths`) on dynamic routes in SSG / static deployment targets, causing production 404s despite functioning in local SSR development.
- **Naive Date Difference & Ongoing Temporal Boundary Off-by-One**: Calculating elapsed tenure, duration, or age using discrete year subtraction or failing to dynamically resolve active ongoing milestones, producing incorrect or negative duration values.
- **Caught Exception Property Shape Assumptions**: Catching untyped exceptions in catch handlers and directly accessing third-party or SDK shape properties (e.g. `error.errors[0]`, `error.response.data`, `error.issues[0]`) without type guards (`instanceof`, `isAxiosError`, `isZodError`) or fallback accessors (`error?.message`), inducing secondary `TypeError: Cannot read properties of undefined` during error recovery.
- **Schema Nullability vs Optionality Ingestion Mismatches**: Declaring validation schemas with optional-only types (e.g. `z.string().optional()`) that reject explicit `null` values returned from databases, ORMs, or form reset payloads (`{ field: null }`), causing unexpected schema parse rejections during form resets or entity updates.
- **Eager Browser SDK Instantiation in Universal / SSR Execution**: Instantiating browser-only SDKs (e.g. WebSockets, realtime pushers, canvas engines, local storage managers) at top-level module scope rather than inside lazy getters or client mount hooks, causing unhandled runtime crashes or `ReferenceError: window is not defined` during server-side pre-rendering and build-time static generation.
- **Foreign Library Polymorphic Return Shape Traps**: Indexing foreign library returns (openpyxl ranges, pandas slices, numpy arrays) under static dimension assumptions, causing `IndexError` or `TypeError: 'Cell' object is not subscriptable` when single elements collapse from 2D matrices to scalars or 1D vectors, or when empty sheets return empty collections.
- **Destructive Property Setter Hooks on Null/Empty Values**: Assigning `None`, `""`, or default primitives to complex document/chart object properties (e.g. `chart.title = None` or font styling) triggering internal foreign library setter hooks that destructively delete underlying XML node trees or discard inherited formatting.
- **Deep-Branch Unimported Dependencies & Phantom Symbols**: Relying on unimported standard library or third-party symbols (e.g. `math`, `re`, `statistics`) that reside exclusively on rare conditional execution branches (financial calculations, regex filters), passing standard unit tests but crashing with `NameError` in production.
- **Operator & Syntax Rigidity**: Inflexible parsers and filter evaluators that reject common syntactic variants (e.g. requiring strictly `=` and crashing on `==`, or enforcing case sensitivity on operators like `and` vs `AND`), creating unnecessary failure points for clients and AI tool users.
- **Canonical Format Corruption via Ambiguous Locale Parsing**: Ingesting standardized canonical formats (ISO 8601 date strings, UTC timestamps, standardized decimal numbers) using locale-guessing heuristics (such as `dayfirst=True` or locale-dependent comma decimals), corrupting unambiguous data representations.

---

## Report Structure

Each finding includes:

- **Issue Name & Smell Category** – Clear title referencing the smell catalog
- **Location** – File path, line numbers, function/class identifier
- **Metric Baseline** – Cognitive Complexity score, Cyclomatic score, CRAP score, nesting depth
- **Hotspot Classification** – Red Alert (High Churn) / Yellow (Sleeping Monster)
- **Explanation** – Concrete rationale detailing how the code violates clean code disciplines
- **Evidence** – Specific code snippet, commit count, or test coverage percentage
- **Consensus Status** – Fully agreed upon or disputed

---

## Example Findings

**Example 1: High Cognitive Complexity Hotspot (Red Alert)**
- **Issue**: ProcessOrder God Function with Arrow Code
- **Location**: `src/services/OrderService.ts`, lines 45–185 (`processOrder`)
- **Metric Baseline**: Cognitive Complexity = 38 (Critical); Nesting Depth = 5; Commit Churn = 24 commits in 90 days
- **Hotspot Classification**: Red Alert (Top Priority Hotspot)
- **Explanation**: Function executes validation, currency conversion, inventory reservation, payment gateway calls, and notification dispatching in a single 140-line arrow-shaped block.
- **Evidence**: Nesting reaches 5 levels at line 92 (`if (order.items) { for (const item of order.items) { if (item.isDigital) { ... } } }`).
- **Consensus Status**: Fully agreed upon

**Example 2: Untested Complex Function (High CRAP Score)**
- **Issue**: Fragile Parsing Routine Lacking Characterization Tests
- **Location**: `src/parsers/legacy-feed-parser.ts`, lines 12–78 (`parseFeed`)
- **Metric Baseline**: Cyclomatic Complexity = 18; Automated Test Coverage = 0%; CRAP Score = 342
- **Hotspot Classification**: Red Alert
- **Explanation**: Cyclomatic score of 18 combined with 0% test coverage produces a CRAP score of 342 (threshold 30). Modifying this function without tests presents an extreme regression risk.
- **Evidence**: Unit test suite runs 0 tests for `legacy-feed-parser.ts`; file contains 18 branching conditions.
- **Consensus Status**: Fully agreed upon

---

## Example Invocation

```
Evaluate [PROJECT_PATH] for implementation quality and complexity risks.
Audit:
- Functions with Cognitive Complexity > 15 or nesting depth >= 4
- Untested complex modules with CRAP score > 30
- Churn × Complexity hotspots (Red Alert vs Yellow Sleeping Monster)
- Primitive obsession, god classes, and feature envy
- Concurrency race conditions and unshielded resource handles

Provide specific locations, quantitative metrics, and git churn evidence.
```
