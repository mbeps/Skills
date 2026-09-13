# Directory Structure Reference

Complete guide to folder organization in Next.js App Router projects with domain-based structure.

## Top-Level Folders

### `actions/`
**Purpose:** All server-side mutations and data fetching  
**Structure:** `actions/[domain]/[action-name].ts`  
**Rule:** ALL server actions here, even if used once; single default export per file (unexported internal helpers allowed)

```
actions/
├── _db-selects.ts          # Shared PostgREST select clauses (constants)
├── comment/
│   ├── get-comments.ts
│   ├── create-comment.ts
│   └── delete-comment.ts
├── song/
│   ├── get-songs.ts
│   ├── get-songs-by-title.ts
│   └── delete-song.ts
└── auth/
    ├── sign-in.ts
    └── sign-up.ts
```

**Special file:** `_db-selects.ts` contains reusable query constants (e.g., `SONG_WITH_ALBUM_SELECT`) to prevent duplicating complex joins.

---

### `types/`
**Purpose:** All TypeScript types and interfaces  
**Structure:** `types/[domain]/[type-name].ts`  
**Rule:** No barrel exports; one exported type/interface per file (unexported internal helpers allowed)

```
types/
├── comment/
│   ├── comment.ts                  # Base Comment type
│   └── comment-with-author.ts     # Composed type
├── song/
│   └── song.ts
├── music/                          # Cross-domain composed types
│   ├── song-with-album.ts
│   └── album-with-artists.ts
├── player/
│   └── repeat-mode.ts
└── database/
    └── types_db.ts                 # Supabase auto-generated (internal only)
```

**Domain vs Cross-Domain:**
- Domain-specific types: `types/comment/comment.ts`
- Cross-domain types: `types/music/song-with-album.ts` (used by songs, playlists, queue)

---

### `enums/` (or `enum/`)
**Purpose:** TypeScript enums and enum-like mappings (allowed as top-level folder or under `types/[domain]/`)  
**Structure:** `enums/[domain]/[name].ts` or `enums/[name].ts` (or `enum/`)  
**Rule:** One exported enum per file; no barrel exports; kebab-case file naming

```
enums/
├── car/
│   └── car-status.ts
└── auth/
    └── user-role.ts
```

---

### `components/`
**Purpose:** All shared and reusable React components  
**Structure:** `components/[domain]/[component-name].tsx`  
**Rule:** One component per file; no co-located sub-components. All reusable components must be centralised in `./components`. Pages may include their own local `_components/` folder if and only if the component is strictly specific to that page.

```
components/
├── comment/
│   ├── comment-list.tsx
│   ├── comment-item.tsx
│   └── comment-form.tsx
├── player/                         # Rich domain with many components
│   ├── player.tsx
│   ├── player-content.tsx
│   ├── player-controls.tsx
│   ├── player-volume.tsx
│   └── queue-panel.tsx
├── modals/                         # Shared UI concern
│   ├── auth-modal.tsx
│   └── create-album-modal.tsx
├── ui/                             # Shadcn UI primitives
│   ├── button.tsx
│   └── dialog.tsx
└── header.tsx                      # Root-level shared components
```

**When to use root-level:** Components used across ALL domains (header, footer, layout wrappers).

---

### `schemas/`
**Purpose:** Zod validation schemas  
**Structure:** `schemas/[domain]/[schema-name].schema.ts`  
**Rule:** One schema per file; `.schema.ts` suffix

```
schemas/
├── comment/
│   ├── create-comment.schema.ts
│   └── update-comment.schema.ts
├── auth/
│   ├── sign-in.schema.ts
│   ├── sign-up.schema.ts
│   └── forgot-password.schema.ts
└── song/
    ├── song-file.schema.ts
    ├── song-upload.schema.ts
    └── audio-allowed-types.ts      # Constants related to validation
```

**Reuse pattern:** Schemas used by BOTH client-side forms (React Hook Form) and server actions.

---

### `hooks/`
**Purpose:** Custom React hooks  
**Structure:** `hooks/use-[name].ts` (FLAT, no subfolders)  
**Rule:** `use-` prefix; single default export per file (unexported internal helpers allowed)

```
hooks/
├── use-player.ts
├── use-favourite.ts
├── use-auth-modal.ts
├── use-on-play.ts
└── use-debounce.ts
```

**Why flat:** Hooks orchestrate multiple domains; domain organization doesn't apply.

---

### `lib/`
**Purpose:** Business logic, utilities, shared helpers, and structured logging  
**Structure:** Domain-organized when specific, flat when generic

