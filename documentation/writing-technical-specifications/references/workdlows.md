# Workflows for Writing Technical Specifications

## Purpose

This document provides step-by-step workflows for reverse-engineering existing systems and specifying new greenfield systems.

## Workflow A: Reverse-Engineering an Existing System

Use this workflow when code, tests, schemas, or configuration files already exist.

```
Codebase Inventory → Evidence Model → Component Architecture → Requirements Extraction → Data & Interfaces → Acceptance Tests → Parity & Gaps
```

### Step 1: Inventory the Codebase
1. List all source files, schemas, configurations, templates, and scripts.
2. Identify entry points, public endpoints, background workers, and utilities.
3. Separate production code from tests, build scripts, and generated files.
4. Record excluded or unreadable files in the inventory appendix.

### Step 2: Build the Evidence Model
1. Treat executable code as primary evidence.
2. Treat automated tests as behavioural evidence.
3. Treat comments and documentation as intent only.
4. Mark every substantive claim with its evidence source (`path/file.ext:Lstart-Lend`).
5. Assign a confidence rating to every claim:
   - **Confirmed:** Directly verified from code, schema, or tests.
   - **Inferred:** Strongly implied by multiple data points, but not stated explicitly.
   - **Unresolved:** Ambiguous, missing, or contradictory evidence.

### Step 3: Reconstruct Context and Architecture
1. Identify external actors and connected upstream and downstream systems.
2. Draw the system boundary. Document responsibilities that are in scope and out of scope.
3. Decompose the system into logical components (COMP-xxx).
4. Map data flow and control flow between components.
5. Identify hidden global state, in-memory caches, and temporal coupling.

### Step 4: Extract Requirements and Rules
1. Derive atomic functional requirements (FR-xxx) using normative keywords (MUST, SHOULD).
2. Extract decision tables, calculation formulas, and algorithms as business rules (BR-xxx).
3. Write pseudocode for complex algorithms.
4. Document the exact behavior of edge cases and input validation failures.

### Step 5: Specify Data, Interfaces, and State
1. Build a field dictionary for persistent tables and transit payloads.
2. Define API endpoints (API-xxx), request parameters, response structures, and status codes.
3. Document state lifecycles and permitted transitions.
4. Build an error catalogue (ERR-xxx) with recovery actions.

### Step 6: Create Acceptance Tests and Traceability
1. Derive language-independent test scenarios (AT-xxx) covering normal, boundary, and negative cases.
2. Build traceability matrices mapping requirements to tests, components, and interfaces.
3. Construct a parity checklist (must-preserve versus may-vary items) for reimplementation.

### Step 7: Record Open Questions
1. Record bugs, missing checks, security vulnerabilities, and inconsistencies as open questions (OQ-xxx).
2. Rate the risk of each question to faithful reimplementation (High, Medium, Low).
3. Do not invent solutions or alter production code.

---

## Workflow B: Greenfield Specification for a New System

Use this workflow when creating a specification for a system that does not yet exist.

```
Input Ingestion → Clarification Interview → Scope & Sizing → System Context → Architecture → Requirements & Rules → Data & APIs → Tests & Open Questions
```

### Step 1: Ingest Inputs
1. Read the Product Requirements Document (PRD), Request for Comments (RFC), or user brief.
2. Identify initial objectives, target users, and expected capabilities.
3. Identify stated non-goals and out-of-scope boundaries.

### Step 2: Conduct Discovery Interview
When key requirements are missing or ambiguous, ask clarifying questions before writing.
1. Formulate concise, targeted questions.
2. Ask about trust boundaries, data volumes, integration protocols, and user roles.
3. Do not make unverified assumptions when the user can provide the answer.
4. Record all answered questions as design constraints.

### Step 3: Determine Sizing Tier
1. Evaluate system complexity:
   - Micro-component or single script → **Tier 1** (single file).
   - Independent microservice or API → **Tier 2** (3 to 5 files).
   - Multi-service system or platform → **Tier 3** (modular suite).
2. Never create empty files or scaffoldings.

### Step 4: Define System Context and Boundaries
1. Identify human actors and external software systems.
2. Define explicit system boundaries and external integration points.
3. Create a Mermaid context diagram showing actors, boundaries, and external systems.
4. Document explicit non-goals to prevent scope creep.

### Step 5: Decompose Logical Architecture
1. Divide the system into components with single, clear responsibilities (COMP-xxx).
2. Define inputs, outputs, owned state, and dependencies for each component.
3. Specify concurrency assumptions and ordering rules.

### Step 6: Formulate Requirements and Workflows
1. Write atomic functional requirements (FR-xxx) using MUST, MUST NOT, SHOULD, and MAY.
2. Detail each requirement with preconditions, triggers, processing steps, and failure modes.
3. Document end-to-end user workflows (WF-xxx) with main and alternative paths.
4. Include sequence diagrams for multi-step interactions.

### Step 7: Design Data Model, Interfaces, and Rules
1. Define entities, attributes, primary keys, relationships, and constraints.
2. Specify API routes, request bodies, response payloads, error models, and idempotency.
3. Formulate business rules, decision tables, validation checks, and calculation algorithms.
4. Detail state transitions and lifecycle guards.

### Step 8: Define Security, Errors, and Configuration
1. Specify authentication, authorization, and sensitive data protections.
2. Construct a complete error catalogue with machine codes, human messages, and retryability.
3. Document configuration keys, types, defaults, and validation rules.

### Step 9: Establish Acceptance Criteria and Open Questions
1. Write concrete acceptance test scenarios (AT-xxx) using given/when/then structure.
2. Map every functional requirement to at least one acceptance test.
3. Log unresolved decisions and dependencies in an Open Questions Register (OQ-xxx).
