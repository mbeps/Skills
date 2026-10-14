# Tool-Assisted Refactoring: Static Analysis & Quality Gates

Refactoring manually by visual inspection alone is slow and error-prone. Modern static analysis engines build module dependency graphs, compute complexity indices, and trace symbol reachability across entire codebases. This reference provides tool-assisted refactoring workflows across language ecosystems.

---

## 1. Toolchains Across Language Ecosystems

| Quality Dimension | TypeScript / JavaScript | Python | Go | Java / Kotlin | Rust |
|---|---|---|---|---|---|
| **Dead Code Detection** | `fallow dead-code`, `knip` | `vulture` | `deadcode` | `PMD` (UnusedRules) | `cargo-udeps`, `cargo-deadpool` |
| **Complexity Metrics** | `fallow health` (cognitive/cyclomatic/CRAP) | `radon`, `xenon` | `gocyclo`, `gocognit` | `SonarQube`, `Checkstyle` | `cargo-geiger`, `clippy` |
| **Code Duplication** | `fallow dupes` (AST/semantic), `jscpd` | `flake8-clone-detection` | `dupl` | `PMD CPD` | `cargo-duplicate` |
| **Architectural Boundaries** | `fallow architecture`, `dependency-cruiser` | `import-linter`, `cohesion` | `depguard` | `ArchUnit` | `cargo-deny` |
| **Differential PR Audit** | `fallow audit --base main` | `git-diff-lint` | `reviewdog` | `SonarCloud PR Analysis` | CI diff scripts |

---

## 2. Core Tool-Assisted Workflows

### Workflow 1: Trace Before Delete and Export Minimization
Static analyzers frequently flag exports as "unused" because no internal production modules consume them.
- **Rule 1 (Trace Reachability First)**: Never delete a symbol without tracing its reachability graph first.
  - In TypeScript/JS: Run `fallow dead-code --trace <path>:<symbol>` to verify whether the export has external consumers, dynamic imports, or entry-point status.
  - In Python: Run `vulture --min-confidence 80` and verify against `__all__` declarations.
  - In Go: Run `go vet` and check if the symbol is exported (`Uppercase`) for external module consumers.
- **Rule 2 (Scope Minimization vs. Linter Unused Variables)**:
  - When removing `export` (or `pub` / `export type`) to make a symbol internal, verify whether it is actually referenced within that same file.
  - If making a symbol file-local leaves it with zero references inside that file, **delete the declaration entirely**. Merely dropping the `export` keyword causes linters and compilers (e.g. `noUnusedVariables`, `unused-variable`, `dead_code`) to fail on an unused local declaration.
- **Rule 3 (Test-Mocked Surface vs. Production Entry Points)**:
  - When a component or class method is mocked or checked in test suites (e.g. `vi.mock("@/components/...", () => ({ Component: ... }))`) or retains interface telemetry contracts, whole-program tree shakers may flag the production export as unused.
  - In such cases, keep the export and add an explicit analyzer suppression comment with justification rather than breaking test harnesses or public API shape.
- **Rule 4 (Trace Message & Event Subscriptions)**:
  - Static analyzers trace direct symbol imports, but string-keyed message events (e.g. `queue.send({ name: "event" })`, `eventBus.emit(...)`) often slip through.
  - Audit event and message broadcasts: if no worker, queue step, or subscriber consumes the event, delete the phantom dispatch, prune the unused event payload type, and update mock assertions in tests.
- **Rule 5 (Prune Test Suites Alongside Orphan Modules)**:
  - When purging an obsolete module (e.g. custom encoding helpers replaced by modern runtime/framework streams), delete its dedicated test file (`*.test.ts`, `test_*.py`) in the same refactoring commit.
  - Never retain passing unit tests that only validate abandoned, uncalled code.


### Workflow 2: Automated Fixes with Mandatory Dry-Run
When tools support auto-removal of dead imports or unused code:
1. **Always dry-run first**: Inspect planned deletions (e.g. `fallow fix --dry-run`).
2. **Review diff**: Confirm no active side-effect imports (CSS, polyfills, environment initializers) are purged.
3. **Apply**: Execute destructive modifications with non-interactive flags (e.g. `fallow fix --yes`).

