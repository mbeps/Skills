# Project Evaluation Module

Produces an exhaustive, multi-dimensional health check of an entire codebase covering Architecture, Code Quality & Complexity, Design & Abstraction, UI & Components, Security, Testing, Dependencies, and Documentation.

Combines quantitative static analysis (Cognitive Complexity, CRAP metric, Git Commit Churn) with qualitative architectural auditing.

For metric formulas, complete smell mappings, and engineering invariants, see [Complexity & Hotspots Reference](references/complexity-and-hotspots.md), [Code Smells Matrix](references/code-smells-matrix.md), and [Architectural Invariants Reference](references/architectural-invariants.md).

## When to Use

Use this module when you need a comprehensive, authoritative health check across all project dimensions without pre-selecting a narrow focus.

## Four-Phase Evaluation Workflow

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│ Phase 1:        │     │ Phase 2:            │     │ Phase 3:            │     │ Phase 4:        │
│ Discovery &     │ ──► │ Clarification       │ ──► │ Quantitative        │ ──► │ Prioritised     │
│ Baseline Scan   │     │ (Context Gathering) │     │ Evaluation & Triage │     │ Report & Map    │
└─────────────────┘     └─────────────────────┘     └─────────────────────┘     └─────────────────┘
```

### Phase 1: Discovery & Baseline Scan
Systematically inspect the codebase across all 8 dimensions:
1. **Architecture & Topological Structure**: Module dependency DAG, circular dependencies (`A ↔ B`), peer domain cycles, directory casing, framework route folder purity, persistence coupling.
2. **Code Quality & Cognitive Complexity**: Function lengths, nesting depth (Arrow Code), Cognitive Complexity ($>15$ warning, $>30$ critical), primitive obsession, god classes, correlated with git commit churn (last 3–12 months) to identify Red Alert hotspots vs dormant code.
3. **Design & Abstraction Balance**: Separation of concerns, Lasagna code, shallow adapters, interfaces for one, granularity goldilocks zone, code duplication, and dead code.
4. **UI & Component Architecture**: Container-Presenter decoupling, headless hooks, dual-mode form clone drift, design system primitive usage, accessible widgets, state scope segregation.
5. **Security & Concurrency**: Read-Modify-Write races (TOCTOU), scattered authorisation checks, client-server environment leaks, unbounded datastore queries, CVEs.
6. **Testing & CRAP Scores**: Automated test coverage, test isolation/mock blast radius, characterisation safety nets, CRAP scores ($comp^2 \cdot (1 - cov)^3 + comp > 30$).
7. **Dependencies & Tooling**: Under-utilised dependencies, hand-rolled utility sprawl, micro-package drag, competing engines, toolchain sprawl.
8. **Documentation & Specification Parity**: Architecture onboarding docs, specification accuracy, absence of subdirectory micro-documentation rot.

### Phase 2: Clarification (Optional)
If architectural decisions appear intentional (e.g. deliberate denormalisation for read performance, legacy transports during transitional migration, framework constraints), formulate targeted clarification questions grouped by domain. Gather user context before finalising scores.

### Phase 3: Quantitative Evaluation & Hotspot Triaging
Score each dimension (Poor / Fair / Good / Excellent) based on concrete metrics and code evidence:
- **Triage via Hotspot Matrix**: Categorise findings into **Red Alert** (high complexity + high churn), **Yellow** (high complexity + low churn / sleeping monster), or **Green**.
- **Filter Out False Debt**: Suppress trivial style nits in dormant code. Follow the **change-worthiness principle**—only report findings that warrant genuine engineering investment.

### Phase 4: Comprehensive Report
Compile the final diagnostic report structured with an Executive Summary, Dimension Scorecards, Hotspot Matrix Analysis, and a Prioritised Action Roadmap.

---

## Quality Criteria by Dimension

### 1. Architecture & Topological Structure
- Module graph is an acyclic DAG (zero `A ↔ B` cycles or horizontal peer domain cycles).
- 3-tier layering maintained (View/Handler → Domain Service → Persistence/DAO).
- Clean separation of client-state vs server-state; zero direct DB queries in UI/handlers.
- Subsystems decoupled without polyglot storage impedance mismatches.
- Strict directory topology: route folder purity, kebab-case file naming, private components colocated in `_components/`.

### 2. Code Quality & Complexity
- Functions maintain Cognitive Complexity $\le 15$; zero god functions $>30$.
- Guard clauses prevent Arrow Code (nesting depth $<4$).
- Strong domain typing; absence of Primitive Obsession and untyped bags-of-keys.
- Deterministic resource cleanup with zero unshielded I/O handles.
- High-churn modules prioritised via the Churn × Complexity Hotspot Matrix.

### 3. Design & Abstraction Balance
- Absence of Lasagna code (no $\ge 4$-hop pass-through call chains without transformation).
- Interfaces backed by polymorphic need or hermetic test doubles (no Interfaces for One).
- Code adheres to the Granularity Goldilocks zone (no god files $>500$ LOC, no micro-file explosion $<10$ LOC).
- Redundant logic, declarative ORM schema duplication, and dead code pruned.

### 4. UI & Frontend Components
- Views adhere to Container-Presenter separation.
- Headless custom hooks isolate asynchronous mutations and URL query sync from JSX rendering.
- Accessible primitives used for complex widgets (comboboxes, dialogs).
- Absence of God Hooks managing $>5$ unrelated domains; long-lived listeners guarded against stale closures.

### 5. Security & Concurrency
- Zero Read-Modify-Write race conditions on quota/balance mutations (atomic SQL expressions enforced).
- Centralised gateway authorisation; absence of scattered inline role checks.
- Zero client-server environment variable leaks; server secrets evaluated lazily.
- All datastore queries bounded by explicit limits, chunked batching, and pagination.

### 6. Testing & CRAP Scores
- Critical business logic covered by fast, hermetic unit tests.
- High-risk methods maintain $\text{CRAP} \le 30$.
- Passing test baselines and characterisation safety nets established before structural changes.

### 7. Dependencies & Tools
- Modern standard library leveraged over hand-rolled utility sprawl.
- Zero micro-package dependencies for trivial 1-line tasks.
- Unified linting and build toolchain without competing configurations or engines.

### 8. Documentation & Specification Parity
- Root architecture guides and onboarding documentation reflect active production code.
- Zero subdirectory micro-documentation rot (outdated, abandoned READMEs in subfolders).
- Public APIs and domain models match documented schemas and types.

---

## Expected Output Structure

1. **Executive Summary**: Overall health score, risk level, and dimension scorecard table.
2. **Hotspot Matrix Breakdown**: Red Alert vs Yellow (Sleeping Monster) quadrant mapping.
3. **Detailed Findings by Dimension**: Each issue with Location, Metrics (Cognitive Complexity, CRAP, Churn), Evidence, and Consensus Status.
4. **Prioritised Action Roadmap**: Top improvements ranked by return-on-investment (ROI), separating urgent Red Alert hotspots from optional cleanup.

---

## Example Invocation

```
Run a complete codebase evaluation on [PROJECT_PATH].
Use the project-evaluation module to assess:
- Architecture, circular dependencies, and directory topology
- Cognitive complexity, CRAP scores, and git churn hotspots
- UI component decomposition and headless state lifecycles
- Concurrency races, auth gateways, and environment bleed
- Dependency sprawl, toolchain health, and documentation parity

Provide Phase 1 baseline findings, gather Phase 2 clarification if needed,
and produce a Phase 4 final report with ratings and prioritised roadmap.
```
