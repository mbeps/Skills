# Worked Examples

Below are canonical examples of `AGENTS.md` and modular `.agents/*.md` files conforming to the contract.

---

## Example 1: Full-Stack Web Application (`AGENTS.md`)

```markdown
# Project Overview
A full stack AI chat client app similar to ChatGPT, Gemini, Claude, etc.
App has text streaming, internal tools, MCP over HTTP, RAG, etc.
The client supports any OpenAI compatible API provider (OpenRouter, Ollama, Groq, Azure, DeepSeek, etc.).

**Test Credentials:** Email: `test@example.com` | Password: `Hello123`

# Instructions
- Use ./graphify-out/ to find navigate codebase. Graphify is like an index.
- Whenever using subagents, read the *subagent-driven-development* and *dispatching-parallel-agents* skills first using the main agent right at the start of process to orchanstrate the subagents correctly and efficiently. 
- Do not ask irrelevant questions such as asking permission to start analysing, researching.
- Update ./.agents/learnings.md with new info that are relevant to the project such as mistakes, commmon pitfalls, info that is not obvious, etc.

# Tech Stack
## Frontend
- [Next.js 16](https://nextjs.org/docs)
- [React.js 19](https://react.dev/blog/2024/12/05/react-19)
- [Shadcn UI](https://ui.shadcn.com/docs/installation) 
- [Radix](https://www.radix-ui.com/themes/docs/overview/getting-started)
- [Tailwind CSS 4](https://tailwindcss.com/docs/installation/using-vite)
- [react-markdown 10](https://remarkjs.github.io/react-markdown/)
- [Mermaid 11](https://mermaid.ai/open-source/)
- [KaTeX 0.16](https://www.npmjs.com/package/katex?activeTab=versions)
- [React Hook Form 7](https://react-hook-form.com/)

## Backend
- [Next.js API Routes (App Router)](https://nextjs.org/docs)
- [Better Auth](https://better-auth.com/docs/installation) 

## Database
- [PostgreSQL 17](https://www.postgresql.org/docs/17/index.html) with [pgvector](https://github.com/pgvector/pgvector) (2048-dim)
- [Drizzle ORM 0.45.2](https://orm.drizzle.team/docs/overview)

## Storage
- [AWS S3 SDK](https://www.npmjs.com/package/@aws-sdk/client-s3) 
- [MinIO](https://hub.docker.com/r/minio/minio) (for local dev)

## AI
- [Vercel AI SDK 6](https://ai-sdk.dev/docs/introduction)
- [MCP SDK 1](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)

## Other
- [Zod 4](https://zod.dev/v4)
- [nuqs 2](https://nuqs.dev/docs/installation)
- [Podman](https://docs.podman.io/en/latest/) to run Docker containers (Postgres, MinIO, etc.)

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

# Resources
- README ./README.md - Includes features, setup, etc. 
- Coding Convensions ./.agents/convensions.md - MUST be followed when writing code
- Development Instructions ./.agents/development.md - MUST be followed when developing or modifying code
- Testing Conventions ./.agents/testing.md - MUST be followed when writing or mocking tests
- Planning Instructions ./.agents/plan.md - MUST be followed when creating or reviewing implementation plans
- Graphify ./graphify-out/ - Includes report, graph relationships, etc. Must be loaded at the beginning.
  - Graph Report ./graphify-out/GRAPH_REPORT.md
  - Graph JSON ./graphify-out/graph.json
- Learnings ./.agents/learnings.md - Includes info that the agent has learnt while working on this project. Read this file to avoid wasting time and tokens re-discovering information
- Wiki ./wiki/ - Wiki with detailed information about the project, architecture, and design
    
# Skills
List of skills that are required to work on this project:
- karpathy-guidelines: MUST be used when for all coding related tasks
- documentation-writer: MUST be used when writing code or code documentation
- ui-ux-pro-max: MUST be used when creating components, pages, or other UI/UX related tasks
- normalisation-theory: MUST be used when designing database schemas
- brainstorming: MUST be used when generating ideas or solutions
- dispatching-parallel-agents: MUST be used when managing multiple agents
- subagent-driven-development: MUST be used when developing subagents
- systematic-debugging: MUST be used when debugging code
- using-superpowers: SHOULD be used all the time
- writing-plans: MUST be used when creating plans
- caveman: MUST be used all the time when thinking or monologuing
- evaluation: MUST be used when evaluating
- graphify: MUST be used when generating and updating codebase index/graph relationships and report
- ponytail: MUST be used when writing code or planning
- using-checklists: MUST be used when to organize tasks 
- writing-nextjs-vitest-tests: MUST be used when writing Next.js Vitest tests
- playwright-skill: MUST be used when automating browser testing

# Additional Tools (and MCPs) 
- headroom: MUST be used for retrieving content
- Context7 - MUST be used for fiding relevant documentation about tools, libraries, and frameworks
- DBCode - Managing database
- Web - MUST be used for searching the web for relevant information
```

---

## Example 2: `.agents/development.md`

