# YAGNI Principles & The Simplicity Ladder

Software development carries an inherent gravitational pull toward complexity. Every additional line of code, class, abstraction layer, and third-party dependency introduces maintenance overhead, potential attack surface, cognitive load, and testing burden.

**The Golden Rule:** The best code is the code never written. Simplicity means efficiency, not sloppiness. Never introduce speculative flexibility, unrequested abstractions, or premature optimisations. Build strictly what is needed today, designed to be easy to delete or replace tomorrow.

---

## The 6-Rung Simplicity Ladder

Before writing any code, stop at the first rung that holds:

```
[1. Does this need to be built at all?] ─────────► (Drop it / Question requirement)
                    │ No
                    ▼
[2. Does the standard library do this?] ─────────► (Use stdlib function)
                    │ No
                    ▼
[3. Does a native platform feature cover it?] ───► (Use runtime/platform API)
                    │ No
                    ▼
[4. Does an installed dependency solve it?] ─────► (Use existing dependency)
                    │ No
                    ▼
[5. Can this be a clear one-liner/expression?] ──► (Write concise expression)
                    │ No
                    ▼
[6. Write the minimum concrete code that works] ─► (Direct, boring, minimal code)
```

### 1. Does This Need to Be Built at All? (YAGNI)
- **Question the requirement:** Before implementing, ask: *"Do we actually need X, or does existing feature Y already satisfy the user's intent?"*
- **Reject speculative requirements:** Never code for hypothetical future requirements ("we might need multi-tenancy later", "what if we switch databases next year?"). Solve the concrete requirement at hand.
- **Deletion over addition:** The cleanest resolution to a bug or refactor is removing redundant code and dead paths rather than adding defensive branches.

### 2. Does the Standard Library Already Do This?
Modern standard libraries (Python, Node.js/JavaScript, Go, Java, Rust) have rich, highly optimized, memory-safe, and thoroughly tested utilities.
- **Use stdlib first:** URL parsing, date manipulation, crypto hashing, math rounding, path operations, collection filtering, and serialization.
- **Edge-case correctness:** If two standard library approaches take similar effort, choose the robust, edge-case-safe function. Simplicity means less code, not fragile algorithms.

```typescript
// ❌ Anti-pattern: Hand-rolling custom query string parser
function parseQuery(queryString: string): Record<string, string> {
  return queryString.replace(/^\?/, '').split('&').reduce((acc, pair) => {
    const [k, v] = pair.split('=');
    if (k) acc[decodeURIComponent(k)] = decodeURIComponent(v || '');
    return acc;
  }, {} as Record<string, string>);
}

// ✅ Idiomatic stdlib: 1 line, handles edge cases, zero custom code
const params = Object.fromEntries(new URLSearchParams(queryString));
```

### 3. Does a Native Platform Feature Cover It?
Before reaching for an external library or polyfill, check whether the runtime or browser platform natively supports the capability:
- **Web & Runtime APIs:** Fetch API, `Intl` for localization/formatting, `crypto.randomUUID()`, `structuredClone()`, CSS Grid/Flexbox instead of JS layout scripts, Web Streams, HTML5 validation primitives (`required`, `pattern`).
- **Operating System / POSIX:** Native file system permissions, shell pipes, process signals, and standard environment variables.

```typescript
// ❌ Anti-pattern: 70KB npm dependency just to deep-clone an object
import cloneDeep from 'lodash/cloneDeep';
const copy = cloneDeep(payload);

// ✅ Native platform API: Built-in, zero dependencies, faster
const copy = structuredClone(payload);
```

### 4. Does an Already-Installed Dependency Solve It?
- Inspect `package.json`, `pom.xml`, `requirements.txt`, or `Cargo.toml` before adding a new package.
- If an existing, vetted library provides a utility (e.g. utility helpers in an already imported framework or toolkit), use it rather than introducing a new dependency.
- **Zero-Dependency Bias:** Every new package brings security vulnerability risks, license compliance checks, and upgrade maintenance. Never add a dependency for a trivial function.

### 5. Can This Be One Line or a Focused Expression?
- Replace multi-line loops and temporary accumulator variables with clean, declarative collection methods (`map`, `filter`, `reduce`, list comprehensions, `zip`).
- Ensure the one-liner remains readable and expressive. If a one-liner becomes an unreadable regex or convoluted nesting, expand it to a readable 3-line function with clear names.

```python
# ❌ Anti-pattern: 7 lines of imperative accumulation
key_value_pairs = [("a", 1), ("b", 2), ("c", 3)]
result = {}
for k, v in key_value_pairs:
    if v > 1:
        result[k] = v

# ✅ Clear, idiomatic comprehension: 1 line
result = {k: v for k, v in key_value_pairs if v > 1}
```