### Workflow 3: Incremental Refactoring via Baselines
On large legacy codebases, running a full analyzer can reveal hundreds of pre-existing issues. Blocking all feature work until everything is clean causes paralysis.
- **The Solution**: Capture a baseline snapshot of the current state:
  ```bash
  # Save current findings as an accepted baseline
  fallow --save-regression-baseline
  ```
- **Enforce Shrink-Only Baselines in CI**: Configure the quality gate to fail only if **new** issues are introduced, or if an issue is added without fixing an existing one:
  ```bash
  fallow audit --base main --gate new-only
  ```
- This ensures code health only improves over time without blocking active feature delivery.

### Workflow 4: Prioritizing Hotspots
1. Run complexity & hotspot analysis:
   ```bash
   fallow health --hotspots --targets
   ```
2. Identify functions where **Cognitive Complexity > 30** AND **Commit Churn > 20**.
3. Add unit test coverage to drive down the CRAP score before touching the implementation.
4. Refactor using Extract Method and Guard Clauses.
5. Re-run analysis to confirm complexity scores dropped and zero cycles or dead exports were introduced.

### Workflow 5: Test Mock Blast Radius and Multi-Tier Verification
When deleting dead files, changing export signatures, or extracting helpers, callers in production code are only half the blast radius:
1. **Audit Test Mocks & Fixtures**: Search across test suites for mock definitions (`vi.mock`, `jest.mock`, `unittest.mock.patch`, `gomock`). Renaming or deleting an internal module without updating mock paths causes silent runtime test mocks against ghost modules or breaks test execution.
2. **Co-located Unit Tests & Boundary Test Expansion**: When extracting standalone helper modules or swapping hand-rolled routines for standard/third-party utilities, write dedicated co-located unit tests immediately. Expand test suites to cover boundary conditions across full scale ranges (e.g., zeros, negative values, scale jumps from thousands to billions, precision rounding) to lock in the expanded contract.
3. **Multi-Tier Verification Protocol**: Never rely solely on unit tests. Complete refactoring runs through:
   - **Static Analysis Gate**: 0 unresolved imports, 0 circular dependencies, 0 dead files (`fallow dead-code`, `fallow architecture`, `knip`).
   - **Schema Migration Parity Check**: When refactoring ORM schemas or model definitions, run schema generation dry-runs (`drizzle-kit generate`, `alembic check`, `flyway validate`) to guarantee 0 unwanted schema alterations or data loss migrations.
   - **Linter & Formatter Gate**: Run both linter and code formatter checks (`biome check`, `eslint`, `prettier --check`, `ruff format --check`, `gofmt -l`). Always verify file formatting after automated or manual edits to prevent CI pipeline failures on trailing whitespace or newline discrepancies.
   - **Type Checker**: Clean compiler output (`tsc --noEmit`, `mypy`, `go vet`, `cargo check`).
   - **Target Unit Tests**: Execute affected test files first for fast feedback.
   - **Full Test Suite**: Execute full test run to confirm zero transitive regressions.
   - **Production Build & Asset Wiring**: Execute framework bundler/compiler (`next build`, `cargo build --release`, `go build`, `mvn package`). Ensure utility stylesheets or design tokens flagged as unreferenced are explicitly wired into root stylesheets rather than orphaned.
   - **Manual Smoke Path**: Define concrete manual interactions (UI navigation, API calls) for human verification.

### Workflow 6: Ephemeral Migration Asset Sunset Protocol

One-off migration scripts, seed generators, data fixers, and temporary test bridges are frequently written to facilitate architectural transitions (e.g. `scripts/migrate-legacy-to-new-store.ts`, temporary mock adapters, or data backfill scripts).

#### The Zombie Code Risk:
Once a data migration or subsystem retirement completes in production, leaving one-off migration scripts in the active codebase creates "zombie code":
1. **Compilation & Type Errors**: As core domain types, schemas, and ORM interfaces evolve, unmaintained migration scripts fail compiler type-checks (`tsc --noEmit`, `mypy`, `go vet`).
2. **Analysis Noise**: Dead code and linter tools flag them as unused or broken dependencies.
3. **Accidental Execution**: Future developers or CI scripts may inadvertently re-run legacy migration scripts against production datastores.

