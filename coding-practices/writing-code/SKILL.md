---
name: writing-code
description: Use when writing or modifying code across any language or framework — implementing new features, fixing bugs, refactoring, applying pragmatic design patterns and SOLID principles, or reviewing code changes
---

# Role & Directive
Deliver simple, clear, and maintainable code that is straightforward to read, modify, and evolve over the long term. Prioritise simpler solutions and long-term readability over cleverness; never introduce unnecessary complexity, premature optimisations, or overcomplicated patterns. Code must not be more complex than the underlying domain requires. Follow YAGNI strictly—build only what is needed.

# When to Use
- Implementing new features, functions, classes, or components
- Modifying, refactoring, or extending existing codebases
- Resolving bugs, errors, regressions, or unexpected behaviours
- Reviewing code for maintainability, simplicity, and standards compliance

Do NOT use for non-coding tasks (e.g. documentation-only tasks, conceptual discussions without code changes).

# Workflow: Steps to Follow

1. **Explore & Analyse**
   - Inspect relevant files, functions, and imports before writing code.
   - Identify existing utilities and helpers to reuse; avoid duplicate implementations.
   - Check callers and dependents to assess blast radius. Avoid reading unrelated files.

2. **Plan Surgically**
   - Break implementation into small, logical steps.
   - Keep changes focused: limit edits to a single, clear purpose so code remains easy to review and maintain.
   - Think long term: reject short-term hacks that incur negative long-term maintenance consequences.
   - Follow YAGNI (You Aren't Gonna Need It): do not build what is not needed.

3. **Implement Minimally**
   - Apply the Core Engineering Rules and Security Hygiene standards below.
   - Keep code simple and clear; avoid unnecessary layers of abstraction.
   - Centralise shared logic only when reused across multiple call sites; colocate single-use logic where consumed.
   - Document public APIs, interfaces, and complex algorithms as you go (JSDoc, Docstrings, JavaDoc).

4. **Write & Run Automated Tests**
   - Write automated unit, integration, or regression tests covering new functionality, edge cases, and bug fixes—do not leave new code untested.
   - Ensure tests verify both successful execution paths and failure/error states.
   - Run existing and newly written automated test suites, linters, and type checkers to guarantee zero regressions.

5. **Verify & Review**
   - Verify changes against industry standards and repository conventions.
   - Ensure imports, types, and dependencies resolve cleanly.

# Core Engineering Rules

- **Keep the main path easy to follow**: Use guard clauses to handle errors early so the primary logic remains clean and readable.
- **Name things by their meaning**: Choose descriptive names that clearly communicate the purpose of your variables, functions, and types.
- **Apply SOLID selectively with YAGNI as a control**: Adhere to Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion where they manage real variation and testability. Reject dogmatic SOLID when it introduces premature abstractions, 1:1 interfaces ("interface-itis"), or unwarranted complexity.
- **Keep external systems behind a boundary**: Isolate your application from external service changes by converting their data into your own internal format.
- **Make invalid states harder to represent**: Design your data types and schemas so that it is impossible or difficult to construct objects in an invalid state (e.g. state machines or discriminated unions instead of boolean flag soup).
- **Separate decisions from actions**: Decouple your business logic from side effects like database updates or network calls so that rules can be tested in isolation.
- **Decouple state and communication when justified**: Use explicit State Machines for complex lifecycles and Event Buses for 1-to-many asynchronous side effects. For 1-to-1 calls or binary states, keep it direct.
- **Make error messages and codes useful**: Provide both human-readable messages and machine-readable error codes to simplify debugging and system handling.
- **Do not over-abstract (3–4 layer limit)**: While abstraction can be good for managing real variation and isolating boundaries, never introduce over-abstraction as it creates indirection mazes and makes the codebase excessively complex. Around 3–4 layers of abstraction (e.g. Route/Handler → Service/UseCase → Repository/Gateway → Client) should be the absolute limit. Keep implementations direct and concrete until abstraction is proven necessary.

# Pragmatic SOLID, Architecture & Design Patterns

Apply architectural patterns, design patterns, and SOLID principles selectively. They are tools to manage real complexity, not badges of honour.

| Pattern / Principle | Purpose | YAGNI Sanity Check & Boundary | Reference |
|---|---|---|---|
| **SOLID Principles** (SRP, OCP, LSP, ISP, DIP) | Guide cohesion, extensibility, substitutability, and boundary decoupling. | Apply only when friction, churn, or 3+ concrete variations exist. Avoid 1:1 "interface-itis". | [solid-principles.md](./references/solid-principles.md) |
| **Design Patterns & Refactoring** (Bridge, Strategy, Composition over Inheritance, Guard Clauses) | Resolve subclass explosion, dynamic rule dispatch, and nested logic safely. | Prefer composition by default. Use Strategy/Bridge only when 3+ variations or multi-axis churn exists. | [design-patterns.md](./references/design-patterns.md) |
| **State Machines** (FSM / Discriminated Unions) | Formalise multi-step lifecycles and eliminate illegal state transitions. | Use when managing 3+ dependent states or transition rules; avoid for binary toggles. Specific FSM libraries warrant separate skills. | [architectural-patterns.md](./references/architectural-patterns.md) |
| **Event Bus / Pub-Sub** (Domain Events) | Decouple producers from multiple independent side-effect listeners. | Use for 1-to-many async side effects. If only 1 consumer exists, call the function directly. Full event broker setup warrants separate skills. | [architectural-patterns.md](./references/architectural-patterns.md) |
| **Boundaries & Gateways** (Adapters) | Isolate external vendor SDKs and database clients from domain rules. | Keep wrappers thin; do not wrap stable standard library utilities. | [architectural-patterns.md](./references/architectural-patterns.md) |

# Security Hygiene & Defensive Coding

- **Strictly Forbid Hardcoded Secrets**: Never commit API keys, tokens, credentials, or private keys in code or configuration files. Load sensitive values exclusively from secure environment variables or secret management services.
- **Validate & Sanitise at Public Boundaries**: Enforce strict schema validation and sanitisation on all untrusted external input (HTTP parameters, request bodies, webhooks, file uploads, IPC messages) before processing.
- **Restrict Unsafe Dependency Additions**: Do not introduce third-party libraries when standard library or existing project utilities suffice. Vet all required new dependencies for maintenance, licensing, and security vulnerabilities before adding.

# Constraints & Boundaries

## Scope & Invariants
- **Preserve System Stability**: Never break existing application functionality or dependent caller contracts.
- **Follow Industry Standards**: Adhere to established idioms, type safety, and conventions of the language and framework in use.
- **Zero Assumptions**: Verify types, signatures, and library APIs against project source or documentation before use.
- **Composition over Inheritance**: Prefer flat structures and composition over deep class hierarchies.
- **Abstraction Depth Cap**: Strictly limit architectural indirection to around 3–4 layers maximum. Never wrap wrappers or create pass-through boilerplate that obscures execution flow.
- **Justified Complexity**: Do not make code more complex than necessary. For intrinsically complex logic (e.g. mathematical algorithms, low-level optimisations), provide clear explanatory documentation explaining the rationale.

## Permitted Resources
- Codebase files, git history, and build/test configurations.
- Project documentation: `README.md`, `AGENTS.md`, `CLAUDE.md`, and `.wiki/` directory.
- Relevant documentation and search tools (such as Context7 if available, package documentation, and verified web search) to inspect library and framework APIs.
- Terminal commands for building, linting, executing tests, and debugging.
- Cross-skill references (e.g. clean-code, systematic-debugging, documentation-writer).

# Anti-Patterns & Corrections

| ❌ Anti-Pattern | ⚠️ Consequence | ✅ Actionable Fix |
|---|---|---|
| **Untested New Code** | Undetected bugs, silent regressions | Write automated unit/regression tests for every new feature and fix |
| **Hardcoded Secrets** | Credential leaks, severe security breaches | Extract to environment variables or secret management vaults |
| **Unvalidated Boundary Data** | Injection attacks, data corruption | Validate and sanitise all incoming data against explicit schemas |
| **Unvetted Dependency Additions** | Supply chain vulnerabilities, bloat | Use existing utilities or standard library; vet packages before adding |
| **Over-Abstraction (>3–4 Layers)** | Unnecessary indirection layers, cognitive friction, hard-to-trace execution | Limit abstraction depth to around 3–4 layers; keep code direct and collapse pass-through wrappers |
| **Dogmatic SOLID / Interface-itis** | Indirection mazes, single-implementation boilerplate | Write concrete code first; extract interfaces only for multiple implementations or I/O boundaries |
| **Boolean Flag Soup** | Fragile states, illegal state combinations | Model states explicitly with State Machines or discriminated union types |
| **Premature Decoupling / Event Sprawl** | Hard-to-trace action-at-a-distance for simple flows | Use direct function calls for 1-to-1 synchronous flows; reserve event buses for 1-to-many async side effects |
| **Reinventing Utilities** | Redundant code, fragmented bug fixes | Check existing helpers first; reuse before creating new |
| **God Functions / Monoliths** | Fragile edits, high maintenance complexity | Split into small functions with single responsibility |
| **Deep Nesting (>2 levels)** | Unreadable branching logic | Use guard clauses and early returns |
| **Mixed Logic & Side Effects** | Hard to test, fragile state transitions | Separate pure decision logic from I/O and database operations |
| **Leaky External Boundaries** | Upstream API changes break core domain | Map external payloads into internal domain models at the boundary |
| **Silent Interface Breaks** | Runtime errors across modules | Check all callers and update consumers in the same change |
| **Unfocused PRs / Edits** | Review fatigue, difficult rollbacks | Restrict changes to a single, coherent objective |

# Failure & Clarification Protocol

- **Errors & Regressions**: Identify root cause via logs, compiler diagnostics, and tests before editing. Never apply superficial patches without diagnosing cause.
- **Structured Errors**: Emit actionable error messages paired with machine-readable error codes to aid debugging and telemetry.
- **Ambiguous Requirements**: If instructions lack essential parameters or conflict, halt and ask for targeted clarification with concrete options.
- **Technical Blockers**: If requested changes violate architecture safety or are infeasible, explain the constraint and suggest alternatives.

# Quality Verification Checklist

Before completing any task, verify:
- [ ] Code is simple, clear, and easy to understand, maintain, and modify.
- [ ] Complexity is necessary and justified; simpler alternatives evaluated and chosen.
- [ ] YAGNI adhered to: no speculative code, premature abstractions, or single-implementation interfaces.
- [ ] SOLID principles applied selectively where variation or testing boundaries demand it, avoiding dogmatic over-engineering.
- [ ] State transitions modeled explicitly (state machine, enum, discriminated union) rather than boolean flag soup.
- [ ] Decoupling mechanisms (event bus, gateways) justified by real multi-consumer needs or system boundaries.
- [ ] New unit, integration, or regression tests written and passing for all modified logic.
- [ ] Zero hardcoded secrets, credentials, or API tokens in the codebase.
- [ ] Untrusted inputs validated and sanitised at public boundaries.
- [ ] No unvetted, redundant, or unnecessary dependencies added.
- [ ] Change is focused on a single, clear purpose.
- [ ] Main path is easy to follow with guard clauses handling edge cases early.
- [ ] Variables, functions, and types named descriptively by their meaning.
- [ ] External systems kept behind boundaries with data converted to internal formats.
- [ ] Invalid states are difficult or impossible to represent in data types.
- [ ] Business logic (decisions) decoupled from side effects (actions).
- [ ] Error messages and codes are informative and machine-readable.
- [ ] Follows industry standards and repository style conventions.
- [ ] Linters, type checks, and automated test suites pass cleanly without regressions.
