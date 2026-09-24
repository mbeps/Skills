---
name: writing-code
description: Use when writing, modifying, refactoring, or reviewing code across any language or framework — applying pragmatic clean coding standards, Simplicity Ladder, SOLID principles, defensive architecture, and automated verification.
---

# Role & Directive
Deliver simple, clear, and maintainable code that is straightforward to read, modify, and evolve over the long term. **The best code is the code never written.** Prioritise simpler solutions, long-term readability, deletion over addition, boring over clever, and fewest files possible. Question complex requests: *"Do you actually need X, or does Y cover it?"* 

**Be concise, direct, and solution-focused.** Deliver clean, working code rather than programming lessons or tutorials. Never introduce unrequested abstractions, premature optimisations, or speculative boilerplate. Code must not be more complex than the underlying domain requires. Follow YAGNI strictly—build only what is needed today, designed to be easy to delete or replace tomorrow.

# When to Use
- Implementing new features, functions, classes, or components
- Modifying, refactoring, or extending existing codebases
- Resolving bugs, errors, regressions, or unexpected behaviours
- Reviewing code for maintainability, simplicity, clean code standards, and architectural hygiene

Do NOT use for non-coding tasks (e.g. documentation-only tasks, conceptual discussions without code changes).

# Core Principles

| Principle | Core Meaning | Pragmatic Application |
|---|---|---|
| **KISS** | Keep It Simple | Prefer the simplest solution that reliably works. Boring over clever. |
| **YAGNI** | You Aren't Gonna Need It | Build strictly what is needed today. No speculative features or premature abstractions. |
| **SRP** | Single Responsibility | Each function, class, or module does ONE thing and has one reason to change. |
| **DRY & Rule of Three** | Don't Repeat Yourself (Balanced) | Extract duplicates when proven; duplicate before creating premature abstractions. Extract shared helpers only when reused across 3+ distinct call sites. |
| **Boy Scout Rule** | Leave Code Cleaner | Leave code cleaner than you found it. Remove dead code, simplify confusing constructs, and fix minor lints in touched areas without sprawling scope. |
| **Blast Radius Discipline** | Think Before Editing | Assess callers, dependents, and tests before modifying any file. Edit the file and all dependent consumers in the same task. |

---

# 🔴 Before Editing ANY File (THINK FIRST!)

Before modifying any existing file or interface, assess the blast radius:

| Check | Key Question | Consequence / Action |
|---|---|---|
| **Callers & Importers** | *What imports or calls this file?* | Signature changes will break them. Identify all callers. |
| **Dependencies** | *What does this file import?* | Avoid leaking internal abstractions across boundaries. |
| **Test Coverage** | *What tests cover this code?* | Locate existing tests that must be executed and kept green. |
| **Shared Contracts** | *Is this a shared interface/component?* | Multiple modules rely on this. Update consumers in the **same task**. |

```
File to edit: UserService.ts
├── Who imports this? ────────► UserController.ts, AuthMiddleware.ts
├── Do they need changes too? ─► Check function signatures and return types
└── Are tests affected? ──────► UserService.test.ts, Auth.test.ts
```

> 🔴 **Rule:** Modify the file and all dependent files in the **same task**. Never leave broken imports, stale signatures, or missing updates.

---

# Workflow: Steps to Follow

1. **Explore & Analyse (Blast Radius Check)**
   - Inspect relevant files, functions, and imports before writing code.
   - Run the Pre-Edit Blast Radius check: identify callers, dependents, and existing test suites.
   - Identify existing utilities and helpers to reuse; avoid duplicate implementations.
   - Avoid reading unrelated files; maintain strict focus on the problem boundary.

2. **Plan Surgically & Climb the Simplicity Ladder**
   - Break implementation into small, logical steps; limit edits to a single, clear purpose.
   - Stop at the first rung of the **Simplicity Ladder** that holds:
     1. *Need it at all?* (YAGNI / question requirement)
     2. *Standard library?* (built-in functions/modules)
     3. *Native platform feature?* (runtime, browser, or OS capabilities)
     4. *Installed dependency?* (reuse existing vetted package)
     5. *Clear one-liner/expression?* (comprehension, declarative method chain)
     6. *Minimum concrete code* (direct, boring, minimal implementation)
   - Reject speculative requirements ("what if we need X later?").