```markdown
- Code must not be unnecessarily overcomplicated. 
- Code must be simple to understand, modify and maintain.
- Follow YAGNI principles.
- Plan before implementing unless the change is trivial.
- Codebase must be documented including code.
- Code must pass building, linting checks, type checks and testing. Check at the end of the process to ensure that the code is working as expected and is not broken.
- You must never commit, stage, etc with Git. The developer is in charge of managing version control (Git and GitHub). You can do Git actions that do not have side affects such as logs, status, etc.
- You must use Podman to run Docker containers (Postgres, MinIO, etc.) for local development. Do NOT use Docker.

# Skills to Use
- writing-code: MUST be used when writing code
- mastering-typescript: MUST be used when writing TypeScript code
- typescript-environment-variables: MUST be used when managing environment variables in TypeScript
- test-driven-development: MUST be used when writing tests
- verification-before-completion: MUST be used when verifying code before completion
- writing-plans: MUST be used when creating plans
- bug-fix: MUST be used when fixing bugs
- tdd: MUST be used when practicing test-driven development
- better-auth-nextjs: MUST be used whenever working with authentication 
- ui-component-decomposition: MUST be used when auditing or identifying UI component extraction candidates 
```

---

## Example 3: `.agents/convensions.md`

```markdown
---
description: Load when modifying codebase structure, creating new components, actions, schemas, or adjusting architectural patterns in the Next.js AI chat client.
applyTo: '**/*.ts, **/*.js, **/*.tsx, **/*.jsx'
---

# Codebase Conventions & Style Guide

## 1. Repository & Directory Structure
### 1.1 Directory Layout
- `app/`: Next.js App Router routes. Uses route groups like `(main)` for authenticated pages.
- `components/`: React components organised by domain (e.g. `chat/`, `mcp/`).
- `components/ui/`: Base UI elements and Shadcn components.
- `lib/`: Shared utilities, constants, and server actions. Avoid placing shared utilities inside `lib/actions/`.
- `lib/actions/`: Centralised Server Actions, grouped by entity (e.g. `projects/`, `chats/`).
- `schemas/`: Zod validation schemas for API requests and entity validation.
- `types/`: TypeScript interfaces and type definitions.
- `drizzle/schemas/`: Database table definitions.
- `constants/`: Application-wide constants (routes, models, prompts).
- `public/`: Static assets.

### 1.2 File Naming Conventions
- Filenames & Directory Names: Use kebab-case (e.g. `update-assistant.ts`, `chat-message-tree-utils.ts`).
- Code Names: Use PascalCase for functions, classes, React components, variables, constants, etc.

## 2. Centralised Architectural Patterns
### 2.1 Environment Variables & Configuration
- All environment variables must be defined and validated in `./config/env.ts` using Zod.
- Avoid accessing `process.env` directly in components; import from `./config/env.ts` instead.

### 2.2 Routing & URL Management
- Hardcoding path strings is forbidden.
- Use centralised definitions in `./config/routes.ts` for all route paths and route helper functions.
- Dynamic routes must expose helper functions (e.g. `ROUTES.CHATS.detail(id)`).

### 2.3 State Management & Data Flow
- Server Actions: Primary mechanism for data mutations and fetching in RSCs.
- Zustand: Client-side state (navigation, hydration, ephemeral UI toggles).
- Nuqs: Persists UI state (like active tabs) in the URL for shareability.

## 3. Code Style & Language Conventions
### 3.1 Language-Specific Standards
- Next.js 16: Utilise App Router, Server Components (default), and Server Actions. `proxy.ts` is used instead of `middleware.ts` for request interception.
- Logging: Use the centralized `./lib/logger.ts` for all application logging. Avoid `console.log/warn/error` in production-facing code.
- TypeScript: Strict typing required. Use `interface` for object shapes and `type` for compositions or derivations.
- React 19: Use functional components with hooks. Use the `"use client"` or `"use server"` directives at the file top where required.
- One Export per File: Each file should export a single function, class, or component.
- Code Must Not Be Too Long: Avoid files exceeding 300 lines.
- Follow YAGNI principles.
```

---

## Example 4: `.agents/testing.md`

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
- **Test Commands**:
  - `pnpm test` (`vitest run`): Run full test suite once.
  - `pnpm test:watch` (`vitest`): Interactive test runner.
  - `pnpm test:coverage` (`vitest run --coverage`): Run tests with V8 coverage report.
- **Directory Layout**:
  - Mirrored test suites live in `__tests__/` matching source structure (e.g. `__tests__/actions/`, `__tests__/lib/`).
  - Server action tests also match `lib/actions/**/*.test.{ts,tsx}`.
- **Global Setup (`./vitest.setup.ts`)**:
  - Automatically injects fallback environment variables for test execution (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `S3_*`, `INNGEST_*`).
  - Stubs missing browser globals in `jsdom` (`ResizeObserver`, `window.matchMedia`).
  - Pre-configures global spies for Inngest (`inngest.send` and `inngest.realtime.publish`) in `beforeEach`.

## 3. Project-Specific Mocking Overrides & Gotchas
- **Better Auth Mocking**:
  - For middleware/proxy tests: Mock `@/lib/auth/auth` with `{ auth: { api: { getSession: vi.fn() } } }`.
  - For server actions: Mock `@/lib/auth/require-session` (`requireSession`) rather than drilling into deep auth internals.
- **LogTape Logger Mocking**:
  - When mocking `@/lib/logger`, use dual mock exports: `{ getLogger: vi.fn(() => mockLog), logger: mockLog }` so both domain-scoped `getLogger(["app", ...])` and facade `logger` succeed.
- **Drizzle Query Mock Decoupling**:
  - When a tested action performs both `db.update` and `db.select`, decouple update mocks (`mockUpdateWhere`) from select mocks (`mockSelectWhere`) to avoid queue contention on chained `.where()` calls.

## 4. Coverage Thresholds
- `vitest.config.ts` enforces 80% thresholds across statements, branches, functions, and lines on tested modules.
```

---

## Example 5: `.agents/design.md`

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

## Example 6: `.agents/plan.md`

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


