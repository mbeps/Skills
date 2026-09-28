# Structure and Section Specifications

Agent instruction files follow a strict contract. The agent ecosystem uses a tiered structure:
- **`AGENTS.md`**: The root orchestrator and entry point.
- **`.agents/*.md`**: Modular, on-demand domain rulebooks (`development.md`, `conventions.md`, `testing.md`, `design.md`, `plan.md`, `learnings.md`).

---

## Target Files & Directory Layout

### 1. Root File: `AGENTS.md`
- Strictly located at the project root: `AGENTS.md`.
- Acts as the primary entry point loaded into the agent's context across sessions.
- Contains the project overview, baseline operational instructions, categorized tech stack links, resources index, and skills catalog.

### 2. The `.agents/` Folder
- All modular agent files and guidelines live inside `.agents/`:
  - `development.md`: Dev lifecycle principles, non-negotiable rules, container tools, dev skills.
  - `conventions.md` (or `convensions.md`): Directory structure, naming conventions, architectural boundaries, skill overrides.
  - `testing.md`: Testing strategy, mock setup (Vitest, jsdom), coverage rules, testing skills.
  - `design.md`: UI architecture, component hierarchy, page container rules, styling, design skills.
  - `plan.md`: Planning instructions, architectural standards, alternative approaches, anti-bloat guidelines, and planning skills.
  - `learnings.md`: Historical discoveries, pitfalls, and session takeaways.
- Centralizing these in `.agents/` keeps the root clean and prevents context bloat by allowing agents to load detailed rules only when triggered by relevant tasks.

### 3. Path Relativity
All path references resolve from the repository root using standard markdown relative paths (`./...`):
- `./README.md`
- `./graphify-out/`
- `./.agents/development.md`
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
  - Whenever using subagents, read the *subagent-driven-development* and *dispatching-parallel-agents* skills first using the main agent right at the start of process to orchanstrate the subagents correctly and efficiently. 
  - Do not ask irrelevant questions such as asking permission to start analysing, researching.
  - Update ./.agents/learnings.md with new info that are relevant to the project such as mistakes, commmon pitfalls, info that is not obvious, etc.
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
- Centralizes pointers to repository documentation, indexing assets, and `.agents/` modular rulebooks.
- Annotate each resource with clear triggers indicating when an agent should read it.
- **Standard Entries**:
  ```markdown
  # Resources
  - README ./README.md - Includes features, setup, etc. 
  - Coding Convensions ./.agents/convensions.md - MUST be followed when writing code
  - Development Instructions ./.agents/development.md - MUST be followed when developing or modifying features
  - Testing Conventions ./.agents/testing.md - MUST be followed when writing, running, or mocking tests
  - Design Conventions ./.agents/design.md - MUST be followed when creating or modifying UI components or styling
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
  - Context7 - MUST be used for fiding relevant documentation about tools, libraries, and frameworks
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

## Specifications for Modular `.agents/` Files

### 1. `.agents/development.md`
Captures core operational habits, non-negotiable developer rules, and development workflow skills:

```markdown
---
description: Load before implementing features, fixing bugs, refactoring code, or executing development workflows in the Next.js AI chat client.
applyTo: '**/*.ts, **/*.tsx, **/*.js, **/*.jsx'
---

# Development Instructions & Operational Guidelines

## 1. Skills
Follow these skills as the single source of truth for development workflows:
- `writing-code` — Pragmatic clean coding standards, design patterns, simplicity, and maintainability.
- `mastering-typescript` — Idiomatic TypeScript development, strict typing, and best practices.
- `writing-plans` — Structured planning for non-trivial changes before implementation.
- `bug-fix` & `systematic-debugging` — Diagnosing root causes systematically before proposing fixes.
- `verification-before-completion` — Verifying builds, linting, and tests pass before completion.
- `better-auth-nextjs` — Implementing and modifying authentication flows.
- `typescript-environment-variables` — Centralized Zod environment variable validation.

## 2. Non-Negotiable Operational Rules
- **Simplicity & YAGNI**: Code must not be unnecessarily overcomplicated. It must be simple to understand, modify, and maintain. Strictly follow YAGNI principles.
- **Plan Before Implementing**: Always plan before implementing unless the change is completely trivial.
- **Document Codebase & Changes**: Document code purposefully, explaining WHY rather than WHAT.
- **Enforce Quality Gates**: Code must pass building (`pnpm build`), linting/formatting checks (`pnpm lint`), type checks, and testing before completion.
- **Git & Version Control Safety**: You must NEVER commit, stage, push, or stash with Git. The developer is in charge of managing version control. Only read-only Git commands (`status`, `log`, `diff`) are permitted.
- **Local Development Runtime**: You must use Podman to run Docker containers (Postgres, MinIO, etc.) for local development. Do NOT use Docker.
```

---

### 2. `.agents/conventions.md` (or `convensions.md`)
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

### 3. `.agents/testing.md`
Captures project-specific testing setup, runner commands, unique mock overrides, and coverage thresholds. Like conventions, **it is a thin pointer that must NOT duplicate general testing skills** (e.g. `writing-nextjs-vitest-tests`):

```markdown
---
description: Load when writing, running, or mocking unit, integration, or E2E tests in the Next.js AI chat client.
applyTo: '**/*.test.ts, **/*.test.tsx, **/*.spec.ts, **/*.spec.tsx'
---

