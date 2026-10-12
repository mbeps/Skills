# Universal vs Stack-Specific Taxonomy

Agent instructions must remain generalisable across languages (TypeScript, Python, Java, Go, Rust) and project types (CLI, backend services, full-stack apps, libraries). Follow this division when generating files:

---

## 1. `.agents/development.md`
- **Universal (core)**:
  - Workflow skills to load (`writing-code`, `writing-plans`, `systematic-debugging`, `verification-before-completion`, `bug-fix`).
  - Operational rules: Simplicity, YAGNI, planning before implementing, Git safety (zero-commit/push rule for agents), purposeful documentation.
  - Verification gates: Concrete build, lint, typecheck, and test commands detected from repository configuration.
- **Stack / project-dependent (optional, only include when non-trivial and necessary)**:
  - Build & CI rules (headless builds, container-free CI, environment variable requirements during build, secret handling on pull requests).
  - Dependency and toolchain rules (lockfile synchronisation, compiler options, package manager rules).
  - Tooling gotchas (terminal diff wrapping, file encoding anomalies, runtime platform limitations). Keep lean—do not add irrelevant trivia or boilerplate.

---

## 2. `.agents/project-details.md`
- **Dense & architecture-focused**: Focus strictly on core invariants, subsystem contracts, and data lifecycles. **Do NOT bloat with trivia, tutorial prose, or full code dumps.**
- **Universal categories**:
  - Subsystem interactions & data flow: How primary modules communicate across boundaries and entity lifecycle pipelines.
  - State management & lifecycles: Distinctions between persistent state, client state, and transient in-flight state.
  - Concurrency, async execution & cancellation: Abort signal propagation, race condition prevention, deduplication, and idempotency.
  - Security & trust boundaries: Tenant isolation, authentication token scoping, SSRF guards, encrypted secrets, and permission boundaries.
- **Stack / project-dependent categories**:
  - Runtime & framework mechanics: Framework-specific runtime mechanics (streaming protocols, background job engines, ORM query building quirks, IPC bridges, native extensions).

---

## 3. `.agents/conventions.md`
- **Universal**:
  - Directory layout and module responsibilities.
  - File and symbol naming conventions.
  - Architectural boundaries and domain isolation.
  - Skill overrides.
- **Language-specific**:
  - Typing idioms (strict types, interfaces vs types, dataclasses, traits).
  - Export and import discipline (named exports, direct paths, barrel file policies).

---

## 4. `.agents/design.md`
- **Applicability**: Applicable **ONLY** when the project includes UI or frontend code. Omit entirely for backend services, APIs, CLI tools, daemon processes, and shared libraries.
- **Universal**: Component directory hierarchy, layout shell boundaries, viewport width controls.
- **Stack-specific**: Styling framework rules (Tailwind CSS, CSS modules, design tokens, theme variables), UI primitive libraries.

---

## 5. `.agents/testing.md`
- **Universal**:
  - Testing strategy (TDD, red-green-refactor loop).
  - Coverage thresholds & quality gates.
  - Testing skills.
- **Stack-specific**:
  - Runner setup & commands.
  - Mocking overrides & environment stubs.

---

## 6. `.agents/plan.md`
- **Universal**:
  - Planning standards (high-level first, concrete specs, edge cases).
  - Codebase simplification & anti-bloat.
  - Alternatives evaluated & justification.

