# Example: `.agents/development.md`

Below is a canonical example of `.agents/development.md` for a full-stack Next.js web application:

```markdown
---
description: Load before implementing features, fixing bugs, refactoring code, or executing development workflows in the Next.js AI chat client.
applyTo: '**/*'
---

# Development Instructions & Operational Guidelines
Guidlines and instructions in this file MUST be followed.

## 1. Skills
Follow these skills as the single source of truth for development workflows:
- `writing-code` — Pragmatic clean coding standards, design patterns, simplicity, and maintainability.
- `writing-plans` — Structured planning for non-trivial changes before implementation.
- `bug-fix` & `systematic-debugging` — Diagnosing root causes systematically before proposing fixes.
- `verification-before-completion` — Verifying builds, linting, and tests pass before completion.
- `writing-code-documentation` — Writing code docs.

## 2. Non-Negotiable Operational Rules
- **Simplicity & YAGNI**: Code must not be unnecessarily overcomplicated. It must be simple to understand, modify, and maintain. Strictly follow YAGNI principles.
- **Plan Before Implementing**: Always plan before implementing unless the change is completely trivial.
- **Document Codebase & Changes**: Document code purposefully, explaining WHY rather than WHAT. Use `writing-code-documentation` skill.
- **Enforce Quality Gates**: Code must pass building (`npm run build`), linting/formatting checks (`npm run lint`), type checks, and testing before completion.
- **Manual Audit**: Evaluate quality, accuracy, completeness, consistency of implementation against codebase guidelines and requirements. Make necessary adjustments if any.
- **Git & Version Control Safety**: You must NEVER commit, stage, push, or stash with Git. The developer is in charge of managing version control (Git and GitHub). You may only execute read-only Git commands that have no side effects (e.g. `status`, `log`, `diff`).
- **Local Development Runtime**: You must use Podman to run Docker containers (Postgres, MinIO, etc.) for local development. Do NOT use Docker.
- **Updated README:** Update README.md if necessary.
- **Design**: User is always in charge of design decisions.
- **TDD**: Follow a TDD-like approach where you write tests first and then implementation, making sure all tests pass and coverage thresholds are met. See `./testing.md`.
- **Long-Term Maintainability**: Always take into account long-term maintainability — do not take shortcuts that are easiest now if they create future bloat or maintenance problems.
- **No Regressions**: There must not be any regressions, subtle bugs, or undesirable behaviour introduced.

## 3. Verification
Codebase must pass verifications below:
- `npm run lint` - Use `lint:fix` if there are errors and fix any that are not fixed automatically.
- `npm run build`
- `npm run test:coverage` - Tests must pass and coverage threashold must be met.
```

