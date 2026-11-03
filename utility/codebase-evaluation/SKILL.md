---
name: codebase-evaluation
description: Use when evaluating codebases for code quality, architectural smells, cognitive complexity, test coverage gaps (CRAP score), circular dependencies, dead code, duplication, or security posture.
---

# Evaluation Skill

Comprehensive codebase evaluation system that assesses code quality, architecture, design patterns, cognitive complexity, test sufficiency, security, dependencies, and maintainability. Produces detailed, structured diagnostic reports across multiple quality dimensions.

**REQUIRED SUB-SKILL:** If the `ponytail` skill is not already loaded, load it. Its YAGNI lens keeps evaluation lean: report only what warrants change, not every theoretical alternative.

---

## When to Use & When NOT to Use

### Apply When
- Conducting an overall codebase health check across architecture, quality, security, and tests
- Diagnosing high-complexity hotspots (Cognitive Complexity $>15$, McCabe Cyclomatic $>20$, high CRAP scores, arrow code, god functions)
- Auditing module graphs for circular dependencies (`A ↔ B`), peer domain cycles, and architectural boundary drift
- Detecting code duplication, declarative schema clones, and competing engine sprawl
- Tracing unreachable logic, unused public exports, phantom event dispatchers, and zombie migration assets
- Auditing over-abstraction, trivial passthrough wrappers, single-implementation interfaces, and indirection debt
- Evaluating front-end UI architecture: monolithic views, high hook density, hydration hazards, state lifecycle coupling, and responsive/accessibility traps
- Checking security and concurrency posture: TOCTOU race conditions, privilege boundaries, sandbox escapes, token validation, and auth scope containment
- Auditing architecture and API contracts: protocol parity, coarse dispatcher contracts, schema nullability vs optionality, and storage compensation
- Evaluating implementation quality against clean code standards: parameter destructuring bloat, data-driven branch flattening, and error recovery contracts