### 6. Write the Minimum Concrete Code That Works
When custom implementation is required:
- Write direct, concrete code first.
- Keep logic in the fewest files possible. Do not split a 25-line cohesive piece of logic across three files.
- Colocate single-use logic right where it is consumed. Only extract shared helpers when three or more call sites require identical behavior (**Rule of Three**).

---

## The 5 Diff Review & Cut Tags

When reviewing code, refactoring PRs, or self-evaluating implementations, systematically scan for complexity using these five tags. A diff's best outcome is getting shorter.

| Tag       | Target                                                                                                                      | Actionable Replacement                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `delete:` | Dead code, speculative features, unrequested config toggles, commented-out blocks.                                          | **Replacement: Nothing.** Delete the code. Git preserves history.                 |
| `stdlib:` | Hand-rolled algorithms or utilities that the standard library already provides.                                             | Replace with standard library call (name the specific module/function).           |
| `native:` | Third-party dependency or polyfill doing what the platform/runtime already supports.                                        | Replace with native runtime API and drop the dependency.                          |
| `yagni:`  | Abstractions with only one implementation, factories with one product, wrappers that only delegate, layers with one caller. | Inline the abstraction, collapse the wrapper, and delete pass-through interfaces. |
| `shrink:` | Verbose, repetitive, or convoluted branching logic accomplishing a simple goal.                                             | Simplify into concise, readable idioms or guard clauses.                          |

### Review Finding Format & Scoring

Format findings concisely (one line per finding):
`L<line>: <tag> <what to cut>. <replacement>.`
Or for multi-file diffs: `<file>:L<line>: <tag> <what to cut>. <replacement>.`

**Scoring:** Conclude diff reviews with net line savings:
`net: -<N> lines, -<M> deps possible.`
If there is nothing to cut: `Lean already. Ship.`

### The Complexity Hunt: Repo-Wide Audit Targets

When conducting a simplicity audit across an entire codebase or module, systematically hunt for:
1. **Dependencies the stdlib or platform already ships:** Packages like `lodash.clonedeep`, `qs`, or `moment` in modern runtimes.
2. **Single-implementation interfaces & factories:** `IUserService` or `RepositoryFactory` when only one concrete class exists.
3. **Pass-through wrappers:** Classes or functions that merely forward arguments to another call without validation or transformation.
4. **Single-export micro-files:** Files containing a single 5-line helper that could be colocated with its only caller.
5. **Dead configuration & flags:** Unread environment variables, dead boolean switches, and unused abstraction hooks.
6. **Hand-rolled standard library logic:** Custom string padding, query parsing, array chunking, or date manipulation.

### Concrete Review Examples

#### `delete:` Speculative retry wrapper
```diff
- // ❌ Speculative: Retry wrapper around an in-memory, synchronous operation
- function callWithRetry<T>(fn: () => T, retries = 3): T {
-   let lastErr;
-   for (let i = 0; i < retries; i++) {
-     try { return fn(); } catch (err) { lastErr = err; }
-   }
-   throw lastErr;
- }
- const user = callWithRetry(() => parseUser(input));
+ const user = parseUser(input);
```

#### `yagni:` Single-implementation interface & factory
```diff
- // ❌ 1:1 Interface and Factory for a single concrete repository
- interface IUserRepository { findById(id: string): Promise<User>; }
- class UserRepository implements IUserRepository { ... }
- class UserRepositoryFactory { static create(): IUserRepository { return new UserRepository(); } }
- const repo = UserRepositoryFactory.create();

+ // ✅ Concrete, direct class (or plain functions)
+ class UserRepository {
+   async findById(id: string): Promise<User> { ... }
+ }
+ const repo = new UserRepository();
```

#### `stdlib:` Hand-rolled collection chunking
```diff
- // ❌ Hand-rolled chunking utility
- function chunk<T>(arr: T[], size: number): T[][] {
-   const res = [];
-   for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
-   return res;
- }

+ // ✅ Modern stdlib (Node 22+ / modern JS or language standard)
+ // e.g. Object.groupBy / chunk utilities or direct slice in caller
```

---

## Intentional Simplifications: Ceiling & Upgrade Path

Sometimes writing minimal code means choosing a deliberate shortcut or simpler heuristic over an elaborate architecture (e.g. an in-memory cache instead of Redis, an $O(N)$ linear scan instead of a B-Tree index, a single lock instead of fine-grained concurrency).

To prevent pragmatic shortcuts from silently rotting into permanent technical debt:
1. Mark deliberate shortcuts explicitly with a `shortcut:` or `ponytail:` comment.
2. The comment **must name the ceiling** (the condition or limit where this breaks) and the **upgrade path** (what to do when reached).

