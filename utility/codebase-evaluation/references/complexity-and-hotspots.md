# Complexity Metrics & Hotspot Analysis Reference

Diagnostic guide for evaluating computational, cognitive, and structural complexity across codebases. Use this reference to establish quantitative baselines, triage technical debt, and prevent bikeshedding during evaluations.

---

## 1. Cyclomatic vs Cognitive Complexity

| Dimension | Cyclomatic Complexity (McCabe) | Cognitive Complexity (SonarQube) |
|---|---|---|
| **Primary Focus** | Linear execution paths and test branch count | Human mental effort required to read, follow, and understand control flow |
| **Formula / Increment** | +1 for each decision point (`if`, `else`, `case`, `while`, `for`, `&&`, `||`, ternary) | +1 for each structural break; **multiplies with nesting depth** |
| **Nesting Handling** | Flat weighting; deep nesting scores the same as sequential statements | Heavy penalty for nested blocks (`if` inside `loop` inside `try`) |
| **Typical Target** | $\le 10$ per function | $\le 15$ per function |
| **Warning Threshold** | $11 - 20$ | $16 - 30$ |
| **Critical Debt** | $> 20$ | $> 30$ (god function hotspot) |

### Why Cognitive Complexity Takes Precedence in Evaluation

A flat `switch` statement with 20 branches has high cyclomatic complexity (20) but very low cognitive complexity (1) because a reviewer or maintainer only needs to match one condition.

Conversely, a function with 3 nested loops and conditionals has moderate cyclomatic complexity (8) but extreme cognitive complexity ($30+$) because the maintainer must hold multiple nested preconditions and state invariants in working memory simultaneously.

During codebase evaluation, prioritise **Cognitive Complexity** as the primary signal of maintainability friction.

---

## 2. The CRAP Metric (Change Risk Anti-Patterns)

The **CRAP metric** correlates Cyclomatic Complexity with Automated Test Coverage to quantify the defect risk of a module:

$$\text{CRAP}(m) = \text{comp}(m)^2 \cdot (1 - \text{cov}(m))^3 + \text{comp}(m)$$

Where:
- $\text{comp}(m)$ = Cyclomatic complexity of method $m$
- $\text{cov}(m)$ = Test coverage fraction of method $m$ ($0.0 \le \text{cov} \le 1.0$)

### Diagnostic Evaluation Thresholds

| CRAP Score | Risk Category | Diagnostic Assessment |
|---|---|---|
| $\le 30$ | **Acceptable / Healthy** | Adequate test safety net for the current complexity level. |
| $31 - 60$ | **Moderate Risk** | Complex logic with partial test coverage; fragile to modifications. |
| $> 60$ | **Critical Risk** | High complexity with inadequate tests. Extreme regression probability. |

### Concrete Impact Examples
- **Complex & Fully Tested**: $\text{comp} = 20, \text{cov} = 1.0 \implies \text{CRAP} = 20$ (Acceptable).
- **Complex & Untested**: $\text{comp} = 20, \text{cov} = 0.0 \implies \text{CRAP} = 20^2 \cdot (1 - 0)^3 + 20 = \mathbf{420}$ (Extreme hazard!).

When evaluating modules, flag functions where $\text{CRAP} > 30$, highlighting that modifying or refactoring this code poses severe regression hazards until characterisation tests are in place.

---

## 3. The Churn × Complexity Hotspot Matrix

Codebase evaluation must never treat all complex code equally. Flagging dormant, stable code creates noise and violates the **change-worthiness principle**. Evaluators must correlate static complexity with **git commit churn** (revision frequency over the past 3–12 months):

```
       High ▲
            │   [YELLOW] Sleeping Monster        [RED ALERT] Top Priority Hotspot
            │   High complexity, low churn.       High complexity, frequent churn.
            │   Stable legacy code. Not an        Primary source of regressions, bugs,
Complexity  │   immediate risk. Do NOT flag as    and development delays. Flag as
(Cognitive) │   critical unless change planned.   Critical/High severity defect!
            │
            │   [GREEN] Dormant Baseline          [GREEN] Active Modular Code
            │   Low complexity, low churn.        Low complexity, frequent churn.
            │   Healthy, stable baseline.         Healthy, modular development velocity.
            │   No action required.               No action required.
            └─────────────────────────────────────────────────────────────►
            Low                               Git Commit Churn             High
```