#### The Sunset Protocol:
1. **Verification Gate**: Verify that the migration has completed across all environments (staging, production) and that target record counts and queries match.
2. **Delete Ephemeral Scripts**: Surgically delete one-off scripts, temporary bridges, and data patchers in the subsequent cleanup commit.
3. **Archive via Version Control**: Version control history and release tags preserve the scripts permanently for audit purposes. Do not keep them in active source directories.
4. **Clean Verification**: Run compiler and static analysis suites to confirm zero lingering references:
   ```bash
   # TypeScript / Next.js
   npm run build && npx fallow dead-code
   # Python
   mypy . && vulture
   # Go
   go vet ./... && deadcode ./...
   ```

---

## 3. Dependency Alignment and Manifest Hygiene

Refactoring manifests and package dependencies (`package.json`, `pyproject.toml`, `go.mod`, `pom.xml`, `Cargo.toml`):

1. **Purging Dead Dependencies**:
   - When code refactoring eliminates all references to an external library, uninstall it via the project package manager rather than leaving it in the manifest.
   - Run dependency checkers (`fallow dead-code`, `cargo-udeps`, `pip-check`) to detect unreferenced third-party packages.
2. **Production vs Development Classification**:
   - Ensure tools and plugins utilized by production asset pipelines (e.g. CSS build plugins, code generation runtimes, template engines) are in `dependencies` rather than `devDependencies` so deployment builds in clean container environments do not fail.
3. **Lockfile Synchronization**:
   - Always run the package manager's install/sync step (`npm install`, `poetry lock`, `cargo check`) after manifest edits to keep lockfiles strictly synchronized.
4. **Adopting Utility Dependencies Responsibly**:
   - Before adding an external package during refactoring, evaluate whether the runtime standard library (e.g., `Intl.NumberFormat`, `java.time`, `std::fmt`) already provides the required capabilities without dependency overhead.
   - When adopting a community package (e.g. `millify`, `humanize`, `date-fns`), evaluate package weight, tree-shakability, and license.
   - Add the dependency via package manager commands rather than manual manifest edits, keeping the lockfile in sync.
5. **Subsystem & Environment Orchestration Parity**:
   - When introducing or decoupling an infrastructure service (e.g. vector database, Redis cache, message queue), ensure environment schema validation (`config/env.ts`, `.env.example`), container definitions (`docker-compose.yml`), and idempotent data migration scripts (`scripts/migrate-...`) are authored and tested in lockstep before purging legacy schema tables.

---

## 4. Pre-Refactoring Characterization Safety Net and Test Mock Alignment

Refactoring without tests is reckless; refactoring with stale or misaligned test mocks is dangerous.

### Step 1: Pre-Refactoring Test Harness Expansion
Before initiating wide-reaching structural refactoring (e.g. decomposing 500-line monolithic action files or migrating frameworks):
- **Write Characterization Tests First**: Lock down existing observable behavior with unit and integration tests across happy paths, boundary values, and error states. Expanding test coverage from minimal smoke tests to comprehensive suite coverage (e.g., 40+ to 400+ tests) before touching production code guarantees that regressions are detected instantly.
- **Mirror Domain Topologies in Test Directories**: Organize test suites to mirror production domain structures (`__tests__/actions/cars/`, `__tests__/hooks/`, `__tests__/components/`) rather than creating monolithic test grab-bags.

### Step 2: Test Mock Blast Radius & Path Realignment
When decomposing monolithic services into dedicated action files or re-homing utilities:
- **Leaf-Path Mocking**: Test mocks (`vi.mock`, `jest.mock`, `unittest.mock.patch`) must mock the direct leaf source module, not intermediate re-export barrels.
- **Hermetic Test Harness Configuration**: Ensure test runners load explicit dummy environment variables (`vitest.setup.ts`, `conftest.py`) so tests run self-contained in CI without network access or ambient developer `.env` files.

