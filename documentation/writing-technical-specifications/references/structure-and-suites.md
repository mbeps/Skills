# Structure and Sizing Guide for Technical Specifications

## Purpose

This document defines sizing tiers and file structures for technical specifications.

## Sizing Tiers

Do not write bloated specifications. Match the document structure to the system size and problem maturity.

| Tier                         | System Scope                                           | Document Layout                                  | When to Use                                                                 |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- |
| **Tier 1: Micro**            | Single utility, script, or small library               | Single file: `SPECIFICATION.md`                  | Simple components (<500 lines of code or single function).                  |
| **Tier 2: Service**          | Single backend service, API, or worker                 | 3 to 5 modular files                             | Medium services with a database and several endpoints.                      |
| **Tier 3: Enterprise Suite** | Complex system, multi-component platform, or migration | Full modular suite (up to 16 files + appendices) | Distributed systems, legacy migrations, or reverse-engineered applications. |

## Sizing Rules

1. **Do not create empty files.** If a section has no content, omit the file or merge it into an adjacent file.
2. **Do not duplicate information.** Define each concept in one canonical location. Link to it from other files.
3. **Complexity determines tier.** Specification tiers depend solely on system scope and component complexity, never on user requests for file volume.
4. **No infrastructure code.** Do not include Docker files, Kubernetes manifests, Terraform scripts, or CI/CD pipelines. Specify runtime contracts (such as ports, environment variables, health checks) only.

---

## Tier 1: Single-File Layout (`SPECIFICATION.md`)

Use this layout for small tools and micro-components:

1. **Overview and Purpose** — What the component does.
2. **Context and Actors** — Inputs, outputs, and calling systems.
3. **Functional Requirements** — Numbered list with normative keywords (MUST, SHOULD).
4. **Data and Interfaces** — Input parameters, output payloads, and error codes.
5. **Business Rules and Logic** — Calculations and validation checks.
6. **Acceptance Criteria** — Concrete test scenarios with given/when/then conditions.
7. **Open Questions** — Unresolved items and assumptions.

---

## Tier 2: Service Suite (3 to 5 Files)

Use this layout for standard services:

- `README.md` — Overview, system context, boundaries, and reading order.
- `01-architecture-and-data.md` — Logical components, domain model, database schema, and interfaces.
- `02-requirements-and-rules.md` — Functional requirements (FR-xxx) and business rules (BR-xxx).
- `03-operations-and-security.md` — Configuration, security boundaries, and error catalogue.
- `04-testing-and-questions.md` — Acceptance test scenarios and open questions register.

---

## Tier 3: Full Modular Suite

Use this layout for large systems or full reverse-engineering projects:

| File Name                          | Primary Contents                                                                   | Key Standard IDs |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ---------------- |
| `README.md`                        | Purpose, scope, analysis summary, reading order, and quality report.               | -                |
| `01-system-context.md`             | System purpose, actors, external systems, boundaries, and context diagram.         | -                |
| `02-architecture.md`               | Component breakdown, responsibilities, data flow, and coupling analysis.           | COMP-xxx         |
| `03-functional-requirements.md`    | Atomic, testable requirements with preconditions and failure modes.                | FR-xxx           |
| `04-workflows.md`                  | End-to-end use cases, sequence diagrams, and alternative paths.                    | WF-xxx           |
| `05-domain-model.md`               | Entities, aggregates, relationships, invariants, and entity-relationship diagrams. | -                |
| `06-data-specification.md`         | Field dictionaries, logical data types, constraints, and persistence rules.        | -                |
| `07-interface-specification.md`    | API contracts, request and response payloads, status codes, and idempotency.       | API-xxx          |
| `08-business-rules.md`             | Decision tables, calculation formulas, algorithms, and pseudocode.                 | BR-xxx           |
| `09-state-concurrency-time.md`     | State machines, transitions, race conditions, clocks, and locking rules.           | -                |
| `10-errors-resilience.md`          | Error catalogue, propagation paths, retries, and partial failure matrix.           | ERR-xxx          |
| `11-security-privacy.md`           | Trust boundaries, identity, permissions, sensitive fields, and audit trails.       | -                |
| `12-configuration.md`              | Configuration settings, defaults, validation, and precedence rules.                | -                |
| `13-acceptance-tests.md`           | Language-independent test scenarios (normal, boundary, negative).                  | AT-xxx           |
| `14-traceability.md`               | Cross-reference matrices mapping requirements to tests and components.             | -                |
| `15-compatibility-parity.md`       | Reimplementation parity checklist (must-preserve versus may-vary items).           | -                |
| `16-open-questions.md`             | Register of ambiguities, conflicts, risks, and missing stakeholder decisions.      | OQ-xxx           |
| `appendix-a-codebase-inventory.md` | Inventory of all analysed files, purposes, and statuses.                           | -                |
| `appendix-b-glossary.md`           | Canonical definitions of business terms and acronyms.                              | -                |
| `appendix-c-evidence-index.md`     | Consolidated index mapping IDs to evidence source locations.                       | -                |

---

## Standard Heading Structure

Start every specification file with these three headings:

```markdown
# [Document Title]

## Purpose
[One to two sentences stating the objective of this document.]

## Scope
[State what is included and what is excluded.]

## Related Documents
[Relative markdown links to related specification files.]
```
