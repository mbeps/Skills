# Specification: `.agents/conventions.md` (or `convensions.md`)

Captures codebase architecture, directory layouts, and code style. Follows the **"Thin Pointer, Not Duplicate"** rule:
- If a skill documents it, reference the skill.
- Only restate a rule if the project **overrides** the skill or the rule is unique to the project.

**Test for an Override**: Would the rule be wrong if the agent followed the skill verbatim? If no, it is a reference. If yes, it is an override.

---

## File Template

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