```
lib/
├── logger.ts                       # Structured logging configuration (see logtape-nextjs skill)
├── utils.ts                        # Generic utilities (cn(), formatArtists())
├── mappers/                        # DB row → UI type transformations
│   ├── comment.ts                  # mapCommentWithAuthorRow()
│   ├── song.ts
│   └── album.ts
├── music/                          # Music-specific business logic
│   └── duration-formatter.ts
└── storage-limit/
    └── calculate-usage.ts
```

**Mappers pattern:** All database row transformations in `lib/mappers/[domain].ts`. Keeps DB concerns separate from UI types.

**Logging pattern:** Structured logging belongs in `lib/logger.ts`. Use LogTape for columnar formatting, non-blocking sinks, and level control via `LOG_LEVEL`. Server actions log mutations at `info` and queries at `debug`; avoid raw `console.log` statements. Refer to the `logtape-nextjs` skill for full details.

---

### `utils/`
**Purpose:** Infrastructure clients and low-level utilities  
**Structure:** Technology-organized

```
utils/
└── supabase/
    ├── client.ts                   # Browser client
    ├── server.ts                   # Server client
    └── middleware.ts               # Middleware client (if using middleware)
```

**Rule:** Third-party client initialization only. No business logic.

**vs lib/:** `utils/` = infrastructure; `lib/` = business logic.

---

### `providers/`
**Purpose:** React Context providers  
**Structure:** `providers/[name]-provider.tsx` (FLAT)

```
providers/
├── supabase-provider.tsx           # Manages Supabase client
├── user-provider.tsx               # User session/details context
├── modal-provider.tsx              # Modal mount point
└── logging-provider.tsx
```

**Pattern:** Providers wrap `app/layout.tsx`, providing global context.

---

### `config/`
**Purpose:** Centralised application configuration, routes, environment variables, asset locations, and global constants  
**Structure:** `config/[name].ts`  
**Rules:**
- Application routes must be centralised under `./config` (e.g. `config/routes.ts`). Keep path definitions and dynamic route helpers here without mixing in auth or navigation logic. For detailed implementation patterns, refer to the `centralised-routes` skill.
- Environment variable validation (`env.ts`) must be centralised in `./config` (e.g. `config/env.ts`), validating client and server environment variables via Zod. Refer to the `typescript-environment-variables` skill for full details.
- Centralise static asset locations and paths (e.g. `config/assets.ts`) following a pattern similar to `ROUTES` in `centralised-routes`: define base path constants, group assets by entity/domain with object fields (e.g. `LOGO.DARK.path`, `LOGO.LIGHT.path`), and export as `as const`.
- Centralise global site metadata, navigation structure, and app-wide constants (e.g. `config/site.ts`, `config/constants.ts`) in `./config` rather than scattering them in `lib/` or root files.

```
config/
├── routes.ts                       # Centralized route definitions (see centralised-routes skill)
├── env.ts                          # Environment variable validation (see typescript-environment-variables skill)
├── assets.ts                       # Structured asset registry (e.g. ASSETS.LOGO.DARK.path)
├── site.ts                         # Site metadata, navigation links, branding info
└── constants.ts                    # Global application-wide constants
```

#### Assets Registry Pattern (`config/assets.ts`)

```typescript
const IMAGES_BASE = '/images';
const ICONS_BASE = '/icons';

export const ASSETS = {
  LOGO: {
    DARK: { path: `${IMAGES_BASE}/logo-dark.svg`, alt: 'App logo dark' },
    LIGHT: { path: `${IMAGES_BASE}/logo-light.svg`, alt: 'App logo light' },
  },
  AVATARS: {
    DEFAULT: { path: `${IMAGES_BASE}/default-avatar.png` },
    FALLBACK: { path: `${IMAGES_BASE}/fallback-cover.jpg` },
  },
  ICONS: {
    PLAY: { path: `${ICONS_BASE}/play.svg` },
    PAUSE: { path: `${ICONS_BASE}/pause.svg` },
  },
} as const;

export type Assets = typeof ASSETS;
```

---

### `app/`
**Purpose:** Routing + special files ONLY  
**Structure:** File-based routing per Next.js conventions  
**Rule:** NO business logic here

```
app/
├── layout.tsx                      # Root layout
├── page.tsx                        # Home page
├── error.tsx
├── loading.tsx
├── not-found.tsx
├── globals.css
├── songs/
│   ├── page.tsx
│   ├── [id]/
│   │   ├── page.tsx
│   │   └── _components/            # Page-specific components (underscore prefix)
│   │       └── song-details.tsx
│   └── loading.tsx
└── api/                            # API routes (if needed)
    └── webhook/
        └── route.ts
```