---

## 5. Observability Refactoring: Structured Logging and Error Boundary Instrumentation

Ad-hoc `console.log()` and `console.error()` statements pollute stdout, lack log levels, and fail to capture machine-parseable metadata during production incidents.

### The Remediation: Structured Leveled Loggers & Lifecycle Instrumentation
Replace ad-hoc prints with structured logging libraries (LogTape in TypeScript/JavaScript, `structlog`/`logging` in Python, `log/slog` in Go, SLF4J/Logback in Java):

1. **Server Lifecycle Instrumentation**:
   Register and configure logging infrastructure within framework application lifecycle hooks (such as Next.js `instrumentation.ts` via `register()`, FastAPI lifespan context managers, Spring Boot `ApplicationRunner`, or Gin `Engine.Use(...)`). This guarantees loggers and category filters are active before the first route handler or server component processes requests.
2. **Context-Aware Sinks (Runtime vs Test Environments)**:
   - **Production / Runtime**: Use non-blocking asynchronous sinks (`nonBlocking: true`) so logging I/O never increases request latency or stalls async operations.
   - **Automated Test Runners**: Switch to synchronous sinks (`nonBlocking: false` when `isTestEnvironment()` evaluates true) to eliminate race conditions where test runners (Vitest, Jest, Pytest) finish and tear down the process before async log buffers flush, losing crucial error traces.
3. **Column-Aligned Visual Scannability**:
   Format logs with aligned columns: timestamps (`HH:mm:ss.SSS`), fixed-width levels (`INFO   `, `WARNING`), category hierarchies (`app·actions·docs`), and dimmed delimiters (`│`).

```diff
# BEFORE: Fragile, unparseable console prints
- console.log("Deleting car", carId);
- if (err) console.error("Failed to delete bookings", err);

# AFTER: Leveled, structured logging with contextual metadata
+ const log = getLogger(["app", "actions", "cars"]);
+ log.info("Initiating car deletion (id: {id})", { id: carId });
+ if (err) {
+   log.error("Failed to delete associated bookings for car (id: {id}): {message}", {
+     id: carId,
+     message: err.message,
+   });
+   throw err;
+ }
```

```typescript
// instrumentation.ts - Server Lifecycle Hook Registration
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureLoggingSync } = await import("@/lib/logger");
    configureLoggingSync();
  }
}
```

### Logging Hygiene Rules:
1. **Never Log Sensitive Data**: Strip passwords, session tokens, secret keys, credit card numbers, and PII from log context payloads.
2. **Contextual Correlation**: Always attach domain identifiers (`id`, `userId`, `tenantId`) to log records to enable tracing across distributed services.
3. **Appropriate Log Levels**:
   - `DEBUG`: Verbose execution traces, payload sizes, loop counts.
   - `INFO`: Successful state transitions (entity created, deleted, role updated).
   - `WARN`: Recoverable degradation (storage cleanup partial failure, quota near limit).
   - `ERROR`: Unhandled failures, database transaction aborts, security violations.

---

## 6. Toolchain Unification and Legacy Configuration Pruning

Over time, projects accumulate fragmented, overlapping linting and formatting tools (e.g. ESLint + Prettier + Stylelint + custom plugins; Flake8 + Black + isort). Maintaining multi-tool pipelines introduces configuration conflicts, slow CI runs, and massive lockfile bloat.

### The Migration Playbook:
1. **Migrate to Modern Unified Engines**: Replace fragmented tools with single-binary, high-performance toolchains (e.g. Biome for JavaScript/TypeScript; Ruff for Python).
2. **Prune Redundant Manifest Packages**: Uninstall legacy linter plugins, parser packages, and prettier plugins from `package.json` / `pyproject.toml`.
3. **Delete Residual Configuration Files**: Surgically remove obsolete config files (`.eslintrc*`, `.prettierrc*`, legacy build configs) to prevent editor tooling conflicts.
4. **Resynchronize Lockfiles**: Run package manager install steps to prune thousands of lines of unneeded transitive dependencies from lockfiles (`yarn.lock`, `package-lock.json`, `poetry.lock`).
5. **Calibrate Linter Scope & Test Inclusions**: Configure directory patterns in the unified toolchain configuration (`biome.json`, `ruff.toml`) to explicitly handle test directories (`__tests__/**`), mock setups, and generated artifacts (`_generated/**`), preventing false linter failures on test-specific patterns.