3. **Implement with Clean Code Standards**
   - Apply the Clean Code Standards below: descriptive intent-revealing names, small focused functions, few arguments, guard clauses, flat over nested (max 2 levels), and colocation.
   - Let code self-document; eliminate obvious or narrative comments.
   - Deliver working code directly without meta-commentary, tutorials, or "First we import..." narration.
   - Write concrete code first; avoid unrequested abstractions, single-implementation interfaces, and premature factories.
   - Pick the edge-case-correct option when standard library approaches are the same size: simplicity means less code, not a flimsier algorithm.
   - Centralise shared logic only when reused across 3+ call sites (**Rule of Three**); colocate single-use logic where consumed.
   - Mark intentional simplifications with a `shortcut:` or `ponytail:` comment naming the **ceiling** (the limit where it breaks) and the **upgrade path** (what to do when reached).
   - Document public APIs, interfaces, and complex algorithms as you go (JSDoc, Docstrings, JavaDoc).

4. **Write & Run Automated Tests**
   - Provide the **smallest runnable check**: non-trivial logic leaves behind the smallest test that fails if logic breaks. Trivial one-liners and framework wiring need no test.
   - Ensure tests verify both successful execution paths and failure/error states.
   - Run existing and newly written automated test suites, linters, and type checkers to guarantee zero regressions.

5. **Verify & Review (Diff Audit & Self-Check)**
   - Review diffs for unnecessary complexity using the **5 Cut Tags**:
     - `delete:` Dead code or speculative features (replacement: nothing).
     - `stdlib:` Hand-rolled logic already provided by standard library.
     - `native:` Dependency/code doing what the platform already does.
     - `yagni:` 1:1 abstractions, unused config, layers with one caller.
     - `shrink:` Same logic, fewer lines or cleaner idioms.
   - Target net negative lines (`net: -N lines`) or confirm `Lean already. Ship.`
   - Execute the **Mandatory Self-Check Gates** before concluding.

---

# Clean Code Standards

## 1. Naming Conventions

| Element | Convention | Example | Anti-Pattern |
|---|---|---|---|
| **Variables** | Reveal intent clearly | `userCount`, `timeoutMs`, `activeUser` | `n`, `t`, `temp`, `data` |
| **Functions / Methods** | Verb + noun (action oriented) | `getUserById()`, `calculateTotal()` | `user()`, `calc()`, `doStuff()` |
| **Booleans** | Question / predicate form | `isActive`, `hasPermission`, `canEdit` | `active`, `check`, `flag` |
| **Constants & Enums** | SCREAMING_SNAKE | `MAX_RETRY_COUNT`, `DEFAULT_PORT` | `maxRetries`, `port` |

> **The Self-Documenting Naming Rule:** If you need an inline comment to explain what a variable, function, or parameter does, rename it to reveal its intent directly.

## 2. Function Design & Sizing

| Rule | Standard | Rationale |
|---|---|---|
| **Small Size** | Ideally 5–10 lines; max ~20–30 lines | Small functions fit in short-term memory and are easy to reason about. |
| **Do One Thing** | Exactly one clear responsibility | If a function does multiple disparate steps, split it into composable units. |
| **Single Level of Abstraction (SLAP)** | One level of abstraction per function | Do not mix high-level business workflow with low-level string manipulation or bitmasking. |
| **Few Arguments** | Max 3 arguments; prefer 0–2 | When 4+ arguments are needed, group them into a typed parameter object or options bag. |
| **Pure & Predictable** | No unexpected side effects | Do not mutate input arguments unexpectedly; prefer pure functions where inputs map deterministically to outputs. |

## 3. Code Structure & Flow Control

| Pattern | Rule | Implementation |
|---|---|---|
| **Guard Clauses** | Return early for edge cases & errors | Exit early on invalid preconditions; keep the primary happy path unindented. |
| **Flat > Nested** | Max 2 levels of indentation | Avoid deep nesting / arrow anti-pattern (`if { if { while { if ... } } }`). Refactor using guards or polymorphism. |
| **Composition** | Compose small, focused functions | Combine small, single-purpose functions instead of building monolithic procedures. |
| **Colocation** | Keep related code close | Place single-use helpers in the file or module where they are consumed. Do not create a separate `utils.ts` for a single function. |

## 4. Comments & AI Coding Pragmatics

| Situation | Required Behavior | Anti-Pattern |
|---|---|---|
| **Feature Request** | Write clean, working code directly. | Writing lecture paragraphs or tutorial explanations. |
| **Bug Fix** | Fix the root cause directly; verify with tests. | Explaining code mechanics or patching symptoms without diagnosis. |
| **Unclear Requirement** | Stop and ask targeted clarifying questions. | Guessing, making unrequested assumptions, or over-building. |
| **Inline Comments** | Explain **WHY** (rationale, invariants, trade-offs). | Explaining **WHAT** the code does line-by-line (`// increment i`). |
| **AI Narration** | Eliminate conversational filler in code. | Adding comments like `// First we import...` or `// Now we create...`. |

