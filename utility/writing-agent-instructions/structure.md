# Structure and Section Specifications

Agent instruction files follow a strict contract. The agent ecosystem uses a tiered structure:
- **`AGENTS.md`**: The root orchestrator and entry point.
- **`.agents/*.md`**: Modular, on-demand domain rulebooks (`development.md`, `project-details.md`, `conventions.md`, `testing.md`, `design.md`, `plan.md`, `learnings.md`).

---

## Target Files & Directory Layout

### 1. Root File: `AGENTS.md`
- Strictly located at the project root: `AGENTS.md`.
- Acts as the primary entry point loaded into the agent's context across sessions.
- Contains the project overview, baseline operational instructions, categorised tech stack links, resources index, and skills catalog.

### 2. The `.agents/` Folder
All modular agent files and guidelines live inside `.agents/`:
- `development.md`: Process-focused: dev lifecycle, operational rules, workflow skills, verification commands.
- `project-details.md`: System mechanics, architectural decisions, subsystem data flows, state lifecycles, concurrency/cancellation, security boundaries, runtime mechanics.
- `conventions.md` (or `convensions.md`): Directory structure, naming conventions, architectural boundaries, language idioms, and skill overrides.
- `testing.md`: Testing strategy, mock setup, coverage rules, and testing skills.
- `design.md`: UI architecture, component hierarchy, page container rules, styling, and design skills (frontend projects only; omitted for headless, backend, CLI, or library projects).
- `plan.md`: Planning instructions, architectural standards, alternative approaches, anti-bloat guidelines, and planning skills.
- `learnings.md`: Historical discoveries, pitfalls, and session takeaways.
Centralising these in `.agents/` keeps the root clean and prevents context bloat by allowing agents to load detailed rules only when triggered by relevant tasks.

### 3. Path Relativity
All path references resolve from the repository root using standard markdown relative paths (`./...`):
- `./README.md`
- `./graphify-out/`
- `./.agents/development.md`
- `./.agents/project-details.md`
- `./.agents/convensions.md` (or `conventions.md`)
- `./.agents/testing.md`
- `./.agents/design.md`
- `./.agents/plan.md`
- `./.agents/learnings.md`
- `./wiki/`

> [!WARNING]
> **NEVER use `#file:` in paths.** Use plain relative paths such as `./README.md` or `./.agents/convensions.md`.

---

## The Contract for `AGENTS.md`

`AGENTS.md` files must contain the following sections in order:

### 1. `# Project Overview`
- **Length**: Exactly 1 to 2 sentences.
- **Tone**: Concise, direct, and straight to the point.
- **Content**: What the application is and its primary function.
- **STRICT PROHIBITION**: Do NOT mention tech stack, frameworks, libraries, runtime versions, or deployment platforms in this section. Stack information belongs exclusively in `# Tech Stack`.
- **Example**:
  ```markdown
  # Project Overview
  A full stack AI chat client app similar to ChatGPT, Gemini, Claude, etc.
  App has text streaming, internal tools, MCP over HTTP, RAG, etc.
  The client supports any OpenAI compatible API provider (OpenRouter, Ollama, Groq, Azure, DeepSeek, etc.).

  **Test Credentials:** Email: `test@example.com` | Password: `Hello123`
  ```

### 2. `# Instructions`
- Streamlined baseline instructions governing agent navigation and autonomy.
- **Baseline Instructions**:
  ```markdown
  # Instructions
  - Use ./graphify-out/ to find navigate codebase. Graphify is like an index.
  - Whenever using subagents, read the *subagent-driven-development* and *dispatching-parallel-agents* skills first using the main agent right at the start of process to orchestrate the subagents correctly and efficiently. 
  - Do not ask irrelevant questions such as asking permission to start analysing, researching.
  - Update ./.agents/learnings.md with new info that are relevant to the project such as mistakes, common pitfalls, info that is not obvious, etc.
  ```
- If the user provides additional repository-level instructions, append them as bullets to the end of this list.