**Colocation rule:** Business logic stays OUT of `app/`. Routing concerns ONLY.

**Page-specific components:** Pages can include their own `_components/` subfolder (with underscore prefix, Next.js convention for non-routable folders) ONLY if the components are strictly specific to that page. Otherwise, components must be centralised in `./components`.

#### Route Groups Pattern
- Purpose: Organize routes without affecting URLs
- Syntax: `(folderName)/`
- Example: `app/(site)/page.tsx` → URL is `/`, not `/(site)`
- Use cases: Shared layouts, logical grouping, auth states

#### API Route Handlers Pattern
- Purpose: RESTful API endpoints
- Location: `app/api/[resource]/route.ts`
- Exports: GET, POST, PUT, DELETE functions
- Example structure:
```
app/api/
├── songs/
│   ├── route.ts           # /api/songs
│   └── [id]/
│       └── route.ts       # /api/songs/[id]
```

---

### `__tests__/`
**Location:** ALWAYS at the root of the project (never in nested directories or subfolders)  
**Purpose:** Unit and integration tests  
**Structure:** MIRRORS source structure  
**Rule:** Tests for `X/Y/file.ts` go in `__tests__/X/file.test.ts` (at project root)

```
__tests__/
├── actions/
│   ├── getComments.test.ts         # Tests actions/comment/get-comments.ts
│   └── deleteComment.test.ts
├── components/
│   └── CommentForm.test.tsx
├── helpers/                        # Test utilities
│   ├── mockData.ts
│   └── TestWrapper.tsx
└── lib/
    └── formatDuration.test.ts
```

**Naming:** camelCase for test files (NOT kebab-case like source files).

---

## Root-Level Files

```
.
├── biome.json                      # Default linting & formatting configuration (see migrating-eslint-prettier-to-biome)
├── proxy.ts                        # Next.js 16 request proxy (replaces middleware.ts)
├── instrumentation.ts              # Monitoring/observability hooks
├── next.config.js
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── .env.local
```

**Key patterns:**
- `biome.json` - By default, Biome is used for linting and formatting (replaces ESLint/Prettier; see `migrating-eslint-prettier-to-biome` skill)
- `config/routes.ts` - Single source of truth for all URLs (see `centralised-routes` skill)
- `config/env.ts` - Validates all env vars with Zod (see `typescript-environment-variables` skill)
- `lib/logger.ts` - Structured, non-blocking telemetry setup (see `logtape-nextjs` skill)
- `proxy.ts` - Next.js 16 uses this instead of `middleware.ts`

---

## Cross-Domain Shared Code

### When to Create Cross-Domain Folders

Create `types/music/` or `lib/music/` when types/logic are used by 3+ domains.

**Example:**
- `types/music/song-with-album.ts` - Used by songs, playlists, player, queue
- `lib/music/duration-formatter.ts` - Used everywhere songs are displayed

**Don't create:** `types/shared/` or `lib/shared/` (too generic). Name by WHAT it handles, not WHERE it's used.

---

## Special Naming Conventions

| File                     | Pattern              | Reason                               |
| ------------------------ | -------------------- | ------------------------------------ |
| DB constants             | `_db-selects.ts`     | Underscore prefix = internal/helper  |
| Page-specific components | `_components/`       | Underscore = not routable in Next.js |
| Test helpers             | `__tests__/helpers/` | Double underscore = test utilities   |
| Supabase types           | `types_db.ts`        | Matches Supabase CLI output          |

---

## Complete Example Hierarchy

```
project/
├── actions/
│   ├── _db-selects.ts
│   ├── comment/
│   ├── song/
│   └── album/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── songs/
│   └── comments/
├── components/
│   ├── comment/
│   ├── song/
│   ├── ui/
│   └── header.tsx
├── config/
│   ├── routes.ts
│   ├── env.ts
│   ├── assets.ts
│   └── constants.ts
├── hooks/
│   ├── use-player.ts
│   └── use-favourite.ts
├── lib/
│   ├── logger.ts
│   ├── utils.ts
│   ├── mappers/
│   └── music/
├── providers/
│   ├── supabase-provider.tsx
│   └── user-provider.tsx
├── schemas/
│   ├── comment/
│   └── song/
├── types/
│   ├── comment/
│   ├── song/
│   ├── music/
│   └── database/
├── utils/
│   └── supabase/
├── __tests__/
│   ├── actions/
│   ├── components/
│   └── helpers/
├── biome.json
├── proxy.ts
└── instrumentation.ts
```