> **Rule:** Code should be self-documenting. The user wants clean, production-ready code, not a programming tutorial.

---

# Core Engineering Rules

- **Stop at the first rung of the Simplicity Ladder**: Check whether stdlib, native platform, or existing dependencies solve the problem before writing custom code.
- **No unrequested abstractions or boilerplate**: Write concrete implementations first. Reject single-implementation interfaces ("interface-itis"), factories with one product, or pass-through wrappers that merely forward calls.
- **Edge-case-correct stdlib**: When two standard library approaches take similar effort, choose the robust, edge-case-safe function. Simplicity means less code, not fragile algorithms.
- **Document intentional shortcuts with ceiling & upgrade path**: When taking a deliberate heuristic or simplification, leave a `shortcut:` or `ponytail:` comment specifying the ceiling (e.g. concurrency limit, data volume) and the upgrade trigger so technical debt remains visible and actionable.
- **Non-negotiables (never compromise)**: Simplicity never excuses sloppiness. Never cut corners on input validation at trust boundaries, error handling that prevents data loss, security hygiene, accessibility (a11y), hardware/platform calibration (e.g. clock drift), or explicit user requirements.
- **Keep the main path easy to follow**: Use guard clauses to handle errors early so the primary logic remains clean and readable.
- **Name things by their meaning**: Choose descriptive names that clearly communicate the purpose of your variables, functions, and types.
- **Apply SOLID selectively with YAGNI as a control**: Adhere to Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion where they manage real variation and testability. Reject dogmatic SOLID when it introduces premature abstractions, 1:1 interfaces, or unwarranted complexity.
- **Keep external systems behind a boundary**: Isolate your application from external service changes by converting their data into your own internal format.
- **Make invalid states harder to represent**: Design your data types and schemas so that it is impossible or difficult to construct objects in an invalid state (e.g. state machines or discriminated unions instead of boolean flag soup).
- **Separate decisions from actions**: Decouple your business logic from side effects like database updates or network calls so that rules can be tested in isolation.
- **Decouple state and communication when justified**: Use explicit State Machines for complex lifecycles and Event Buses for 1-to-many asynchronous side effects. For 1-to-1 calls or binary states, keep it direct.
- **Make error messages and codes useful**: Provide both human-readable messages and machine-readable error codes to simplify debugging and system handling.
- **Do not over-abstract (3–4 layer limit)**: While abstraction can be good for managing real variation and isolating boundaries, never introduce over-abstraction as it creates indirection mazes and makes the codebase excessively complex. Around 3–4 layers of abstraction (e.g. Route/Handler → Service/UseCase → Repository/Gateway → Client) should be the absolute limit. Keep implementations direct and concrete until abstraction is proven necessary.

---

# Pragmatic SOLID, Architecture & Design Patterns

Apply architectural patterns, design patterns, and SOLID principles selectively. They are tools to manage real complexity, not badges of honour.

| Pattern / Principle | Purpose | YAGNI Sanity Check & Boundary | Reference |
|---|---|---|---|
| **YAGNI & Simplicity Ladder** (6 Rungs, 5 Cut Tags, Debt Audits) | Eliminate speculative code, leverage stdlib/platform, and cut diff complexity. | Stop at first rung that holds. Mark shortcuts with ceiling + upgrade trigger. | [yagni-principles.md](./references/yagni-principles.md) |
| **SOLID Principles** (SRP, OCP, LSP, ISP, DIP) | Guide cohesion, extensibility, substitutability, and boundary decoupling. | Apply only when friction, churn, or 3+ concrete variations exist. Avoid 1:1 "interface-itis". | [solid-principles.md](./references/solid-principles.md) |
| **Design Patterns & Refactoring** (Bridge, Strategy, Composition over Inheritance, Guard Clauses) | Resolve subclass explosion, dynamic rule dispatch, and nested logic safely. | Prefer composition by default. Use Strategy/Bridge only when 3+ variations or multi-axis churn exists. | [design-patterns.md](./references/design-patterns.md) |
| **State Machines** (FSM / Discriminated Unions) | Formalise multi-step lifecycles and eliminate illegal state transitions. | Use when managing 3+ dependent states or transition rules; avoid for binary toggles. Specific FSM libraries warrant separate skills. | [architectural-patterns.md](./references/architectural-patterns.md) |
| **Event Bus / Pub-Sub** (Domain Events) | Decouple producers from multiple independent side-effect listeners. | Use for 1-to-many async side effects. If only 1 consumer exists, call the function directly. Full event broker setup warrants separate skills. | [architectural-patterns.md](./references/architectural-patterns.md) |
| **Boundaries & Gateways** (Adapters) | Isolate external vendor SDKs and database clients from domain rules. | Keep wrappers thin; do not wrap stable standard library utilities. | [architectural-patterns.md](./references/architectural-patterns.md) |

