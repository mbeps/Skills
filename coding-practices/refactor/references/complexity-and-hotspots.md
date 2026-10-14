# Complexity Metrics & Refactoring Hotspots

Refactoring without metrics often leads to bikeshedding—polishing clean, stable code while ignoring the real structural risks. This guide details how to measure complexity, prioritize targets using the **Churn × Complexity Hotspot Matrix**, and systematically dismantle high-cognitive functions.

---

## 1. Cyclomatic vs Cognitive Complexity

| Dimension | Cyclomatic Complexity (McCabe) | Cognitive Complexity (SonarQube) |
|---|---|---|
| **What it measures** | Count of linearly independent execution paths | How difficult the control flow is for a human brain to read |
| **How it increments** | +1 for each `if`, `else`, `while`, `case`, `&&`, `\|\|` | +1 for each structural jump; **multiplies with nesting depth** |
| **Nesting penalty** | No extra penalty for nested blocks | Heavily penalizes deep nesting (`if` inside `for` inside `if`) |
| **Threshold** | Typically **10 - 20** | Typically **15 - 30** |

### Why Cognitive Complexity Matters
A flat `switch` with 15 simple cases has high cyclomatic complexity (15) but very low cognitive complexity (1). Conversely, a function with 3 deeply nested `if` statements and error handlers has moderate cyclomatic complexity (8) but extreme cognitive complexity (30+) because a developer must keep multiple nested preconditions in working memory simultaneously.

---

## 2. The CRAP Metric (Change Risk Anti-Patterns)

The **CRAP metric** combines Cyclomatic Complexity with Automated Test Coverage:

$$\text{CRAP}(m) = \text{comp}(m)^2 \cdot (1 - \text{cov}(m))^3 + \text{comp}(m)$$

- **Fully Tested Function ($100\%$ Coverage)**: $\text{CRAP}(m) = \text{comp}(m)$. A function with complexity 20 has a CRAP score of 20.
- **Untested Function ($0\%$ Coverage)**: $\text{CRAP}(m) = \text{comp}(m)^2 + \text{comp}(m)$. A function with complexity 20 has a CRAP score of **$420$**!
- **Threshold**: Any function with a CRAP score $> 30$ is considered high-risk debt.

> [!IMPORTANT]
> **Rule of Thumb**: Before refactoring a complex function, **write tests first**. Increasing coverage immediately drops the CRAP score and provides a safety harness for subsequent structural extractions.

---

## 3. The Churn × Complexity Hotspot Matrix

Not all complex code warrants refactoring. Prioritize targets by correlating code complexity with **git commit churn** (how often developers touch the file):

```
       High ▲
            │   [Yellow] Technical Debt        [RED ALERT] Top Priority
            │   High complexity, low churn.    High complexity, frequent churn.
Complexity  │   "Sleeping monster" - leave     Source of regressions. Refactor first!
            │   alone until feature needed.
            │
            │   [Green] Dormant Code           [Green] Active Development
            │   Low complexity, low churn.     Low complexity, frequent edits.
            │   Healthy, stable baseline.      Healthy, modular codebase.
            └─────────────────────────────────────────────────────────────►
            Low                           Churn (Commits / Revisions)  High
```

### Prioritization Rules:
1. **Priority 1 (Red Alert)**: Modules with high commit velocity and high complexity (e.g. core orchestrators, central event handlers). Refactoring here directly reduces daily bug rates.
2. **Priority 2 (Yellow)**: Complex modules that haven't been touched in years. **Do not refactor unprompted**. Wait until a new feature requires modifying them.

---

## 4. Decomposing High-Cognitive Functions

When dismantling a god function with cognitive complexity > 30:

### Step 1: Identify Phase Boundaries & Form a Linear Pipeline
Look for logical transition phases:
1. **Preparation & Validation**: Scoping permissions, checking capabilities, filtering input, compiling system/request context.
2. **Core Execution / Turn**: Calling the external engine, driver, or service with error boundary handling.
3. **Result Processing & Serialization**: Evaluating individual items or tool calls, emitting telemetry events, and serializing outputs.
4. **Output Persistence & Fallbacks**: Saving generated artifacts/records to storage, handling mutation checks, and triggering fallbacks.
5. **Post-Turn Review & Gate**: Pausing for human approval or completing the sequence.

Each phase becomes a dedicated, single-responsibility helper function (`prepare...`, `execute...`, `handle...`).

### Step 2: Push Down Complexity within Extracted Helpers (Sub-Threshold Refactoring)
Extracting a 600-line function into 3 large helpers can leave individual helpers still exceeding complexity thresholds (e.g., cognitive complexity > 25). Continue extracting one level deeper:
- In execution handlers: Separate capability assertion (`assertCapabilities`) from event result loop iteration (`processTurn`).
- In result loops: Separate loop navigation from single-item evaluation (`handleSingleItemResult`).
- In persistence handlers: Separate explicit artifact saving from fallback download/recovery workflows.

### Step 3: Test Mock Blast Radius Alignment
When decomposing complex functions in heavily tested codebases:
- Keep extracted helpers co-located in the same file or within internal package modules that preserve the original mock boundaries.
- If existing test suites mock internal libraries at specific module paths (e.g. storage clients, database singletons, or SDK calls), ensure the extracted helpers continue calling through those same paths so existing mocks intercept calls without requiring test suite rewrites.

### Step 4: Separate Query from Mutation (CQS)
Functions that simultaneously calculate values and perform database/network mutations are hard to reason about. Split them:
- Pure calculations (deterministic, zero side-effects, trivial to unit test).
- Imperative mutations (focused on I/O, error handling, and orchestration).

### Step 5: The Orchestrator Rule
After extraction, the parent orchestrator function should read like an executive summary or table of contents: 15–35 lines that cleanly invokes the extracted sub-functions and passes state forward.

---

## 5. Topological Architecture and Directory Structure Harmonization

Cognitive complexity is not confined to individual functions; **topological disorder across files and directories** imposes massive mental overhead across an entire engineering team. When file naming is inconsistent (mixing camelCase and kebab-case), private route components are mixed with public routes, and configuration is scattered haphazardly across `lib/`, `constants/`, and `src/`, finding and reasoning about code becomes agonizingly slow.

### Harmonization Rules:

1. **Domain-Driven Co-location**:
   Group backend actions, validation schemas, and domain types by business entity rather than creating giant technical junk drawers:
   ```
   actions/
   ├── cars/          # add-car.ts, update-car.ts, delete-car.ts, get-cars.ts
   ├── home/          # get-faqs.ts, reorder-faqs.ts, page-content.ts
   └── settings/      # dealership-info.ts, working-hours.ts, user-role.ts
   ```

2. **Private Route Component Colocation (`_components/`)**:
   In modern framework route topologies (Next.js App Router, Remix, Nuxt), colocate subcomponents private to a specific route inside a local `_components/` directory. Only promote a component to the global `components/` directory when it is consumed by two or more unrelated routes.

3. **Strict, Uniform File Naming Conventions**:
   Enforce kebab-case across all filenames (`use-auth-modal.ts`, `car-combobox-select.tsx`, `booking-status.ts`). Mixing `useAuthModal.ts` with `use-user.ts` creates import confusion and filesystem case-sensitivity bugs between macOS/Windows and Linux CI runners.

4. **Configuration vs Library Separation**:
   Strictly isolate static project configuration (`config/routes.ts`, `config/env.ts`, `config/assets.ts`, `config/constants.ts`) from algorithmic runtime helpers, API singletons, and utility functions (`lib/`).

5. **Utility Grab-Bag Decomposition (`lib/utils.ts` -> Domain Submodules)**:
   A single `lib/utils.ts` or `common/utils.py` inevitably becomes a high-churn dumping ground mixing string formatters, avatar initials, grid CSS builders, and date parsing. Decompose into focused domain packages (`lib/avatar/get-initials.ts`, `lib/grid-classes.ts`, `lib/music/format-artists.ts`), leaving `lib/utils.ts` containing only true framework primitives (such as `cn` / class name merging).

