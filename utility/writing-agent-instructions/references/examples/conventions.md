# Example: `.agents/convensions.md` (or `conventions.md`)

Below is a canonical example of `.agents/convensions.md` for a full-stack Next.js web application:

```markdown
---
description: Load when modifying codebase structure, creating new components, actions, schemas, or adjusting architectural patterns in the Next.js AI chat client.
applyTo: '**/*.ts, **/*.js, **/*.tsx, **/*.jsx'
---

# Codebase Conventions & Style Guide
All conventions and guidelines in this file MUST be followed.

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
- Logging: Use the centralised `./lib/logger.ts` for all application logging. Avoid `console.log/warn/error` in production-facing code.
- TypeScript: Strict typing required. Use `interface` for object shapes and `type` for compositions or derivations.
- React 19: Use functional components with hooks. Use the `"use client"` or `"use server"` directives at the file top where required.
- One Export per File: Each file should export a single function, class, or component.
- Code Must Not Be Too Long: Avoid files exceeding 300 lines.
- Follow YAGNI principles.
```