---

# Security Hygiene & Defensive Coding

- **Strictly Forbid Hardcoded Secrets**: Never commit API keys, tokens, credentials, or private keys in code or configuration files. Load sensitive values exclusively from secure environment variables or secret management services.
- **Validate & Sanitise at Public Boundaries**: Enforce strict schema validation and sanitisation on all untrusted external input (HTTP parameters, request bodies, webhooks, file uploads, IPC messages) before processing.
- **Restrict Unsafe Dependency Additions**: Do not introduce third-party libraries when standard library or existing project utilities suffice. Vet all required new dependencies for maintenance, licensing, and security vulnerabilities before adding.

---

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
- Cross-skill references (e.g. systematic-debugging, documentation-writer, test-driven-development).

---

# Anti-Patterns & Actionable Fixes

| ❌ Anti-Pattern | ⚠️ Consequence | ✅ Actionable Fix |
|---|---|---|
| **Obvious / Narrative Comments** | Code clutter, outdated comments, tutorial noise | Delete line-by-line comments; let clean naming and structure self-document. |
| **"First we import..." Prose** | AI conversational cruft in codebases | Write the code directly without conversational narration. |
| **Helper for One-Liner** | Fragmentation, unnecessary abstraction | Inline trivial one-liners directly at the call site. |
| **Factory for Direct Instantiation** | Pointless boilerplate for simple objects | Use direct constructor/object creation (`new Foo()`). |
| **`utils.ts` Junk Drawer** | Unfocused catch-all files, hidden dependencies | Colocate single-use helpers where consumed; group pure helpers by domain. |
| **Deep Nesting (>2 levels)** | Arrow code, high cognitive load, hard to debug | Use guard clauses and early returns to keep main path flat. |
| **Magic Numbers & Literals** | Unclear meaning, fragile updates across files | Extract to descriptive named constants (`MAX_RETRY_COUNT`). |
| **God Functions (>30–50 lines)** | High cognitive load, tight coupling, fragile edits | Split into small functions each doing one thing at one abstraction level. |
| **Silent Interface Breaks / Partial Edits** | Runtime errors, broken imports across consumers | Identify all callers and update consumers in the same task. |
| **Speculative Flexibility / Wrappers** | Unnecessary indirection, dead code paths | Delete speculative abstractions; git preserves history. |
| **Hand-Rolled Stdlib / Platform Logic** | Bloat, maintenance burden, unhandled edge cases | Replace with standard library utilities or native platform APIs. |
| **Undocumented Shortcuts (Rotting Debt)** | Silent system failures under load | Add `shortcut:` comment naming ceiling limit and upgrade trigger. |
| **Untested New Code** | Undetected bugs, silent regressions | Write automated unit/regression tests for every new feature and fix. |
| **Hardcoded Secrets** | Credential leaks, severe security breaches | Extract to environment variables or secret management vaults. |
| **Unvalidated Boundary Data** | Injection attacks, data corruption | Validate and sanitise all incoming data against explicit schemas. |
| **Unvetted Dependency Additions** | Supply chain vulnerabilities, bloat | Use existing utilities or standard library; vet packages before adding. |
| **Over-Abstraction (>3–4 Layers)** | Indirection mazes, high cognitive friction | Limit abstraction depth to around 3–4 layers; collapse pass-through wrappers. |
| **Dogmatic SOLID / Interface-itis** | Indirection mazes, single-implementation boilerplate | Write concrete code first; extract interfaces only for multiple implementations or I/O boundaries. |
| **Boolean Flag Soup** | Fragile states, illegal state combinations | Model states explicitly with State Machines or discriminated union types. |
| **Premature Decoupling / Event Sprawl** | Hard-to-trace action-at-a-distance for simple flows | Use direct function calls for 1-to-1 flows; reserve event buses for 1-to-many async side effects. |
| **Reinventing Utilities** | Redundant code, fragmented bug fixes | Check existing helpers first; reuse before creating new. |
| **Mixed Logic & Side Effects** | Hard to test, fragile state transitions | Separate pure decision logic from I/O and database operations. |
| **Leaky External Boundaries** | Upstream API changes break core domain | Map external payloads into internal domain models at the boundary. |
| **Unfocused PRs / Edits** | Review fatigue, difficult rollbacks | Restrict changes to a single, coherent objective. |