6. **Singular Domain Folder Harmonization**:
   Avoid mixing plural and singular domain folder names across the codebase (e.g. `schemas/albums` vs `types/album` vs `actions/album`). Standardize domain directories strictly to singular (`album/`, `artist/`, `song/`, `playlist/`, `user/`, `auth/`) across `actions/`, `schemas/`, `types/`, and `__tests__/`.

7. **Test Directory Topological Mirroring & Deduplication**:
   Test directories in `__tests__/` must mirror the exact domain hierarchy of production code (`__tests__/schemas/album/createAlbum.schema.test.ts`, `__tests__/actions/album/createAlbum.test.ts`). When restructuring domain folders, relocate test suites synchronously and prune duplicate or zombie test files testing the same contract under stale filenames.

8. **Data Mapper & DTO Transformer Decomposition (`lib/mappers/`)**:
   A monolithic `lib/mappers.ts` or `Transformers.java` file mapping all database entities to domain models creates cross-domain coupling and git merge conflicts. Decompose into entity-scoped mapper modules (`lib/mappers/album.ts`, `lib/mappers/artist.ts`, `lib/mappers/song.ts`, `lib/mappers/user.ts`) colocated in domain folders with dedicated 1:1 unit tests.

---

## 6. Vertical-Slice and File-Per-Function Endpoint Decomposition

**Symptom**: A single controller or actions file (e.g. `actions/admin.ts`, `actions/auth.ts`, `routes/api.py`, `AdminController.java`) accumulates 8–20 distinct procedures, spanning 350–800+ lines of disparate business rules, validation schemas, and data operations.

### The Problem:
- **Bundler & Client Stub Leakage**: In modern full-stack frameworks (Next.js Server Actions, Nuxt Server Routes), importing a single function from a multi-action file can pull along client stubs, unused validator imports, or server-only dependencies across the boundary.
- **High Git Churn & Merge Conflicts**: Because every developer adding or fixing any admin or auth feature touches the same monolithic file, merge conflicts and regression risks spike.
- **Test Blast Radius**: Testing a single endpoint inside a 500-line test file (`__tests__/actions/admin.test.ts`) causes mock configuration for one action (e.g. storage mocks) to leak into assertions for an unrelated action (e.g. user role checks).
- **Conflated Static vs Dynamic Responsibilities**: Monolithic files frequently bundle static string constants (e.g. static route paths) with dynamic query builders or mutation handlers, preventing clean tree-shaking.

### The Remediation: File-Per-Function Domain Topology
Decompose grab-bag action files into single-responsibility, file-per-function modules colocated in domain folders with 1:1 dedicated unit test suites:

```
BEFORE: Monolithic Grab-Bags
actions/admin.ts                    # 351 lines, 5 unrelated actions
actions/auth.ts                     # 366 lines, 9 unrelated actions
__tests__/actions/admin.test.ts     # 400 lines of brittle, shared-mock tests

AFTER: Vertical-Slice File-Per-Function Topology
actions/
├── admin/
│   ├── get-admin-test-drives.ts    # Single action (110 lines)
│   ├── get-admin.ts                # Single action (35 lines)
│   ├── get-dashboard-data.ts       # Single action (120 lines)
│   └── update-test-drive-status.ts # Single action (90 lines)
└── auth/
    ├── delete-user-passkey.ts      # Single action (35 lines)
    ├── ensure-profile.ts           # Single action (90 lines)
    ├── get-current-user-role.ts    # Single action (45 lines)
    └── sign-out.ts                 # Single action (20 lines)

__tests__/actions/
├── admin/
│   ├── getAdminTestDrives.test.ts  # Isolated hermetic mocks
│   └── updateTestDriveStatus.test.ts
└── auth/
    └── signOut.test.ts             # 15 lines of pure focused assertions
```