### Blocker Dependency and Dead Feature Pruning:
Major runtime and compiler upgrades (e.g. Node 24, React 19, TypeScript 7, Next.js 16) are frequently stalled by dependency resolution errors (`ERESOLVE`, incompatible peer dependencies).
- **The Pitfall**: Teams often delay compiler upgrades or fight complex dependency overrides for months because an obscure transitive dependency fails peer resolution.
- **The Remediation**: Audit whether the blocking dependency is tied to an active, necessary feature. Frequently, the blocker belongs to an unused or abandoned component (e.g. an unreferenced `calendar.tsx` depending on an outdated `react-day-picker`).
- **Prune Dead Leaves First**: Delete the unused component, uninstall the blocking package, and re-run the core upgrade. Pruning dead code immediately clears the dependency path.

### Type Checker & Static Analysis Modernization:
Migrate from slow, rigid, or legacy static analysis setups (e.g., legacy MyPy setups with brittle stub configurations) to modern, high-throughput analyzers (e.g., Pyrefly or Pyright for Python; Biome or Oxlint for JavaScript/TypeScript). Fast analysis lowers developer feedback loops from minutes to seconds, catching contract drifts immediately.

### Task Runner Script Standardization:
Eliminate fragmented, ad-hoc shell commands across developer machines and CI pipelines by centralizing workflow commands in standardized task runner manifests (e.g., Poe the Poet in `pyproject.toml`, `scripts` in `package.json`, or Makefiles). Ensure unified tasks exist for `test`, `lint`, `format`, and `typecheck` so verification commands behave identically in local terminals and automated CI gates.

### Utility Packaging Optimization:
Replace hand-rolled boilerplate utility combinations (such as bespoke `clsx(inputs)` + `twMerge(...)` helpers in `lib/utils.ts`) with modern canonical direct exports (e.g. `export { cn } from "cn";`) to eliminate unnecessary local wrapper code and reduce maintenance overhead.

---

## 7. The Refactoring-to-Testability Flywheel (Unlocking Test Coverage Scaling)

**The Problem: Testability Paralysis in Monolithic Architectures**
When a codebase is dominated by god components, tangled reactive hooks, and hardcoded inline configurations, writing tests feels impossible. Testing a minor user action requires configuring 15 mock dependencies, database clients, router context, and global state providers. Under this friction, test suites stagnate or are abandoned (e.g. 15–20 smoke tests for an entire production application).

```
┌────────────────────────────────────────────────────────────────┐
│ The Vicious Cycle: Monoliths Prevent Testing                   │
│ Monolithic Code ➔ Complex Mocking ➔ Testing Abandoned ➔ Fragile │
└────────────────────────────────────────────────────────────────┘
                               ▲
                               │ Refactoring Breaks the Cycle
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ The Refactoring-to-Testability Flywheel                        │
│ 1. Decompose into Pure Functions & Granular Hooks              │
│    ├── Zero-mock pure domain functions in lib/                 │
│    └── Single-responsibility hooks in domain folders           │
│ 2. Mocking Surface Collapses to Near Zero                      │
│ 3. Writing Unit Tests Becomes Frictionless & Fast              │
│ 4. Test Suite Scales Rapidly (e.g., 17 ➔ 428+ Tests)          │
│ 5. Comprehensive Safety Net Guarantees Zero Regressions        │
└────────────────────────────────────────────────────────────────┘
```

### The 4-Tier Test Expansion Playbook:

```
Tier 1: Schema & Contract Tests (Zero Mocks Required)
  └── schema/*.test.ts (Validates boundaries, email regex, min/max limits)
Tier 2: Pure Domain Service Tests (Mock Leaf DB Driver Only)
  └── lib/**/*.test.ts (Pure business logic, transactions, transforms)
Tier 3: Granular Hook / Composable Tests (Single Mock per Hook)
  └── hooks/**/*.test.tsx (Tests isolated state transitions)
Tier 4: Presentational Component Tests (Smoke & Accessibility)
  └── components/**/*.test.tsx (Verifies rendering & user interaction)
```

