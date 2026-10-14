# Quality Analysis Module

Evaluates code quality, cognitive complexity, and design patterns against industry standards and clean code disciplines. Combines quantitative complexity metrics with empirical code smell detection to pinpoint structural risks without suggesting fixes.

For detailed metric formulas and the 72-smell catalog, see [Complexity & Hotspots Reference](references/complexity-and-hotspots.md) and [Code Smells Matrix](references/code-smells-matrix.md).

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
- **Read-Modify-Write Races**: Reading a record, modifying it in application memory, and executing an update without atomic SQL expressions (`SET count = count + 1`) or optimistic locking.
- **Silent Input Degradation / Swallowed Errors**: Empty `catch` blocks or quiet truncation of inputs when capabilities are missing.
- **Unshielded Resource Handles (I/O Leaks)**: Database clients, file streams, or sockets missing deterministic disposal (`try...finally`, `using`).

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