### 3. `# Tech Stack`
- Lists primary technologies used in the project, divided into logical H2 categories:
  - `## Frontend`
  - `## Backend`
  - `## Database`
  - Additional subsections (e.g. `## Storage`, `## AI`, `## Other`) as appropriate.
- **Format**: `- [Technology Name](Official Documentation URL)`
- **Rule**: Every technology listed MUST have a hyperlink to its official documentation.
- **Example**:
  ```markdown
  # Tech Stack
  ## Frontend
  - [Next.js 16](https://nextjs.org/docs)
  - [React.js 19](https://react.dev/blog/2024/12/05/react-19)
  - [Shadcn UI](https://ui.shadcn.com/docs/installation) 
  - [Tailwind CSS 4](https://tailwindcss.com/docs/installation/using-vite)

  ## Backend
  - [Next.js API Routes (App Router)](https://nextjs.org/docs)
  - [Better Auth](https://better-auth.com/docs/installation) 

  ## Database
  - [PostgreSQL 17](https://www.postgresql.org/docs/17/index.html) with [pgvector](https://github.com/pgvector/pgvector) (2048-dim)
  - [Drizzle ORM 0.45.2](https://orm.drizzle.team/docs/overview)
  ```

### 4. `# Resources`
- Centralises pointers to repository documentation, indexing assets, and `.agents/` modular rulebooks.
- Annotate each resource with clear triggers indicating when an agent should read it.
- **Standard Entries**:
  ```markdown
  # Resources
  - README ./README.md - Includes features, setup, etc. 
  - Coding Convensions ./.agents/convensions.md - MUST be followed when writing code
  - Development Instructions ./.agents/development.md - MUST be followed when developing, writing code, or running verification commands. Governs development process and operational rules.
  - Project Details ./.agents/project-details.md - MUST be followed when working across subsystems, understanding architecture, or inspecting system mechanics.
  - Testing Conventions ./.agents/testing.md - MUST be followed when writing, running, or mocking tests
  - Design Conventions ./.agents/design.md - MUST be followed when creating or modifying UI components or styling (omit for headless/backend/CLI/library projects)
  - Planning Instructions ./.agents/plan.md - MUST be followed when creating or reviewing implementation plans
  - Graphify ./graphify-out/ - Includes report, graph relationships, etc. Must be loaded at the beginning.
    - Graph Report ./graphify-out/GRAPH_REPORT.md
    - Graph JSON ./graphify-out/graph.json
  - Learnings ./.agents/learnings.md - Includes info that the agent has learnt while working on this project. Read this file to avoid wasting time and tokens re-discovering information
  - Wiki ./wiki/ - Wiki with detailed information about the project, architecture, and design
  ```
