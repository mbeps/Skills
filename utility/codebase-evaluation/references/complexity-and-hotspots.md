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

### Static-Estimated CRAP Artifacts vs Empirical Coverage Ground Truth

When static analysis tools (e.g. `fallow health` without `--coverage`) calculate CRAP without dynamic test execution data, they infer coverage statically from import graphs:
- Extracted unexported helpers in tested files receive `coverage_tier: "partial"` (~40–50% estimated coverage).
- Unexported functions in files without direct test imports receive `coverage_tier: "none"` (0% estimated coverage).

**The Static False-Positive Phenomenon**:
Under static estimation, a clean, readable helper with cyclomatic complexity 13 and cognitive complexity 2 scores $\text{CRAP} = 13^2 \cdot (1 - 0.45)^3 + 13 = 28.1 + 13 = \mathbf{41.1} > 30$. In real-world audits, up to **50% of reported CRAP violations** are static-coverage artifacts on functions with low cognitive complexity ($\le 15$).

**Evaluator Diagnostic Rules**:
1. **Differentiate Real Complexity from Static CRAP Artifacts**:
   - *Real Complexity Hotspot*: Cognitive $\ge 16$ OR Cyclomatic $\ge 20$. Warrants structural remediation.
   - *Static CRAP Artifact*: Cognitive $\le 15$ AND Cyclomatic $\le 19$, flagged solely because $\text{CRAP} > 30$. Classify as **Low / Informational** unless dynamic coverage confirms zero execution.
2. **Require Empirical Coverage for Final Audits**: Instruct teams to run analyzers with dynamic coverage JSON (e.g. `fallow health --coverage coverage/coverage-final.json`) to compute true branch-aware CRAP scores before planning refactoring sprints.
3. **Bound Unexported Helpers in Plans**: When recommending extractions, mandate that newly extracted unexported helpers maintain cyclomatic complexity $\le 8$ and cognitive complexity $\le 10$ so static-estimated CRAP scores remain $\le 30$.

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

---

## 6. AST & Toolchain Complexity Heuristics (Avoiding Evaluation False Positives)

Modern static analyzers evaluate AST structures using specific weighting heuristics that evaluators must understand to prevent false-positive diagnostic reports:

### 1. Parameter Destructuring with Default Initializers
- **Detection Heuristic**: In functions accepting large destructured objects with defaults (`function Component({ a = 1, b = 2, c = 3 }: Props)`), AST complexity algorithms count every default assignment as an independent conditional branch decision point.
- **Diagnostic Guidance**: When diagnosing a function with cognitive complexity in the 20s or 30s, check if 10+ default assignments reside in the signature. Recommend accepting a typed `props: Props` object and resolving defaults via local constants or nullish coalescing rather than over-engineering internal logic.

### 2. React Hook Density (`react_hook_count`)
- **Detection Heuristic**: Modern cognitive complexity linters increment cognitive complexity by $+1$ for each React hook called within a component. Components with 15–25 hooks breach cognitive thresholds ($>15$) even with completely flat JSX.
- **Diagnostic Guidance**: Identify whether complexity stems from control flow or hook density. When hook density is the primary driver, recommend a 3-layer hook decomposition:
  1. *Data/Service Hook*: Database fetching, stores, capabilities.
  2. *Interaction Hook*: Selection sets, keyboard handlers, form inputs.
  3. *Presentational Views*: Focused UI slices receiving parameter bags.

### 3. Triaging "Hidden Coupling" vs Domain View Co-Evolution
- **Detection Heuristic**: Git-churn correlation tools flag sibling domain views (`ServerCard` $\leftrightarrow$ `PromptCard` $\leftrightarrow$ `SkillCard`) as "hidden coupling" if they are touched in the same feature commits.
- **Diagnostic Guidance**: Before diagnosing tight coupling, evaluate whether the files represent parallel domain entities that already share a common base primitive (e.g. `ResourceListPage`, `BaseCard`). Parallel domain entities evolving alongside common features is normal co-evolution. Explicitly advise **against** creating leaky umbrella abstractions or merging distinct domain entities.

### 4. Scope Calibration for Test Suites in Health & Unit Size Metrics
- **Detection Heuristic**: Codebases receiving maximum health score penalties on `unit_size` (`-10.0`) frequently have large test files where `describe()` and `it()` blocks span 60–200 lines.
- **Diagnostic Guidance**: Check whether $>50\%$ of oversized functions reside in `__tests__/`. If so, report that the production codebase is substantially healthier than the raw score indicates, and recommend configuring analyzer ignore scopes (`health.ignore: ["__tests__/**"]`) to evaluate production units accurately.
