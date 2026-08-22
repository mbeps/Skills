# Directory Structure Reference

Complete guide to folder organization in Next.js App Router projects with domain-based structure.

## Top-Level Folders

### `actions/`
**Purpose:** All server-side mutations and data fetching  
**Structure:** `actions/[domain]/[action-name].ts`  
**Rule:** ALL server actions here, even if used once

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
**Rule:** No barrel exports; one type per file

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

### `components/`
**Purpose:** All React components  
**Structure:** `components/[domain]/[component-name].tsx`  
**Rule:** One component per file; no co-located sub-components

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
**Rule:** `use-` prefix; hooks are inherently cross-domain

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
**Purpose:** Business logic, utilities, shared helpers  
**Structure:** Domain-organized when specific, flat when generic

```
lib/
├── env.ts                          # Environment variable validation (Zod)
├── logger.ts
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

**Page-specific components:** Use `_components/` subfolder with underscore prefix (Next.js convention for non-routable folders).

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
**Purpose:** Unit and integration tests  
**Structure:** MIRRORS source structure  
**Rule:** Tests for `X/Y/file.ts` go in `__tests__/X/file.test.ts`

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
├── routes.ts                       # Centralized route definitions (see centralised-routes skill)
├── proxy.ts                        # Next.js 16 request proxy (replaces middleware.ts)
├── instrumentation.ts              # Monitoring/observability hooks
├── next.config.js
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── .env.local
```

**Key patterns:**
- `routes.ts` - Single source of truth for all URLs (see `centralised-routes` skill)
- `lib/env.ts` - Validates all env vars with Zod (see `typescript-environment-variables` skill)
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
├── hooks/
│   ├── use-player.ts
│   └── use-favourite.ts
├── lib/
│   ├── env.ts
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
├── routes.ts
├── proxy.ts
└── instrumentation.ts
```
