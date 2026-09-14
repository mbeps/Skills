---
name: writing-code
description: Use when writing or modifying code across any language or framework — implementing new features, fixing bugs, refactoring, cleaning up technical debt, or reviewing code changes
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
- **Keep external systems behind a boundary**: Isolate your application from external service changes by converting their data into your own internal format.
- **Make invalid states harder to represent**: Design your data types and schemas so that it is impossible or difficult to construct objects in an invalid state.
- **Separate decisions from actions**: Decouple your business logic from side effects like database updates or network calls so that rules can be tested in isolation.
- **Make error messages and codes useful**: Provide both human-readable messages and machine-readable error codes to simplify debugging and system handling.
- **Do not over-abstract**: At a certain point, abstraction is bad because there are too many layers. Keep implementations concrete until abstraction is proven necessary.

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
| **Over-Abstraction** | Unnecessary indirection layers, cognitive friction | Keep code direct; inline until reuse across 3+ sites is proven |
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
- [ ] YAGNI adhered to: no speculative code or features that are not needed.
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