1. **Tier 1: Schema & Contract Tests (Zero Mocks)**
   Because schemas (`schema/auth.ts`, `schema/post.ts`) are pure declarative contracts, testing them requires zero mocking. Write parameterized test tables validating valid inputs, edge cases (empty strings, Unicode, boundaries), and invalid inputs.
2. **Tier 2: Pure Domain Service Tests (Mock Only Leaf DB / SDK)**
   Once business logic is extracted from UI hooks into pure functions in `lib/`, testing no longer requires virtual DOM renderers (`renderHook`, `@testing-library/react`). Feed mock database clients directly into the function and assert returned results.
3. **Tier 3: Single-Responsibility Hook Tests**
   With god hooks dismantled into focused units (`usePostVote`, `usePostDeletion`), testing each hook requires mocking *only* the single atom or API call it orchestrates. Test execution runs in milliseconds.
4. **Tier 4: Presentational Component Tests (Smoke & Accessibility)**
   With data fetching and business mutations extracted into schemas, lib functions, and focused hooks, UI component tests focus strictly on markup rendering, user interactions, loading states, and accessibility contracts. Mock only the custom hooks at the boundary.
5. **Prerequisite: Hermetic Environment Parity**
   Configure test runners with deterministic mock environment variables in setup files (`vitest.setup.ts`, `conftest.py`, `jest.setup.js`). Ensure tests never attempt live network connections or fail due to missing ambient developer `.env` files.
6. **Topological Test Synchronization & Duplicate Pruning**:
   When refactoring folder structures (such as singularizing domain directories or renaming modules), relocate test files and paths synchronously (`__tests__/schemas/album/createAlbum.schema.test.ts`). Audit test folders for duplicate test suites (e.g. `create-album.test.ts` and `create-album.schema.test.ts` testing the same schema under different names) and prune obsolete copies to eliminate redundant CI execution time and maintain accurate test counts.

---

## 8. Container and Infrastructure Orchestration Simplification

**Symptom**: Development and local infrastructure environments are fragmented across multiple subdirectories containing bespoke Dockerfiles, separate compose files, and obsolete setup documents (e.g. `docker/mongo/Dockerfile`, `docker/next/Dockerfile`, `docker/docker-compose.yml`, `docker/README.md`, `docker/next/README.md`).

### The Problem:
1. **Configuration Drift & Stale Base Images**: Sprawling Docker subdirectories duplicate port mappings, volume mounts, and environment variable names, quickly drifting out of sync with application config.
2. **Onboarding Friction**: Developers and CI runners must remember bespoke subfolder paths (`docker compose -f docker/docker-compose.yml up`) or run custom wrapper scripts.
3. **Redundant Build Layers**: Building custom Dockerfiles for standard databases (e.g. MongoDB, Postgres, Redis) when standard official images (`image: mongo:latest`) with standard health checks and volume mounts suffice.

### The Remediation: Consolidate into a Single Root Manifest
1. **Collapse to Root `docker-compose.yml`**:
   Define all required local backing services (databases, caches, mock SMTP, storage emulators) in a single declarative root `docker-compose.yml`.
2. **Leverage Standard Official Images**:
   Replace custom subfolder Dockerfiles with standard official vendor images (`image: mongo:latest`, `image: postgres:17`), configuring credentials via standard environment variables and root `.env`.
3. **Purge Obsolete `docker/` Subdirectories**:
   Delete redundant subfolder Dockerfiles, sub-compose files, and out-of-date container documentation.
4. **Standardize Root Package Scripts**:
   Add intuitive root scripts (`"db:start": "docker compose up -d"`, `"db:stop": "docker compose down"`) in `package.json` / `Makefile`.