# Testing Conventions & Guidelines

## 1. Skills
Follow these skills as the single source of truth for general testing patterns:
- `writing-nextjs-vitest-tests` — Primary reference for Vitest + jsdom setup, hoisting rules (`vi.hoisted`), module graph pre-import mocking (env/db/auth), Next.js runtime mocks (`next/navigation`, `next/headers`, `next/cache`), chainable query builders, and component testing.
- `tdd` & `test-driven-development` — Red-green-refactor loop before writing production code.
- `playwright-skill` — End-to-end browser automation workflows.
- `systematic-debugging` — Diagnosing test runner failures or flaky assertions.
- `verification-before-completion` — Running test suites to verify passing behavior before finishing.

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

### 4. `.agents/design.md`
Captures UI component architecture, styling conventions, layout boundaries, and design skills:

```markdown
---
description: Load when creating or modifying UI components, pages, styling, or layouts in the Next.js AI chat client.
applyTo: 'components/**/*.tsx, app/**/*.tsx, styles/**/*.css'
---

# UI Design Conventions & Guidelines

## 1. Skills
Follow these skills as the single source of truth for UI/UX patterns:
- `ui-ux-pro-max` — Primary reference for UI/UX design intelligence (styles, responsive layouts, color palettes, dark mode, typography, and micro-interactions).
- `ui-component-decomposition` — Decomposing monolithic page templates into focused, testable, and reusable UI components.
- `radix-ui-to-base-ui-migration` — Migrating UI primitives to `@base-ui/react` with Tailwind CSS v4.
- `ui-design-language` — Standardizing component density, accessible contrast, iconography, and desktop/mobile navigation patterns.

## 2. Project-Specific UI Architecture
- **Component Directory Hierarchy**:
  - `components/ui/`: Base UI primitives and Shadcn components (`button.tsx`, `dialog.tsx`, `input.tsx`, etc.).
  - `components/<domain>/`: Domain-specific components grouped by feature area (`chat/`, `mcp/`, `prompts/`, `skills/`, `settings/`).
  - `components/shared/`: Shared reusable compound patterns (e.g. `base-entity-options.tsx`).
- **Layout Shell Boundaries & Width Control**:
  - Layout files (`layout.tsx`) must remain unconstrained shells (rendering navigation, header, and viewport containers).
  - Do NOT hardcode `max-w-*` or `overflow-y-auto` into layout wrappers.
  - Use `PageContainer` (`variant="default" | "narrow" | "wide" | "full" | "prose"`, `scrollable={true | false}`) inside page components to govern layout width and scroll behavior.
- **Client Hydration & Empty Store Guards**:
  - For client-side detail pages reading from client state stores, guard against initial empty hydration with loading spinners (`Loader2`) before invoking `notFound()`.

## 3. Styling & Responsive Design
- **Tailwind CSS 4**: Utilize CSS variable theme tokens defined in the global stylesheet.
- **Dark Mode**: Maintain high-contrast accessible borders (`border-border`) and muted foreground hierarchy (`text-muted-foreground`).
- **Responsive Adaptations**: Use drawers (`vaul` / `Sheet`) for mobile interactions and collapsible sidebars for desktop viewports.
```

---

### 5. `.agents/plan.md`
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
- **High-Level Overview First**: Always lead with the high-level architecture, design summary, and mental model before descending into file-level tasks.
- **Concrete Technical Specifics**: Do not abstract away critical implementation details. Specify exact file paths, schemas, API route contracts, function signatures, state mutations, and error codes.
- **Edge-Cases Must Be Addressed**: Explicitly identify potential failure modes, boundary conditions, empty/error states, race conditions, and migration edge-cases before writing code.
- **Codebase Simplification Opportunities**: Actively evaluate whether the changes can simplify the existing codebase—look for opportunities to delete redundant code, collapse unnecessary indirections, consolidate duplicate utilities, or retire obsolete abstractions.
- **Anti-Bloat & Zero Fluff**: Plans must not be bloated or unnecessarily lengthy. Strip out tutorial-like prose, obvious explanations of standard framework mechanics, and generic boilerplate.
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
- Categorize touched files using `[NEW]`, `[MODIFY]`, or `[DELETE]`.
- Provide concrete diffs or code snippets for critical logic (schemas, signatures, state transforms).
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
- **Manual Verification**: Step-by-step checklist to test the behavior in the browser/client.

## 5. Simplicity Guardrails
- **The Simplicity Ladder**: Stop at the first rung that solves the problem (YAGNI -> stdlib -> native platform -> existing vetted dependency -> minimal concrete code).
- **Blast Radius Discipline**: Map all callers and dependents before modifying shared contracts.
- **Codebase Simplification over Addition**: Prefer solutions that leave the codebase smaller and simpler than before.
- **YAGNI Ruthlessly**: Build only what is requested today. If a future extension might need X, leave room for it in clean boundaries without implementing X today.
```

