# Specification: `.agents/design.md`

Captures UI component architecture, styling conventions, layout boundaries, and design skills. **Applicable ONLY when the project includes UI or frontend code. Omit this file entirely for backend services, APIs, CLI tools, daemon processes, and shared libraries.**

---

## File Template

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