```diff
# BEFORE: Sprawling multi-directory container sprawl
- docker/mongo/Dockerfile
- docker/next/Dockerfile
- docker/docker-compose.yml
- docker/README.md
- docker/next/README.md

# AFTER: Single, canonical root manifest with zero custom dockerfile overhead
+ docker-compose.yml (50 lines: standard mongo, postgres, or redis services with healthchecks)
```

### Architectural Benefits:
1. **Instant Developer Setup**: A single `docker compose up -d` at repository root provisions the entire local environment.
2. **Zero Custom Container Maintenance**: Standard official images receive upstream security patches automatically.
3. **Repository Tree Cleanliness**: Eliminates 5+ unnecessary files and subdirectories.

### Cross-Stack Architectural Parallels:
- **TypeScript / Node.js**: Root `docker-compose.yml` for MongoDB/Postgres + Redis.
- **Python / Django / FastAPI**: Root `docker-compose.yml` for Postgres + Celery worker + Redis.
- **Go**: Root `compose.yaml` for database and local S3 emulation (MinIO).
- **Java / Spring Boot**: Root `compose.yaml` paired with Spring Boot 3.1+ Docker Compose Integration.

---

## 9. Test Harness Decoupling via Noop / Dummy Protocol Adapters

**Symptom**: Testing API endpoints, CLI commands, or protocol server tools (e.g. FastMCP, GraphQL schemas, gRPC services) requires instantiating the entire framework runtime, opening network sockets, or managing async daemon lifecycles during unit testing.

### The Problem:
1. **Slow Unit Test Execution**: Booting full server runtimes and transport listeners inflates test execution times by orders of magnitude.
2. **Flaky Port and Socket Collisions**: Concurrent CI jobs or parallel test runners (pytest-xdist, Vitest worker threads) collide on open network ports or IPC sockets.
3. **Complex Mocking Overhead**: Testing registration logic requires mocking deeply nested framework internals (protocol transports, event loops, session managers).

### The Remediation: Lightweight Noop / Dummy Registration Adapters
Create a minimal zero-dependency in-memory test double adapter class (e.g. `NoopMCP`) that satisfies the server registration interface without launching server runtimes or transports. The test double captures registered tools/routes in an internal dictionary for instant in-memory assertion:

```diff
# BEFORE: Tests spin up heavy FastMCP server runtime with background transports
- from mcp.server.fastmcp import FastMCP
- mcp = FastMCP("test-server") # Starts full framework machinery, asyncio loops, etc.
- register_routes(mcp)
- # Slow test run, difficult to assert on tool registry

# AFTER: Decoupled Noop protocol adapter for sub-second, zero-dependency testing
+ class NoopMCP:
+     """Lightweight test double capturing tool registrations in-memory."""
+     def __init__(self):
+         self.tools = {}
+
+     def tool(self, name: str | None = None, **kwargs):
+         def decorator(fn):
+             tool_name = name or fn.__name__
+             self.tools[tool_name] = fn
+             return fn
+         return decorator
+
+ def test_route_registration():
+     noop = NoopMCP()
+     register_routes(noop)
+     assert "worksheet_ops" in noop.tools
+     # Directly invoke and test handler synchronously without framework overhead:
+     result = noop.tools["worksheet_ops"](action="freeze", file_path="test.xlsx", sheet_name="S1")
+     assert result == "OK"
```

### Architectural Benefits:
1. **Blazing Fast Test Cycles**: Entire test suites execute in milliseconds in pure Python / TypeScript without networking.
2. **Zero Concurrency Collisions**: Tests never bind to ports or shared OS resources, enabling 100% reliable parallel test runs.
3. **Direct Contract Inspection**: Test assertions can directly inspect registered function signatures, docstrings, and parameter annotations.

### Cross-Language Parallels:
- **Python**: `NoopMCP` capturing `@mcp.tool()` registrations for pytest without booting FastMCP.
- **TypeScript**: `MockServer` / `createCaller` capturing tRPC / MCP tool declarations for in-memory Vitest testing.
- **Go**: In-memory `httptest.NewRecorder` or mock gRPC `ServerStream` for fast handler tests.
- **Java**: Mock `ServerWebExchange` / `MockMvc` for in-memory controller invocation without starting Netty / Tomcat.