```diff
# BEFORE: Monolithic actions file bundling multiple unrelated procedures
- // actions/admin.ts (350+ lines)
- export async function getAdminTestDrives() { ... }
- export async function getDashboardData() { ... }
- export async function updateTestDriveStatus(id: string, status: string) { ... }
- export async function deleteCar(id: string) { ... }

# AFTER: Dedicated single-action files with focused imports and hermetic tests
+ // actions/admin/update-test-drive-status.ts
+ export async function updateTestDriveStatus(
+   bookingId: string,
+   status: BookingStatus
+ ): Promise<ActionResponse<SerializedBooking>> {
+   await requireAdminRole();
+   const validated = statusSchema.parse({ bookingId, status });
+   return executeStatusTransition(validated);
+ }
```

**Cross-Language & Framework Parallels**:
- **Python (FastAPI / Flask)**: Replace monolithic `controllers/admin.py` with domain routers and file-per-endpoint handlers (`api/routes/admin/test_drives.py`, `api/routes/admin/metrics.py`).
- **Go**: Split monolithic `handlers.go` into domain packages with dedicated handler files (`handlers/admin/test_drives.go`, `handlers/admin/metrics.go`).
- **Java (Spring Boot)**: Replace 1,000-line God Controllers with focused Command/Query Handler beans (`UpdateTestDriveStatusHandler.java`) or feature-sliced `@RestController` classes.
- **Ruby on Rails**: Decompose bloated controllers into single-action commands or interactor objects (`Commands::Admin::UpdateTestDriveStatus`).

---

## 7. The Granularity Goldilocks Zone: Balancing File-Per-Function with Domain Co-location (Preventing Micro-File Explosion)

While decomposing monolithic controllers into single-action files reduces merge conflicts and mock pollution, **dogmatically applying "one function per file" to microscopic helpers creates the opposite anti-pattern: Micro-File Explosion**.

When an application creates 10 separate files for 10-line pure helpers (`countMaterialsBySkill.ts`, `isSkillAssociatedWithMaterial.ts`, `skillHasMaterial.tsx`), developers suffer severe file friction, IDE tab explosion, and import bloat without gaining any architectural isolation.

### The 5-Tier Granularity Decision Matrix

| Code Category | Recommended Topology | Decision Rule & Rationale |
|---|---|---|
| **Server Actions / API Handlers** | **File-Per-Function** (`actions/<domain>/<action>.ts`) | Actions have divergent dependencies, distinct authorization checks, and require hermetic mock isolation in unit tests. |
| **Heavy Domain Pipelines** | **File-Per-Pipeline** (`services/<domain>/<pipeline>.ts`) | Multi-stage orchestration (validation → turn → persistence) benefits from dedicated file boundaries and explicit mock interception. |
| **Pure Domain Helpers & Accessors** | **Domain Co-location** (`lib/<domain>/<domain>-helpers.ts`) | Small pure helpers (5–25 lines) operating on the same data structure (`skillUsageHelpers.ts`) share domain invariants and belong together in a single cohesive module. |
| **Repeated Extraction Boilerplate** | **Generic Higher-Order Utility** (`lib/generic/<pipeline>.ts`) | When 5+ files share the identical loop/Set/Map skeleton (e.g. facet generators, array aggregators), collapse them into a single generic function. |
| **Single-Caller Micro-Components** | **Inline in Parent Component** | Private presentational wrappers under 30 lines (e.g. inlining `MobileOverlay` into `NavbarOverlay`) add indirection without reusability. |

### Diagnostic Rule of Thumb:
- **Split into a new file if**: The function imports external I/O clients (DB, S3, Stripe), requires specialized test mocks, or represents an independent HTTP endpoint.
- **Co-locate in a domain module if**: The function is pure, deterministic, under 30 lines, and operates on the same domain type or lookup table as its neighbors.
- **Parameterize into a generic utility if**: You find yourself copy-pasting an iteration, deduplication, or aggregation loop across 3 or more domain files.