- **STRICT PROHIBITION**: NEVER list package manager or configuration files (such as `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `pyproject.toml`, `tsconfig.json`).

### 5. `# Skills`
- Lists skills required when working on the project.
- **Structure**:
  - Begins with standard preamble: `List of skills that are required to work on this project:`
  - Lists skills in bullet format: `- <skill-name>: MUST be used when <trigger/condition>`
  - Must include **universal core skills** and **project-specific stack skills** (see `skills-catalog.md`).
- **STRICT PROHIBITION**: NEVER include one-time or meta authoring skills (`writing-skills`, `refining-skills`, `skill-repair`, `migrating-*`, `find-skills`).

### 6. `# Additional Tools (and MCPs)`
- Documents non-obvious tools and MCP servers available in the environment:
  ```markdown
  # Additional Tools (and MCPs) 
  - headroom: MUST be used for retrieving content
  - Context7 - MUST be used for finding relevant documentation about tools, libraries, and frameworks
  - DBCode - Managing database
  - Web - MUST be used for searching the web for relevant information
  ```

### 7. `# Graphify`
- **Fixed Content**: Standard instructions for graphify navigation:
  ```markdown
  ## Graphify

  For any question about this repo's architecture, structure, components, or how to add/modify/find
  code, your first action should be `graphify query "<question>"` when `graphify-out/graph.json`
  exists. Use `graphify path "<A>" "<B>"` for relationship questions and `graphify explain "<concept>"`
  for focused-concept questions. These return a scoped subgraph, usually much smaller than the full
  report or raw grep output.

  Triggers: "how do I…", "where is…", "what does … do", "add/modify a <component>",
  "explain the architecture", or anything that depends on how files or classes relate.

  If `graphify-out/wiki/index.md` exists, use it for broad navigation. Read `graphify-out/GRAPH_REPORT.md`
  only for broad architecture review or when query/path/explain do not surface enough context. Only read
  source files when (a) modifying/debugging specific code, (b) the graph lacks the needed detail, or
  (c) the graph is missing or stale.

  Type `/graphify` in Copilot Chat to build or update the graph.
  ```

### 8. `# Learnings`
- Conditional: Present when `.agents/learnings.md` exists. Pointers on avoiding repeating mistakes and recording discoveries.

### 9. `# Extras`
- Conditional: Present ONLY if the user explicitly provided additional custom content.

---

## Universal vs Stack-Specific Taxonomy

Agent instructions must remain generalisable across languages (TypeScript, Python, Java, Go, Rust) and project types (CLI, backend services, full-stack apps, libraries). Follow this division when generating files:

### 1. `.agents/development.md`
- **Universal (core)**:
  - Workflow skills to load (`writing-code`, `writing-plans`, `systematic-debugging`, `verification-before-completion`, `bug-fix`).
  - Operational rules: Simplicity, YAGNI, planning before implementing, Git safety (zero-commit/push rule for agents), purposeful documentation.
  - Verification gates: Concrete build, lint, typecheck, and test commands detected from repository configuration.
- **Stack / project-dependent (optional, only include when non-trivial and necessary)**:
  - Build & CI rules (headless builds, container-free CI, environment variable requirements during build, secret handling on pull requests).
  - Dependency and toolchain rules (lockfile synchronisation, compiler options, package manager rules).
  - Tooling gotchas (terminal diff wrapping, file encoding anomalies, runtime platform limitations). Keep lean—do not add irrelevant trivia or boilerplate.

### 2. `.agents/project-details.md`
- **Dense & architecture-focused**: Focus strictly on core invariants, subsystem contracts, and data lifecycles. **Do NOT bloat with trivia, tutorial prose, or full code dumps.**
- **Universal categories**:
  - Subsystem interactions & data flow: How primary modules communicate across boundaries and entity lifecycle pipelines.
  - State management & lifecycles: Distinctions between persistent state, client state, and transient in-flight state.
  - Concurrency, async execution & cancellation: Abort signal propagation, race condition prevention, deduplication, and idempotency.
  - Security & trust boundaries: Tenant isolation, authentication token scoping, SSRF guards, encrypted secrets, and permission boundaries.
- **Stack / project-dependent categories**:
  - Runtime & framework mechanics: Framework-specific runtime mechanics (streaming protocols, background job engines, ORM query building quirks, IPC bridges, native extensions).

### 3. `.agents/conventions.md`
- **Universal**:
  - Directory layout and module responsibilities.
  - File and symbol naming conventions.
  - Architectural boundaries and domain isolation.
  - Skill overrides.
- **Language-specific**:
  - Typing idioms (strict types, interfaces vs types, dataclasses, traits).
  - Export and import discipline (named exports, direct paths, barrel file policies).

### 4. `.agents/design.md`
- **Applicability**: Applicable **ONLY** when the project includes UI or frontend code. Omit entirely for backend services, APIs, CLI tools, daemon processes, and shared libraries.
- **Universal**: Component directory hierarchy, layout shell boundaries, viewport width controls.
- **Stack-specific**: Styling framework rules (Tailwind CSS, CSS modules, design tokens, theme variables), UI primitive libraries.

### 5. `.agents/testing.md`
- **Universal**:
  - Testing strategy (TDD, red-green-refactor loop).
  - Coverage thresholds & quality gates.
  - Testing skills.
- **Stack-specific**:
  - Runner setup & commands.
  - Mocking overrides & environment stubs.

### 6. `.agents/plan.md`
- **Universal**:
  - Planning standards (high-level first, concrete specs, edge cases).
  - Codebase simplification & anti-bloat.
  - Alternatives evaluated & justification.

---

## Specifications for Modular `.agents/` Files

### 1. `.agents/development.md`
Captures dev lifecycle principles, operational rules, workflow skills, and verification commands. **This file is purely process-focused; system architecture mechanics belong in `project-details.md`.**

Keep this file lean and focused purely on the development process. The clean core template contains Skills, Non-Negotiable Operational Rules, and Verification. Optional sections (Build & CI Rules, Dependency & Toolchain Rules, Tooling Gotchas) are added only when the project has non-trivial constraints. Do not add generic boilerplate or irrelevant trivia.

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

---

### 2. `.agents/project-details.md`
Captures how the system works: architecture, subsystem interactions, state management, concurrency, security boundaries, and runtime mechanics. **This file captures system design; development process rules belong in `development.md`.**

Keep this file dense, high-signal, and architecture-focused. Document concise architectural invariants and subsystem contracts. **Do NOT bloat this file with trivia, tutorial prose, or full code dumps.** Capture concise invariants, ownership models, and failure boundaries.

```markdown
---
description: Project-specific architectural details, system design decisions, and subsystem interactions. Load when working on features that span multiple subsystems or modifying system mechanics.
applyTo: '**/*'
---

# Project Details & Architecture

## 1. System Architecture & Subsystem Interactions
- Document how primary subsystems communicate across module boundaries.
- Trace end-to-end data flows for primary entity lifecycles.
- Document ownership boundaries and database/storage relationship scoping.

## 2. State Management & Lifecycle
- Define boundaries between persistent storage, cached data, and ephemeral client state.
- Define hydration lifecycles, store reset behaviour, and cache invalidation policies.

## 3. Concurrency, Async Execution & Cancellation
- Document cancellation mechanisms (e.g. AbortController registries, cooperative cancellation tokens).
- Define deduplication rules, idempotent database operations, and race condition mitigations.

## 4. Security & Trust Boundaries
- Document trust boundaries between client, application server, and external integrations.
- Enforce tenant and user scoping across all persistence and retrieval queries.
- Specify credential handling, encryption boundaries, and SSRF protections.

## 5. Runtime & Framework Mechanics
- Document framework-specific runtime mechanics (e.g. streaming chunk assembly, background job execution, ORM column mappings, IPC bridges).
```

---

### 3. `.agents/conventions.md` (or `convensions.md`)
Captures codebase architecture, directory layouts, and code style. Follows the **"Thin Pointer, Not Duplicate"** rule:
- If a skill documents it, reference the skill.
- Only restate a rule if the project **overrides** the skill or the rule is unique to the project.

**Test for an Override**: Would the rule be wrong if the agent followed the skill verbatim? If no, it is a reference. If yes, it is an override.

```markdown
---
description: Load when modifying codebase structure, creating new components, actions, schemas, or adjusting architectural patterns.
applyTo: '**/*.ts, **/*.tsx, **/*.js, **/*.jsx'
---

# Codebase Conventions & Style Guide
All conventions and guidelines in this file MUST be followed.

## 1. Skills
Follow these skills as the single source of truth for architecture and conventions:
- `structuring-nextjs-projects` — Directory layout, file naming, imports, exports, and Next.js domain-based structure.
- `centralised-routes` — Centralised type-safe route definitions and URL helpers in `./config/routes.ts`.
- `mastering-typescript` — Enterprise TypeScript patterns, strict type safety, and Zod validation.
- `typescript-environment-variables` — Centralised, Zod-validated environment config in `./config/env.ts`.
- `logtape-nextjs` — Structured application logging in `./lib/logger.ts`.
- `drizzle-nextjs` — Database schema definitions and Drizzle ORM operations.

## 2. Repository & Directory Structure
### 2.1 Directory Layout
- `app/`: Next.js App Router routes.
- `components/`: React components organised by domain.
- `lib/`: Shared utilities, constants, and server actions.
- `schemas/`: Zod validation schemas for API requests and entity validation.
- `types/`: TypeScript interfaces and type definitions.
- `drizzle/schemas/`: Database table definitions.
- `constants/`: Application-wide constants (routes, models, prompts).
- `public/`: Static assets.

### 2.2 File Naming Conventions
- **Filenames & Directories**: Use kebab-case exclusively (e.g. `update-assistant.ts`).
- **Code Identifiers**: Use PascalCase for functions, classes, React components, variables, and constants.

## 3. Centralised Architectural Patterns
### 3.1 Environment Variables & Configuration
- All environment variables must be defined and validated in `./config/env.ts` using Zod.
- Avoid accessing `process.env` directly; import from `./config/env.ts` instead.

### 3.2 Routing & URL Management
- Hardcoding path strings is strictly forbidden.
- Use centralised definitions in `./config/routes.ts` for all route paths.

### 3.3 State Management & Data Flow
- **Server Actions**: Primary mechanism for data mutations.
- **Zustand**: Client-side ephemeral UI state.
- **Nuqs**: Persists UI state (like active tabs) directly in the URL.

## 4. Code Style & Language Standards
- Strict TypeScript typing, One Export per File, file limit <300 lines, DRY, YAGNI.
- Named exports, direct imports with `@/` alias.

## 5. Data Layer & Structural Patterns
- Database schemas location and organisation (`./drizzle/schemas/`).
- Shared utilities structure and error class hierarchy.
```

---

### 4. `.agents/testing.md`
Captures project-specific testing setup, runner commands, unique mock overrides, and coverage thresholds. Like conventions, **it is a thin pointer that must NOT duplicate general testing skills** (e.g. `writing-nextjs-vitest-tests`):

```markdown
---
description: Load when writing, running, or mocking unit, integration, or E2E tests.
applyTo: '**/*.test.ts, **/*.test.tsx, **/*.spec.ts, **/*.spec.tsx'
---

# Testing Conventions & Guidelines

## 1. Skills
Follow these skills as the single source of truth for general testing patterns:
- `writing-nextjs-vitest-tests` — Primary reference for Vitest + jsdom setup, hoisting rules (`vi.hoisted`), module graph pre-import mocking (env/db/auth), Next.js runtime mocks (`next/navigation`, `next/headers`, `next/cache`), chainable query builders, and component testing.
- `tdd` & `test-driven-development` — Red-green-refactor loop before writing production code.
- `playwright-skill` — End-to-end browser automation workflows.
- `systematic-debugging` — Diagnosing test runner failures or flaky assertions.
- `verification-before-completion` — Running test suites to verify passing behaviour before finishing.

## 2. Project-Specific Test Setup & Commands
- **Test Commands**: `pnpm test` (`vitest run`), `pnpm test:watch`, `pnpm test:coverage`.
- **Directory Layout**: Mirrored test suites in `__tests__/` matching source structure; action tests in `lib/actions/**/*.test.{ts,tsx}`.
- **Global Setup (`./vitest.setup.ts`)**: Documents what the setup file handles automatically (fallback env vars, browser stubs, Inngest spies).

## 3. Project-Specific Mocking Overrides & Gotchas
- Document only project-specific mock nuances (e.g. `requireSession` vs `getSession`, dual-mock logger exports, Drizzle query decoupling).

## 4. Coverage Thresholds
- State the project's configured thresholds (e.g. 80% configured in `vitest.config.ts`, aiming for 100% on tested units).
```

---

### 5. `.agents/design.md`
Captures UI component architecture, styling conventions, layout boundaries, and design skills. **Applicable ONLY when the project includes UI or frontend code. Omit this file entirely for backend services, APIs, CLI tools, daemon processes, and shared libraries.**

```markdown
---
description: Load when creating or modifying UI components, pages, styling, or layouts.
applyTo: 'components/**/*.tsx, app/**/*.tsx, styles/**/*.css'
---

# UI Design Conventions & Guidelines

## 1. Skills
Follow these skills as the single source of truth for UI/UX patterns:
- `ui-ux-pro-max` — Primary reference for UI/UX design intelligence (styles, responsive layouts, colour palettes, dark mode, typography, and micro-interactions).
- `ui-component-decomposition` — Decomposing monolithic page templates into focused, testable, and reusable UI components.
- `radix-ui-to-base-ui-migration` — Migrating UI primitives to `@base-ui/react` with Tailwind CSS v4.
- `ui-design-language` — Standardising component density, accessible contrast, iconography, and desktop/mobile navigation patterns.

## 2. Project-Specific UI Architecture
- **Component Directory Hierarchy**:
  - `components/ui/`: Base UI primitives and Shadcn components (`button.tsx`, `dialog.tsx`, `input.tsx`, etc.).
  - `components/<domain>/`: Domain-specific components grouped by feature area (`chat/`, `mcp/`, `prompts/`, `skills/`, `settings/`).
  - `components/shared/`: Shared reusable compound patterns (e.g. `base-entity-options.tsx`).
- **Layout Shell Boundaries & Width Control**:
  - Layout files (`layout.tsx`) must remain unconstrained shells (rendering navigation, header, and viewport containers).
  - Do NOT hardcode `max-w-*` or `overflow-y-auto` into layout wrappers.
  - Use `PageContainer` (`variant="default" | "narrow" | "wide" | "full" | "prose"`, `scrollable={true | false}`) inside page components to govern layout width and scroll behaviour.
- **Client Hydration & Empty Store Guards**:
  - For client-side detail pages reading from client state stores, guard against initial empty hydration with loading spinners (`Loader2`) before invoking `notFound()`.

## 3. Styling & Responsive Design
- **Tailwind CSS 4**: Use CSS variable theme tokens defined in the global stylesheet.
- **Dark Mode**: Maintain high-contrast accessible borders (`border-border`) and muted foreground hierarchy (`text-muted-foreground`).
- **Responsive Adaptations**: Use drawers (`vaul` / `Sheet`) for mobile interactions and collapsible sidebars for desktop viewports.
```

---

### 6. `.agents/plan.md`
Captures planning standards, architectural guidelines, alternative approaches, engineering detail, high-level overview first, anti-bloat rules, and planning skills:

```markdown
---
description: Load when creating, refining, reviewing, or structuring implementation plans, technical designs, or architectural proposals.
applyTo: '**/*'
---

# Planning Instructions & Architectural Guidelines

## 1. Skills
Follow these skills as the single source of truth for planning and design:
- `writing-plans` — Implementation plan structure, file mapping, interface boundaries, and bite-sized task decomposition.
- `ponytail` — Radical simplicity and YAGNI. Minimum code that works, zero unnecessary abstractions, deletion over addition.
- `brainstorming` — Collaborative problem exploration, requirements clarification, and iterative design before committing to code.
- `karpathy-guidelines` — Think before coding, surface assumptions, surgical changes, and goal-driven verifiable execution.

## 2. Core Philosophy & Engineer Audience
Plans in this repository are written directly for engineers. They must respect the reader's time and technical competence:
- **High-Level Overview First**: Always lead with the high-level architecture, design summary, and mental model before descending into file-level tasks. Keep descending shallow: each task states intent and constraints before any implementation detail.
- **Concrete Technical Specifics**: Do not abstract away the details that change the design. Specify exact file paths, API route contracts, function signatures, state mutations, and error codes — then state the invariant and the constraint that a reader would otherwise guess wrong.
- **Prefer Spec Over Listing**: A block of source in a plan is a second source of truth that drifts from the code and is harder to review than prose. Show source only where the failure mode is a runtime one the compiler cannot catch.
- **Edge-Cases Must Be Addressed**: Explicitly identify potential failure modes, boundary conditions, empty/error states, race conditions, and migration edge-cases before writing code.
- **Codebase Simplification Opportunities**: Actively evaluate whether the changes can simplify the existing codebase—look for opportunities to delete redundant code, collapse unnecessary indirections, consolidate duplicate utilities, or retire obsolete abstractions.
- **Anti-Bloat & Zero Fluff**: Plans must not be bloated or unnecessarily lengthy. Strip out tutorial-like prose, obvious explanations of standard framework mechanics, and generic boilerplate — in both directions: tutorial filler, and full implementations pasted in place of a clear specification.
- **Avoid Overcomplication**: Reject speculative configurability, premature factories, or multi-layered indirections. The best design solves the stated problem with the fewest files and simplest construct.

## 3. Alternative Approaches & Justification
Every non-trivial design or plan must document alternative approaches evaluated:
- Present 2–3 viable approaches with concise trade-offs (pros and cons).
- Clearly identify the recommended approach.
- State explicitly **why each alternative was NOT chosen** (e.g. YAGNI violation, state desync risk, unnecessary DB migrations, leaky abstractions).

## 4. Plan Structure & Content Contract
When authoring an implementation plan, follow this standard structure:

### 4.1 High-Level Overview
- **Goal**: Exactly 1–2 sentences explaining what is being built or fixed.
- **High-Level Architecture**: Conceptual design, data flow, and component relationships (include a concise Mermaid diagram where it clarifies boundaries).
- **Global Constraints**: Inviolable technical limits (runtime constraints, zero-Git commit policy, podman container usage, auth rules).

### 4.2 Alternatives Evaluated
- Table or compact list of evaluated architectures with trade-offs.
- Explicit justification for why the selected approach is superior.

### 4.3 Proposed Changes (File & Interface Breakdown)
- Group changes logically (e.g., Config/Schema -> Backend/Lib -> Frontend/Components -> Tests).
- Categorise touched files using `[NEW]`, `[MODIFY]`, or `[DELETE]`.
- State the **signature, invariant, and constraint** for each unit. Include a code block only where a reader would otherwise guess wrong: a wire format or schema validated by something stricter than TypeScript, a counter-intuitive constraint, or a literal boundary value. Boilerplate, imports, and straightforward control flow get a sentence, not a listing.
- **Codebase Simplification**: Highlight any code or abstractions that are being deleted, consolidated, or retired as part of this implementation.

### 4.4 Edge Cases & Failure Modes
- Enumerate edge cases, boundary conditions, and error paths (e.g. auth expiry, network drops, empty states, concurrency, partial failures).
- Detail how each edge case is handled cleanly without adding bloated defensive machinery.

### 4.5 Task Decomposition
- Break work into bite-sized, independently reviewable steps (2–5 minute actions).
- Include verification checkpoints for each task (e.g. failing test -> pass test -> lint).

### 4.6 Verification Plan
- **Automated Tests**: Exact commands to run targeted unit/integration tests (`pnpm test -- <path>`).
- **Typecheck & Lint**: Verification commands (`pnpm check`, `pnpm lint`).
- **Manual Verification**: Step-by-step checklist to test the behaviour in the browser/client.

## 5. Simplicity Guardrails
- **The Simplicity Ladder**: Stop at the first rung that solves the problem (YAGNI -> stdlib -> native platform -> existing vetted dependency -> minimal concrete code).
- **Blast Radius Discipline**: Map all callers and dependents before modifying shared contracts.
- **Codebase Simplification over Addition**: Prefer solutions that leave the codebase smaller and simpler than before.
- **YAGNI Ruthlessly**: Build only what is requested today. If a future extension might need X, leave room for it in clean boundaries without implementing X today.
```

