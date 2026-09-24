# SOLID Principles: Pragmatic Application & YAGNI Balance

The SOLID principles provide established guidelines for writing flexible, maintainable, and understandable software. However, **SOLID is not a dogma**. When applied blindly without discipline, SOLID can lead to over-engineering, runaway abstraction, "interface-itis", and severe cognitive overhead.

**The Golden Rule:** Use **YAGNI (You Aren't Gonna Need It)** as the governing control. Always start with the simplest concrete implementation that solves the current problem. Refactor toward SOLID principles when friction, churn, or concrete requirements demand it—never on speculative future needs.

---

## The SOLID Principles at a Glance

| Principle | Core Concept          | Practical Meaning                                      | YAGNI Failure Mode to Avoid                                               |
| --------- | --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| **S**RP   | Single Responsibility | A module has one reason to change (one actor/domain).  | Fragmenting 20 lines of cohesive code across 5 micro-classes.             |
| **O**CP   | Open/Closed           | Open for extension, closed for modification.           | Designing elaborate plugin architectures for code that never changes.     |
| **L**SP   | Liskov Substitution   | Subtypes must honor base type contracts.               | Deep inheritance trees where subclasses throw "NotSupportedException".    |
| **I**SP   | Interface Segregation | Clients should not depend on methods they don't use.   | Creating monolithic, 30-method interfaces that require empty dummy stubs. |
| **D**IP   | Dependency Inversion  | High-level logic depends on abstractions, not details. | Creating `IFooService` with only one implementation across private code.  |

---

## Detailed Principles & Pragmatic Application

### 1. Single Responsibility Principle (SRP)

> *"A class or module should have one, and only one, reason to change."* — Robert C. Martin

- **What it solves:** High coupling where unrelated concerns are tangled together, causing changes in one feature (e.g. report formatting) to break another (e.g. billing calculations).
- **Pragmatic Application:**
  - Group functions and data that change for the same business reason and at the same cadence.
  - Separate pure business decisions from I/O, persistence, presentation, and external APIs.
  - Split large files or classes when multiple developers frequently cause merge conflicts in the same file for different business features.
- **YAGNI Check:**
  - Do not split a cohesive 30-line function into three files just because it parses input, calculates a value, and returns a response. Cohesion within a single responsibility matters more than arbitrary line counts.
  - Only extract when the responsibilities actually pull in different directions or need separate testing.

---

### 2. Open/Closed Principle (OCP)

> *"Software entities should be open for extension, but closed for modification."*

- **What it solves:** Having to modify existing, tested code and multi-branch switch statements every time a new variation or format is introduced.
- **Pragmatic Application:**
  - Use strategy patterns, configuration dictionaries, or polymorphic dispatch when you know a system needs frequent, varied behaviours (e.g., multiple payment gateways, export formats, notification channels).
  - Encapsulate volatile logic behind stable interfaces or function signatures.
- **YAGNI Check:**
  - **Rule of Three:** Write concrete code for the first instance. If a second instance appears, evaluate commonality. Only introduce an extensible abstraction when you have at least three concrete cases or an explicit architectural requirement.
  - Do not create abstract factories or dynamic registries for code with only one known variation.

---

### 3. Liskov Substitution Principle (LSP)

> *"Subtypes must be substitutable for their base types without altering system correctness."*

- **What it solves:** Calling code having to check `if (animal instanceof Bird && !(animal instanceof Penguin))` or catching unexpected exceptions because a subclass violated the contract of the parent class.
- **Pragmatic Application:**
  - If a subtype cannot fulfill all methods or invariants of a base type, **do not inherit from it**.
  - Favor **Composition over Inheritance**: compose shared behaviours via helper functions, traits, or components rather than deep class hierarchies.
  - Ensure that preconditions are not strengthened (subclass shouldn't require more) and postconditions are not weakened (subclass shouldn't deliver less) than the base contract.
- **YAGNI Check:**
  - Avoid inheritance hierarchies altogether when plain functions, composition, or discriminated unions solve the problem cleanly.

---

### 4. Interface Segregation Principle (ISP)

> *"Clients should not be forced to depend upon interfaces that they do not use."*

- **What it solves:** Fat interfaces that force callers to know about methods they don't care about, or force implementers to write empty dummy stubs (`throw new NotImplementedError()`).
- **Pragmatic Application:**
  - Define interfaces from the client's perspective (role interfaces), not the provider's perspective.
  - Prefer small, focused interfaces (e.g. Go's `io.Reader`, `io.Writer`, or TypeScript structural contracts with only the fields needed).
  - If a service implements multiple roles (e.g. read operations and admin maintenance), expose separate interfaces to different callers.
- **YAGNI Check:**
  - In dynamically typed or structurally typed languages (Python, TypeScript), avoid creating formal interface definitions unless consumers genuinely require multiple implementations or you are establishing a package boundary.

---

### 5. Dependency Inversion Principle (DIP)

> *"High-level modules should not depend upon low-level modules. Both should depend upon abstractions. Abstractions should not depend upon details. Details should depend upon abstractions."*

- **What it solves:** Core business domain logic being tightly coupled to a specific database (e.g. Postgres SQL syntax), a specific framework (e.g. Express req/res), or external vendor SDKs (e.g. Stripe, AWS S3).
- **Pragmatic Application:**
  - Place external integrations behind domain boundaries (repositories, gateways, adapters).
  - Pass dependencies into constructors or functions (dependency injection) rather than instantiating singletons or globals directly inside business logic.
  - This allows isolated unit testing by injecting in-memory stubs or fakes without network I/O.
- **YAGNI Check:**
  - **Avoid "Interface-itis":** Do not create an `IUserService` for every `UserService` if there is only ever one implementation and no boundary crossing.
  - Direct calls to internal, stable helper functions or utility libraries (like date-fns or lodash) do not need dependency inversion. Invert at the boundaries of your system (I/O, database, network, clocks), not between every internal class.

---

## When to Apply SOLID vs When to Keep It Simple

```
                   Does the code cross an I/O boundary,
                   have 3+ concrete variations,
                   or cause testing friction?
                              |
               +--------------+--------------+
               |                             |
              YES                            NO
               |                             |
      Apply relevant SOLID             Keep it concrete & direct.
      principle surgically.            Follow YAGNI strictly.
      (DIP at boundaries,              No interfaces for singletons.
       SRP on churn,                   No speculative strategies.
       OCP on 3+ variants)             Inline until reuse proven.
```

### Symptoms of Dogmatic Over-Engineering (Anti-Patterns)
1. **1:1 Interface Proliferation:** Every single class has an accompanying `IClassName` interface with exactly one implementation.
2. **Indirection Mazes:** Following the execution flow requires jumping through four layers of wrappers, facades, and abstract handlers to find a single database query.
3. **Speculative Extensibility:** Classes configured with generic type parameters, strategies, and hooks that have never had more than one concrete option in years of production.
4. **Cognitive Overhead:** Simple CRUD operations requiring 6 files (`Controller`, `Service`, `IService`, `Repository`, `IRepository`, `EntityDTO`).

### Pragmatic Checklist: Should I Refactor to SOLID?
- [ ] Is there **real pain** (merge conflicts, brittle tests, regressions) caused by current coupling?
- [ ] Are there **at least two or three real implementations**, not hypothetical ones?
- [ ] Does this abstraction make testing **measurably simpler**, or does it just add boilerplate?
- [ ] Can a new engineer understand the execution path without reading five interface declarations?