---

# Failure & Clarification Protocol

- **Errors & Regressions**: Identify root cause via logs, compiler diagnostics, and tests before editing. Never apply superficial patches without diagnosing cause.
- **Structured Errors**: Emit actionable error messages paired with machine-readable error codes to aid debugging and telemetry.
- **Ambiguous Requirements**: If instructions lack essential parameters or conflict, halt and ask targeted clarification with concrete options.
- **Technical Blockers**: If requested changes violate architecture safety or are infeasible, explain the constraint and suggest alternatives.
- **Lint & Test Failures**: When linters or automated test suites fail, parse output to locate exact file and line, diagnose the underlying fault, and resolve completely before completing the task.

---

# Mandatory Verification & Quality Checklist

## 🔴 Mandatory 5-Point Self-Check Gate
Before marking any task as complete, you MUST pass this 5-point verification:

| Gate | Check Question | Pass Condition |
|---|---|---|
| 1. **Goal Met?** | Did I deliver exactly what was requested without missing requirements? | User intent fully satisfied. |
| 2. **Blast Radius Complete?** | Did I update all dependent callers, imports, and consumer files? | Zero orphaned callers or broken imports. |
| 3. **Code Tested?** | Did I run automated tests or execute code to verify behavior? | Automated verification passes cleanly. |
| 4. **Zero Diagnostics?** | Did project linters and type checkers run with zero errors? | Clean compilation, lint, and types. |
| 5. **Clean Code & Security?** | Are names clear, functions small, comments purposeful, and boundaries secure? | No secrets, no magic numbers, no clutter. |

> 🔴 **Rule:** If ANY of the 5 checks fails, fix the issue immediately before completing.

## Full Quality Verification Checklist
- [ ] Code is simple, clear, and easy to understand, maintain, and modify.
- [ ] Pre-Edit Blast Radius evaluated: callers, imports, and dependent modules updated together.
- [ ] Complexity is necessary and justified; simpler alternatives evaluated and chosen.
- [ ] Simplicity Ladder rungs evaluated: dropped unneeded features, leveraged stdlib/platform/existing deps before custom code.
- [ ] YAGNI adhered to: no speculative code, premature abstractions, or single-implementation interfaces.
- [ ] Deliberate simplifications marked with `shortcut:` / `ponytail:` comments detailing ceiling and upgrade path.
- [ ] Non-negotiables strictly honored: boundary input validation, security, error handling, accessibility, and hardware calibration.
- [ ] Clean Code naming conventions applied: intent-revealing variables, verb+noun functions, predicate booleans, SCREAMING_SNAKE constants.
- [ ] Functions kept small (ideally 5–10 lines, max ~20–30), single responsibility, single level of abstraction (SLAP), and few arguments (≤3).
- [ ] Code is self-documenting; no redundant line-by-line comments, tutorials, or conversational filler.
- [ ] Guard clauses used for early returns; nesting kept flat (≤2 levels).
- [ ] Related code colocated; no single-caller `utils.ts` junk drawers.
- [ ] SOLID principles applied selectively where variation or testing boundaries demand it, avoiding dogmatic over-engineering.
- [ ] State transitions modeled explicitly (state machine, enum, discriminated union) rather than boolean flag soup.
- [ ] Decoupling mechanisms (event bus, gateways) justified by real multi-consumer needs or system boundaries.
- [ ] New unit, integration, or regression tests written and passing for all modified logic (smallest runnable check).
- [ ] Diff reviewed with 5 cut tags (`delete:`, `stdlib:`, `native:`, `yagni:`, `shrink:`) aiming for net negative lines.
- [ ] Zero hardcoded secrets, credentials, or API tokens in the codebase.
- [ ] Untrusted inputs validated and sanitised at public boundaries.
- [ ] No unvetted, redundant, or unnecessary dependencies added.
- [ ] Change is focused on a single, clear purpose.
- [ ] External systems kept behind boundaries with data converted to internal formats.
- [ ] Invalid states are difficult or impossible to represent in data types.
- [ ] Business logic (decisions) decoupled from side effects (actions).
- [ ] Error messages and codes are informative and machine-readable.
- [ ] Follows industry standards and repository style conventions.
- [ ] Linters, type checks, and automated test suites pass cleanly without regressions.
