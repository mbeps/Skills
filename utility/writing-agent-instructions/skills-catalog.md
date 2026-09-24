# Skills Catalog for Agent Files

Agent files must list all skills required to develop and maintain the codebase. This reference defines which skills to include universally in `AGENTS.md`, which to include conditionally by stack, which belong in modular `.agents/*.md` files, and which to strictly exclude.

---

## 1. Core Universal Skills (Always Included in `AGENTS.md`)

Every project agent file MUST include these universal skills, formatted with standard instruction markers:

```markdown
# Skills
List of skills that are required to work on this project:
- clean-code: MUST be used when writing code
- karpathy-guidelines: MUST be used for all coding related tasks
- writing-code: MUST be used when writing code
- documentation-writer: MUST be used when writing code or code documentation
- brainstorming: MUST be used when generating ideas or solutions
- dispatching-parallel-agents: MUST be used when managing multiple agents
- subagent-driven-development: MUST be used when developing subagents
- systematic-debugging: MUST be used when debugging code
- test-driven-development: MUST be used when writing tests
- using-superpowers: SHOULD be used all the time
- verification-before-completion: MUST be used when verifying code before completion
- writing-plans: MUST be used when creating plans
- bug-fix: MUST be used when fixing bugs
- caveman: MUST be used all the time when thinking or monologuing
- evaluation: MUST be used when evaluating
- graphify: MUST be used when generating and updating codebase index/graph relationships and report
- ponytail: MUST be used when writing code
- using-checklists: MUST be used to organize tasks 
- tdd: MUST be used when practicing test-driven development
```

---

## 2. Conditional Stack-Specific Skills

Include skills below only when the corresponding language, framework, database, or architecture is present in the repository:

### TypeScript & JavaScript
- `mastering-typescript`: MUST be used when writing TypeScript code
- `typescript-environment-variables`: MUST be used when managing environment variables in TypeScript

### Frontend & UI Design (List in `.agents/design.md` rather than `AGENTS.md`)
- `ui-ux-pro-max`: MUST be used when creating components, pages, styling, or UI/UX related tasks
- `ui-component-decomposition`: MUST be used when auditing or identifying UI component extraction candidates
- `radix-ui-to-base-ui-migration`: MUST be used when migrating UI components to Base UI
- `ui-design-language`: MUST be used when standardizing component density, iconography, and navigation patterns
- `structuring-nextjs-projects`: MUST be used when creating files, organizing code, or structuring Next.js projects (place in `.agents/conventions.md`)
- `centralised-routes`: MUST be used when designing or refactoring Next.js route definitions and typed URLs (place in `.agents/conventions.md`)

### Databases & Schemas
- `database-normalisation-theory`: MUST be used when designing and modifying relational database schemas
- `drizzle-nextjs`: MUST be used when building, modifying, or debugging Drizzle ORM
- `prisma-nextjs`: MUST be used when building, modifying, or debugging Prisma ORM
- `supabase-nextjs`: MUST be used when building, modifying, or debugging Supabase backend or schemas

### Authentication & Permissions
- `better-auth-nextjs`: MUST be used when building or modifying Better Auth authentication
- `clerk-nextjs`: MUST be used when building or modifying Clerk authentication
- `access-control`: MUST be used when designing or implementing authorization, permissions, RBAC, or ABAC
- `spring-boot-oauth`: MUST be used when configuring Spring Boot OAuth2 architectures

### Background Jobs & Workflows
- `inngest-nextjs`: MUST be used when building background jobs, durable functions, or event workflows

### Logging & Observability
- `logtape-nextjs`: MUST be used when setting up or modifying structured logging with LogTape

### API & Communication
- `trpc-nextjs`: MUST be used when building, modifying, or debugging tRPC routers and procedures

### Python Ecosystem
- `pydantic-v2`: MUST be used when writing, reading, or refactoring Pydantic v2 code
- `pyright`: MUST be used when configuring or resolving Pyright/Pylance typing in Python
- `python-typing-ecosystem`: MUST be used when configuring Python type checking (mypy, Pyright, Pyrefly)
- `openpyxl`: MUST be used when manipulating Excel .xlsx files in Python

### Testing & Verification (List in `AGENTS.md` and `.agents/testing.md`)
- `writing-nextjs-vitest-tests`: MUST be used when writing Next.js Vitest unit and integration tests (mocking Next.js runtime, Drizzle/Prisma DB queries, server actions, auth sessions)
- `playwright-skill`: MUST be used when writing or running browser automation and end-to-end tests
- `tdd`: MUST be used when practicing test-driven development (red-green-refactor loop)
- `test-driven-development`: MUST be used when implementing any feature or bugfix, before writing implementation code
- `systematic-debugging`: MUST be used when diagnosing test failures or unexpected test runner errors
- `verification-before-completion`: MUST be used to verify all tests pass before completing tasks

### Code Review & Branching
- `receiving-code-review`: MUST be used when receiving code review feedback
- `requesting-code-review`: MUST be used when completing tasks or before merging
- `using-git-worktrees`: MUST be used when isolating feature work in git worktrees
- `finishing-a-development-branch`: MUST be used when completing implementation on a branch

---

## 3. Strict Exclusions (Prohibited Skills)

Never add one-time, setup, or meta authoring skills to an agent file. These clutter context and confuse task execution:

| Prohibited Skill                                                                                                             | Reason for Exclusion                                                |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `writing-skills`                                                                                                             | Meta skill for authoring skills; not for everyday repository tasks. |
| `refining-skills`                                                                                                            | Meta skill for tuning skills.                                       |
| `skill-repair`                                                                                                               | One-off troubleshooting for failed skill installations.             |
| `find-skills`                                                                                                                | Interactive user discovery tool.                                    |
| `writing-readmes`                                                                                                            | Specific to authoring repository README files.                      |
| `writing-agent-instructions`                                                                                                 | This authoring skill itself.                                        |
| `writing-conventions-instructions`                                                                                           | Merged into `writing-agent-instructions`.                           |
| `migrating-*` (e.g. `migrating-ai-sdk-v6-to-v7`, `migrating-eslint-prettier-to-biome`, `migrating-spring-boot-applications`) | One-time version migration guides.                                  |
| `generative_ui`                                                                                                              | Visual widget generator for chat UI.                                |
| `wiki-writer`                                                                                                                | Standalone wiki authoring tool.                                     |