```typescript
// shortcut: In-memory Map cache. Ceiling: 5,000 items or multi-instance deployment.
// upgrade: Replace with Redis client or LRU cache when memory > 50MB or app scales to multiple replicas.
const sessionCache = new Map<string, SessionData>();
```

```python
# shortcut: O(N) linear scan over active connections. Ceiling: N > 200 concurrent sockets.
# upgrade: Switch to connection pool indexed by tenant_id when benchmarks exceed 5ms lookup.
def find_connection(client_id: str):
    return next((c for c in active_connections if c.id == client_id), None)
```

### Auditing Shortcut Debt

To inspect deliberate simplifications across the codebase and ensure none have silently rotted:
```bash
grep -rnE '(#|//) ?(shortcut|ponytail):' .
```

Format findings as a ledger:
`<file>:<line>, <what was simplified>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.`

**Rot Risk:** Any shortcut that omits an upgrade path or revisit trigger gets flagged as `no-trigger`—these are the ones that silently turn into permanent technical debt. If none found: `No shortcut debt. Clean ledger.`

---

## Non-Negotiables: What NEVER to Compromise

YAGNI is about cutting unnecessary complexity, **not cutting engineering rigor**. The following areas are strictly non-negotiable and must never be skipped under the guise of "simplicity":

1. **Input Validation at Public Boundaries:** Always validate untrusted inputs, schema constraints, and parameter bounds. Never skip sanitization.
2. **Security & Secrets:** Never hardcode credentials, bypass authorization, ignore CSRF/XSS vectors, or skip permission checks.
3. **Error Handling & Data Loss Prevention:** Always handle network timeouts, database errors, and transactions that prevent data corruption or partial writes.
4. **Accessibility (a11y):** Semantic HTML, keyboard accessibility, and screen reader labels are baseline requirements, not optional extras.
5. **Real-World Platform & Hardware Realities:** Real systems have clock drift, network latency, dropped packets, and sensor noise. Never assume the platform operates in a frictionless vacuum.
6. **Explicit User Requirements:** If the user or product specification explicitly asks for a capability, fulfill it. Question ambiguous or speculative requests, but respect confirmed requirements.

---

## Pragmatic Automated Testing: Minimal & High-Value

YAGNI applies directly to test suites:
- **Test real behavior, not implementation details:** Verify public inputs and observable outputs. Do not write assertions on private variables or internal call counts unless mocking an external I/O boundary.
- **The Smallest Runnable Verification:** For non-trivial business logic, write the smallest, fastest test that reliably fails if the logic breaks. Avoid massive mock graphs, heavy container orchestration, or complex fixture factories when a pure unit test with simple inputs suffices.
- **Zero Value Tests:** Do not write tests for trivial one-liners (e.g. getters, setters, standard library passes) or framework wiring that has no custom logic.

---

## YAGNI Rationalizations & Reality Checks

| Rationalization / Excuse                                            | Reality                                                                                                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| *"We might need to support multiple databases later."*              | You almost certainly won't. If you do, refactor then. Writing a bespoke ORM abstraction today wastes time and adds 400 lines of untested indirection.                        |
| *"It's cleaner to have an interface for every class."*              | A 1:1 interface with one implementation provides zero abstraction and doubles file count. Extract interfaces only when multiple implementations or testing boundaries exist. |
| *"Let's build a general-purpose plugin framework."*                 | Build the two features you actually have. General-purpose frameworks designed in a vacuum always get the abstraction wrong.                                                  |
| *"We should wrap this standard library method in our own utility."* | Wrapping `Math.max` or standard date formatters creates cognitive friction and hides well-documented platform idioms behind bespoke APIs.                                    |
| *"Adding this 100KB dependency is faster than writing 5 lines."*    | Dependencies introduce maintenance, security vulnerability alerts (CVEs), license liabilities, and breaking upgrades. Check stdlib first.                                    |

---

## Relationship Between `/writing-code` and `/ponytail`

- **/writing-code**: The core software engineering skill across languages—covers surgical planning, minimal implementation, pragmatic design patterns, architectural boundaries, security hygiene, and automated testing. It incorporates these fundamental YAGNI principles directly so you naturally build only what is needed today without requiring separate skill invocations.
- **/ponytail**: The dedicated specialist skill for running in "lazy senior developer" execution mode (Lite, Full, Ultra), invoking one-shot diff reviews (`/ponytail-review`), auditing repositories for complexity (`/ponytail-audit`), and tracking shortcut debt (`/ponytail-debt`). Use `/ponytail` when you want an aggressive, opinionated YAGNI review or persistent ultra-lean developer persona.

