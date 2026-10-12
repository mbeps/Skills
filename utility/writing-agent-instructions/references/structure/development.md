# Specification: `.agents/development.md`

Captures dev lifecycle principles, operational rules, workflow skills, and verification commands. **This file is purely process-focused; system architecture mechanics belong in `project-details.md`.**

Keep this file lean and focused purely on the development process. The clean core template contains Skills, Non-Negotiable Operational Rules, and Verification. Optional sections (Build & CI Rules, Dependency & Toolchain Rules, Tooling Gotchas) are added only when the project has non-trivial constraints. Do not add generic boilerplate or irrelevant trivia.

---

## File Template

```markdown
---
description: Load before implementing features, fixing bugs, refactoring code, or executing development workflows.
applyTo: '**/*'
---

# Development Instructions & Operational Guidelines

## 1. Skills
Follow these skills as the single source of truth for development workflows:
- `writing-code` — Pragmatic clean coding standards, design patterns, simplicity, and maintainability.
- `writing-plans` — Structured planning for non-trivial changes before implementation.
- `bug-fix` & `systematic-debugging` — Diagnosing root causes systematically before proposing fixes.
- `verification-before-completion` — Verifying builds, linting, and tests pass before completion.

## 2. Non-Negotiable Operational Rules
- **Simplicity & YAGNI**: Code must not be unnecessarily overcomplicated. It must be simple to understand, modify, and maintain. Strictly follow YAGNI principles.
- **Plan Before Implementing**: Always plan before implementing unless the change is completely trivial.
- **Document Codebase & Changes**: Document code purposefully, explaining WHY rather than WHAT.
- **Enforce Quality Gates**: Code must pass build, lint, typecheck, and test commands before completion.
- **Manual Audit**: Evaluate quality, accuracy, completeness, consistency of implementation against codebase guidelines and requirements. Make necessary adjustments if any.
- **Git & Version Control Safety**: Agents must NEVER commit, stage, push, or stash with Git. The developer manages version control. Only read-only Git commands (`status`, `log`, `diff`) are permitted.

## 3. Verification
Codebase must pass verifications below:
- `<detected-build-command>` - Use `lint:fix` if there are errors and fix any that are not fixed automatically.
- `<detected-lint-command>`
- `<detected-test-command>` - Tests must pass and coverage threshold must be met.

<!-- Optional sections below: include ONLY when the project has non-trivial constraints -->
<!--
## 4. Build & CI Rules
- Project-specific build and CI requirements (e.g. headless builds, container-free CI, environment variable requirements during build).

## 5. Dependency & Toolchain Rules
- Toolchain, package manager, and lockfile synchronisation rules.

## 6. Tooling Gotchas
- Concrete runtime, IDE, or terminal gotchas detected in the project.
-->
```

**Verification Section (Required)**: Every generated `development.md` MUST contain a `## Verification` section listing the concrete commands an agent runs to verify the project — build, lint/format, type check, and test. **Detect the commands from the repository** (`package.json` `scripts`, `Makefile`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.) and write the exact commands the project uses. Each project has its own package manager or task runner (`npm`, `pnpm`, `yarn`, `bun`, `make`, `uv`, `cargo`, etc.) — never assume `npm`. If the project has no test or lint command, state that explicitly instead of inventing one.
