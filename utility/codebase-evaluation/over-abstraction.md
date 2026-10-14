# Over-Abstraction Audit Module

Identifies shallow layers, trivial wrappers, anticipatory abstractions, and excessive fragmentation that obscure code flow and increase cognitive load without functional benefit.

For comprehensive catalogs and diagnostic metrics, see [Code Smells Matrix](references/code-smells-matrix.md) and [Complexity & Hotspots Reference](references/complexity-and-hotspots.md).

## When to Use

Use this module when you need to:
- Audit codebases for shallow abstraction layers and trivial passthrough wrappers
- Detect "Interfaces for One"—interfaces or abstract classes with only a single implementation
- Identify Lasagna Code—excessive layering where data passes through unchanged
- Flag excessive granularity and micro-file explosion (over-decomposition)
- Spot speculative infrastructure schema debt (premature multi-tenancy, unused plugin hooks)
- Identify micro-tool and micro-endpoint catalog sprawl
- Detect over-abstracted presentational UI wrappers
- Measure Indirection Debt and Cognitive Load along critical execution paths

## Key Analysis Areas

### 1. Trivial Passthrough Wrappers
1–2 line functions, adapter classes, or facade methods that do nothing except forward parameters to another underlying function with zero validation, mutation, or error translation. Adds execution hops without adding value.

### 2. Interfaces for One
Interfaces or abstract base classes that have exactly one concrete implementation in the entire codebase, with no polymorphism, no swappable driver requirements, and no distinct test mock needs.

### 3. Lasagna Code & Indirection Debt
Excessive vertical layering where a simple request traverses $\ge 4$ distinct layers (e.g. Controller → Interceptor → Manager → Service → Repository → DAO) without data modification.

### 4. Excessive Granularity & Micro-File Explosion
Over-decomposition where a coherent 150-line domain feature is fragmented into 15 isolated 10-line files across nested directories. Increases cognitive overhead as engineers must maintain dozens of open tabs to follow a single sequence.

### 5. Speculative Infrastructure Schema Debt
Anticipatory architecture designed for hypothetical future scale—such as multi-tenant organization IDs, distributed event sourcing tables, or dynamic plugin registries—in an application that currently serves a single tenant with static requirements.

### 6. Micro-Tool & Micro-Endpoint Catalog Sprawl
Creating dozens of hyper-specialized, single-parameter endpoints or MCP tools (e.g. `get_user_name`, `get_user_email`, `get_user_phone`) instead of a cohesive, structured query interface, leading to context bloat and selection fatigue.

### 7. Over-Abstracted Presentational & Typography Wrappers
Creating bespoke React/Vue wrappers around native HTML tags (e.g. `<TextSpan>`, `<ParagraphContainer>`) that merely forward `children` and `className` without encapsulating design tokens or accessibility behaviour.

---

## Quality Principles

- **YAGNI (You Ain't Gonna Need It)** – Build abstractions for proven present requirements, not speculative future permutations.
- **Rule of Three** – An abstraction should typically be justified by at least three concrete, distinct call sites or polymorphic implementations.
- **Cognitive Proximity** – Code that changes together should live together; do not fragment tightly bound logic across disparate files.
- **Preserve Legitimate Abstractions** – Distinguish between shallow wrappers and legitimate domain boundaries (e.g. external payment gateway insulation, security authorization gates).

---

## What This Module Does NOT Do

- Does not suggest collapsing abstractions if it creates code duplication (violating DRY)
- Does not flag standard layers required by frameworks (e.g. NestJS controllers/services, Spring repositories)
- Does not modify or inline code
- Does not penalize deliberate hexagonal or clean architecture boundaries when properly justified by domain complexity

---

## Report Structure

Each finding includes:

- **Finding Name & Pattern** – Clear title of the over-abstraction pattern
- **Status** – Confirmed Over-Abstraction / Speculative Architecture / Excessive Granularity
- **Indirection Trace Path** – Sequential list of files and hops involved in the call path
- **Complexity Justification** – Concrete metrics (hop count, LOC, pass-through ratio) proving lack of utility
- **Diagnostic Simplification** – Target architecture recommendation (e.g. inline wrapper, consolidate micro-files)
- **Impact** – Measurable reduction in indirection depth and cognitive load

---

## Example Findings

**Example 1: Trivial Passthrough Wrapper Over-Abstraction**
- **Pattern**: `UserServiceAdapter` Passthrough Layer
- **Status**: Confirmed Over-Abstraction
- **Indirection Trace Path**: `UserController` (line 34) → `UserServiceAdapter` (line 12) → `UserService` (line 45) → ORM
- **Complexity Justification**: `UserServiceAdapter.getUserById(id)` merely executes `return this.userService.getUserById(id)`. Contains 0 lines of transformation or validation across all 8 methods.
- **Diagnostic Simplification**: Remove `UserServiceAdapter`; inject `UserService` directly into `UserController`.
- **Impact**: Eliminates 1 intermediary hop, deletes 65 lines of dead wrapper code, simplifies stack traces.

**Example 2: Excessive Granularity (Micro-File Explosion)**
- **Pattern**: Hyper-Fragmented String Utilities
- **Status**: Excessive Granularity
- **Indirection Trace Path**: `src/utils/strings/capitalize.ts`, `src/utils/strings/lowercase.ts`, `src/utils/strings/trim.ts`, `src/utils/strings/index.ts`
- **Complexity Justification**: 6 individual files each containing a 2-line standard JavaScript string method wrapper. Navigating between them creates mental friction.
- **Diagnostic Simplification**: Consolidate into a single cohesive `src/utils/strings.ts` module.
- **Impact**: Reduces file count by 5; keeps related string operations in a single readable module.

---

## Example Invocation

```
Analyse [PROJECT_PATH] for over-abstraction, trivial passthrough wrappers, and excessive indirection.
Audit:
- Shallow pass-through wrappers that merely forward parameters
- Interfaces with only a single implementation (Interfaces for One)
- High indirection call stacks (hops >= 5)
- Micro-file explosion and excessive folder fragmentation
- Speculative multi-tenancy or unused plugin infrastructure

Trace execution paths and calculate indirection debt for each finding.
```