### Triaging Findings with the Hotspot Matrix

1. **Red Alert (High Complexity × High Churn)**:
   - **Characteristics**: Central orchestrators, payment pipelines, state dispatchers, or god hooks touched across multiple PRs every month.
   - **Evaluation Verdict**: **Critical / High Severity**. Direct contributor to team fatigue and production defects.
2. **Yellow Alert (High Complexity × Low Churn - "Sleeping Monster")**:
   - **Characteristics**: Arcane parser or mathematical algorithm written 3 years ago that has zero recent commits and zero open bugs.
   - **Evaluation Verdict**: **Low Severity / Informational Note**. Note the high cognitive load, but explicitly advise *against* unprompted refactoring. Follow the "Leave Sleeping Monsters Alone" rule until active feature work touches it.
3. **Green (Low Complexity)**:
   - **Characteristics**: Either stable small modules or actively maintained modular slices.
   - **Evaluation Verdict**: **Healthy**.

---

## 4. Indirection Debt & Call-Stack Depth

Indirection Debt measures the number of intermediary hops, pass-through wrappers, and forwarding layers required to travel from an entrypoint to the core business logic.

### Diagnostic Metrics

- **Call Stack Hop Count**: Number of functions or files traversed before real state mutation or data transformation occurs.
  - $\le 3$ hops: Healthy, direct execution.
  - $4 - 6$ hops: Moderate indirection; verify if adapters provide tangible abstraction.
  - $\ge 7$ hops: **High Indirection Debt** (Lasagna code).
- **Trivial Wrapper Ratio**: Proportion of methods in an execution path that do nothing except forward parameters to another object (`return this.service.doWork(args)`).
  - $> 50\%$ trivial wrappers indicates over-abstraction and shallow layering.

---

## 5. Granularity Goldilocks Zone & 5-Tier Decision Matrix

Evaluators must assess code size and modularity against both upper and lower bounds. Both extremes damage maintainability:

```
    [Defect: Monolithic] ◄────── [Goldilocks Zone] ──────► [Defect: Micro-Explosion]
    God Classes (>500 LOC)       Focused Modules           Micro-files (<10 LOC)
    God Functions (>50 LOC)      Single Responsibility     Trivial 1-line wrappers
    High Cognitive Load          Composable Units          Fragmented Call Stacks
```

### The 5-Tier Granularity Decision Matrix

Use this matrix to audit whether file and function decomposition adheres to optimal modularity:

| Code Category | Recommended Topology | Decision Rule & Rationale |
|---|---|---|
| **Server Actions / API Handlers** | **File-Per-Function** (`actions/<domain>/<action>.ts`) | Actions have divergent dependencies, distinct authorisation checks, and require hermetic mock isolation in unit tests. |
| **Heavy Domain Pipelines** | **File-Per-Pipeline** (`services/<domain>/<pipeline>.ts`) | Multi-stage orchestration (validation → turn → persistence) benefits from dedicated file boundaries and explicit mock interception. |
| **Pure Domain Helpers & Accessors** | **Domain Co-location** (`lib/<domain>/<domain>-helpers.ts`) | Small pure helpers (5–25 lines) operating on the same data structure share domain invariants and belong together in a single cohesive module. |
| **Repeated Extraction Boilerplate** | **Generic Higher-Order Utility** (`lib/generic/<pipeline>.ts`) | When 5+ files share the identical loop/Set/Map skeleton (e.g. facet generators, array aggregators), collapse them into a single generic function. |
| **Single-Caller Micro-Components** | **Inline in Parent Component** | Private presentational wrappers under 30 lines add indirection without reusability when split into separate files. |

### Evaluation Guidelines

- **File Size**: Typically $50 - 300$ lines of code per file. Files $>500$ LOC should be audited for SRP violations.
- **Function Size**: Typically $10 - 40$ lines of code. Functions $>50$ LOC should be audited for distinct lifecycle phases (input validation, core execution, mutation, persistence).
- **Micro-File Explosion**: If a simple feature of 100 LOC is fragmented across 12 files across 6 directory tiers without reuse, flag as over-decomposition.