*For the complete catalog of 220+ code smells and 168 architectural invariants, see the [Authoritative References](#authoritative-references).*


### Do NOT Apply When
- Actively writing feature implementations or modifying production code (use domain feature skills)
- Performing live code refactoring or structural edits (use `refactor` skill)
- Fixing immediate bugs or test failures (use `bug-fix` or `systematic-debugging` skills)
- Auditing stable, dormant legacy code with zero commit churn unless feature work is planned

---

## Evaluation Workflow

```mermaid
flowchart TD
  Start([Start Evaluation]) --> Baseline[Phase 1: Measure Metrics Baseline & Scan Domains]
  Baseline --> Hotspot[Phase 2: Triage Churn × Complexity Hotspot Matrix]
  Hotspot --> Classify{Hotspot Quadrant?}
  Classify -->|Red Alert: High Churn + High Complexity| DeepAudit[Deep Evidence Audit & AST Trace]
  Classify -->|Yellow: Low Churn + High Complexity| NoteDormant[Flag as Sleeping Monster: Low Priority]
  Classify -->|Green: Low Complexity| Healthy[Mark Healthy]
  DeepAudit --> Clarify{Intentional Context / Trade-off?}
  Clarify -->|Yes| AskUser[Formulate Clarification Questions]
  Clarify -->|No| Verify[Cross-Check Evidence & Formulate Consensus]
  AskUser --> Verify
  NoteDormant --> Synthesise[Phase 4: Synthesise Prioritised Report]
  Healthy --> Synthesise
  Verify --> Synthesise
  Synthesise --> Report([Deliver Diagnostic Report & Roadmap])
```

---

## Core Quantitative Metrics

Evaluations combine empirical static analysis with git history analysis to prevent bikeshedding:

| Metric | Measurement Tool / Basis | Target Baseline | Warning Threshold | Critical Debt Threshold |
|---|---|---|---|---|
| **Cognitive Complexity** | SonarQube structural jumps & nesting | $\le 15$ | $16 - 30$ | $> 30$ (God Function) |
| **Cyclomatic Complexity** | McCabe linear execution paths | $\le 10$ | $11 - 20$ | $> 20$ |
| **CRAP Metric** | $\text{comp}^2 \cdot (1 - \text{cov})^3 + \text{comp}$ | $\le 30$ | $31 - 60$ | $> 60$ (Untested Hazard) |
| **Indirection Debt** | Entrypoint to execution call stack hops | $\le 3$ hops | $4 - 6$ hops | $\ge 7$ hops (Lasagna Code) |
| **Git Commit Churn** | Revisions in past 3–12 months | Low | Moderate | High (Active Volatility) |

*For complete formulas and quadrant analysis, see [Complexity & Hotspots Reference](references/complexity-and-hotspots.md).*

---

## Authoritative References

- **[Code Smells Diagnostic Matrix](references/code-smells-matrix.md)** – Comprehensive catalogue mapping 220+ code smells across 10 evaluation dimensions to detection heuristics, required evidence, and severity ratings.
- **[Complexity & Hotspots Reference](references/complexity-and-hotspots.md)** – Deep-dive guide covering Cognitive vs Cyclomatic complexity, empirical vs static-estimated CRAP scores, the Churn × Complexity Hotspot Matrix, AST destructuring penalties, hook density, and Indirection Debt measurement.
- **[Architectural Invariants Reference](references/architectural-invariants.md)** – Authoritative evaluation criteria adapting 165 Architectural Invariants across data contracts, UI state separation, modularity, tooling, and system boundaries.

---

## Specialised Evaluation Modules

This skill includes 10 dedicated evaluation modules:

### 1. **Project Evaluation** (`project-evaluation.md`)
Exhaustive health check across all 8 dimensions: Architecture, Code Quality, Design, UI Components, Security, Testing, Dependencies, and Documentation. Follows Discovery → Clarification → Evaluation → Reporting.

### 2. **Architecture & Design Analysis** (`architecture-design-analysis.md`)
Audits module graphs for circular dependencies (`A ↔ B`), peer domain cycles, and indirection debt. Evaluates coarse dispatcher contract drift, API contract degradation into untyped dictionaries, storage compensation transactions, and polyglot boundary decoupling.

### 3. **Quality Analysis** (`quality-analysis.md`)
Evaluates implementation quality against clean code standards. Calculates Cognitive Complexity, Cyclomatic Complexity, and CRAP scores. Detects arrow code, parameter destructuring bloat, multi-branch conditional ladders, file length ceiling violations (>300 LOC), unmemoized hook callback churn, and concurrency race conditions (TOCTOU, check-then-act upserts).

### 4. **Code Duplication** (`code-duplication.md`)
Rigorously identifies exact clones, semantic similarity, declarative ORM schema duplication, scattered inline variations, and competing engine sprawl.

### 5. **Dead Code Analysis** (`dead-code.md`)
Traces entry points to identify unreachable logic, unused public exports (export minimization), phantom event dispatchers, phantom property/state plumbing, ignored API request parameters, legacy single-select zombie state, unthrown error classes, and ephemeral migration assets.

### 6. **Over-Abstraction Audit** (`over-abstraction.md`)
Identifies shallow abstraction layers, trivial passthrough wrappers, single-implementation interfaces, speculative infrastructure schema debt, micro-tool catalog sprawl, and excessive granularity.

### 7. **Codebase Consistency** (`codebase-consistency.md`)
Audits topological directory architecture, strict file casing, framework route folder purity, Server Actions directory purity, one-export-per-file hygiene, barrel file bottlenecks vs direct imports, centralized structured logging vs console leakage, symmetrical client/server environment schemas, 4-tier domain type architecture, and canonical site registries.

### 8. **Security Audit** (`security-audit.md`)
Audits code-level vulnerabilities, secondary-library sandbox escapes, protocol error masking, missing auth gateway route protections, cross-origin trusted origins, hardcoded localhost fallbacks, and destructive action confirmations.

### 9. **Dependency Usage** (`use-dependencies.md`)
Audits custom logic that reinvents standard libraries or existing packages (Hand-Rolled Utility Sprawl), micro-package dependency drag, multi-tool toolchain sprawl, blocker dependency peer lockouts, and CI/CD secret parity.

### 10. **UI & Component Analysis** (`ui-component-analysis.md`)
Audits front-end views for monolithic components, presentation-mutation coupling, high hook density, and state lifecycle coupling. Inspects SSR/hydration hazards (`isMounted`, root DOM structures), responsive layout occlusions, unguarded `notFound()` calls, and accessible design system primitives.


---

## Key Diagnostic Principles

- **Thorough Analysis** – Evaluate each quality dimension systematically using objective metrics.
- **Evidence-Based Findings** – Every issue must cite specific file paths, line numbers, and architectural evidence.
- **Objective Assessment** – Report findings without prescribing implementation code or premature rewrites.
- **Change-Worthiness** – Only report issues whose remediation would meaningfully improve maintainability, defect rates, or security. If fixing something would not change outcomes, it is noise.
- **Cost-Weighted Findings** – Weigh remediation effort against practical risk. Dormant, stable code with zero churn is classified as Yellow (Sleeping Monster) rather than an urgent crisis.
- **Prefer the Working Solution** – Working, readable code that introduces no measurable friction is not a defect merely because an alternative pattern exists.

---

## Required Inputs

When invoking this skill, provide:

1. **Codebase Path** – Full path to the project directory to evaluate
2. **Evaluation Type**:
   - `project-evaluation` for comprehensive multi-dimensional assessment
   - Specific module name(s) for targeted analysis (e.g. `architecture-design-analysis`, `quality-analysis`)
3. **Scope** (Optional) – Specific subdirectories or modules to focus on
4. **Known Context** (Optional) – Intentional architecture decisions, framework constraints, or migration roadmaps

---

## Output Format & Standards

All evaluation reports follow a structured Markdown format with:

- **Executive Summary** – High-level health score and risk level by dimension
- **Hotspot Matrix Breakdown** – Red Alert vs Yellow (Sleeping Monster) quadrant mapping
- **Detailed Findings** – Each issue with Location, Severity, Metric Baseline, Evidence, and Consensus Status
- **Domain Scorecards** – Per-dimension qualitative and quantitative assessments
- **Actionable Roadmap** – Most impactful improvements ranked by ROI and risk reduction

### Quality Standards
- All findings are **specific** – cite exact file paths, line numbers, or symbol identifiers
- All findings are **evidence-backed** – supported by code snippets, AST traces, or vulnerability records
- All findings are **objective** – utilise concrete metrics (Cognitive Complexity, CRAP, hop counts)
- All reports use **British English** spelling and grammar
- All reports follow **ASD-STE100** principles – short sentences, plain vocabulary, one idea per sentence

---

## Example Invocations

### 1. Comprehensive Project Health Check
```
Run a complete codebase evaluation on [PROJECT_PATH].
Use the project-evaluation module to assess all dimensions.
Include git commit churn correlation, Cognitive Complexity baselines,
and CRAP scores for high-risk modules.
```

### 2. Architecture & Cycle Audit
```
Analyse the architecture of [PROJECT_PATH] for circular dependencies,
indirection debt, and storage impedance mismatches.
Use the architecture-design-analysis and over-abstraction modules.
Provide Mermaid diagrams for cyclic paths.
```

### 3. Quality & Complexity Deep Dive
```
Evaluate [PROJECT_PATH] for code quality, arrow code, and concurrency races.
Use the quality-analysis and code-duplication modules.
Calculate Cognitive Complexity and CRAP scores for all functions exceeding 40 LOC.
```

### 4. Front-End UI Audit
```
Audit the front-end architecture of [PROJECT_PATH].
Use the ui-component-analysis and codebase-consistency modules.
Identify monolithic views, presentation coupling, and god hooks.
```

---

## Related Skills

- **ponytail** – YAGNI lens that keeps evaluation lean; load if not already loaded
- **refactor** – Systematic code remediation patterns, 100 Golden Rules, and code smell fixes
- **writing-code** – Pragmatic clean coding standards and defensive architecture
- **karpathy-guidelines** – Disciplines to avoid overcomplication and LLM coding mistakes
- **writing-skills** – Authoring and verifying agent skills
