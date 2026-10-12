# App Routing & Special Files Reference

Routing architecture, special files, route groups, and API route handlers in Next.js App Router projects.

## `app/` Directory

**Purpose:** Routing + special files ONLY  
**Structure:** File-based routing per Next.js conventions  
**Rule:** NO business logic here

### Root Special Files Requirement
`not-found.tsx`, `loading.tsx`, and `error.tsx` **must exist** in the root of the `./app` directory:
- `error.tsx`: Root client-side error boundary catching uncaught runtime exceptions
- `loading.tsx`: Root Suspense fallback during page transitions and initial loads
- `not-found.tsx`: Global 404 page for unmatched URL paths

### Dynamic Route Not-Found
For dynamic routes (e.g., `app/songs/[id]/`), include a route-level `not-found.tsx`. When a queried resource does not exist (handled via `notFound()` from `next/navigation`), Next.js renders this route-level `not-found.tsx` to explicitly notify the user that the specific entity in the dynamic route does not exist (e.g., "Song not found") instead of presenting a vague global 404.

```
app/
├── layout.tsx                      # Root layout
├── page.tsx                        # Home page
├── error.tsx                       # Root error boundary (REQUIRED in root ./app)
├── loading.tsx                     # Root loading UI (REQUIRED in root ./app)
├── not-found.tsx                   # Root 404 page (REQUIRED in root ./app)
├── globals.css
├── songs/
│   ├── page.tsx
│   ├── [id]/
│   │   ├── page.tsx
│   │   ├── not-found.tsx           # Dynamic route 404 (specific resource does not exist)
│   │   └── _components/            # Page-specific components (underscore prefix)
│   │       └── song-details.tsx
│   └── loading.tsx
└── api/                            # API routes (if needed)
    └── webhook/
        └── route.ts
```

---

## Colocation Rules & Page-Specific Components

- **Colocation rule:** Business logic stays OUT of `app/`. Routing concerns ONLY.
- **Page-specific components:** Pages can include their own `_components/` subfolder (with underscore prefix, Next.js convention for non-routable folders) ONLY if the components are strictly specific to that page. Otherwise, components must be centralised in `./components`.

---

## Route Groups Pattern

- **Purpose:** Organize routes without affecting URLs
- **Syntax:** `(folderName)/`
- **Example:** `app/(site)/page.tsx` → URL is `/`, not `/(site)`
- **Use cases:** Shared layouts, logical grouping, auth states

---

## API Route Handlers Pattern

- **Purpose:** RESTful API endpoints and external protocol adapters (such as Model Context Protocol)
- **Location:** `app/api/[resource]/route.ts`
- **Exports:** GET, POST, PUT, DELETE functions (or delegating to adapters)
- **Example structure:**
```
app/api/
├── songs/
│   ├── route.ts           # /api/songs
│   └── [id]/
│       └── route.ts       # /api/songs/[id]
└── mcp/
    └── route.ts           # /api/mcp - MCP server endpoint using mcp-handler
```

### MCP Server Pattern (`mcp-handler`)
When turning the Next.js application into a Model Context Protocol (MCP) server, use `mcp-handler` at `app/api/mcp/route.ts` to export standard route handlers (`export const { GET, POST } = createMcpHandler(...)`). Place domain tools in `lib/mcp/tools/[domain].ts` to keep tools modular and testable.

