# Infrastructure & Configuration Reference

Detailed guide for infrastructure, utility libraries, context providers, and centralised configurations in Next.js App Router projects.

## `lib/`

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

## `utils/`

**Purpose:** Infrastructure clients, database connections, and low-level SDK instances  
**Structure:** Technology-organized  
**Rule:** Third-party client initialization only. No business logic.

```
utils/
├── db/                             # Database client initializers (when placed in utils/)
│   ├── drizzle.ts                  # Drizzle ORM client (drizzle-orm with node-postgres / pg)
│   ├── mongo.ts                    # MongoDB client / connection helper
│   └── data-source.ts              # TypeORM DataSource singleton
└── supabase/
    ├── client.ts                   # Browser client
    ├── server.ts                   # Server client
    └── middleware.ts               # Middleware client (if using middleware)
```

**Database client placement:**
- **Drizzle ORM:** Typically configured in `drizzle/db.ts` (with schemas under `drizzle/schemas/*.ts`) or `lib/db/` / `utils/db/drizzle.ts`.
- **TypeORM:** Configured as a singleton `DataSource` with connection lock protection in `database/data-source.ts` (with entities in `database/entities/` or `entities/`).
- **MongoDB:** Client singleton in `utils/db/mongo.ts` or `lib/mongodb.ts`.

**vs lib/:** `utils/` = infrastructure; `lib/` = business logic.

---

## `providers/`

**Purpose:** React Context providers  
**Structure:** `providers/[name]-provider.tsx` (FLAT)

```
providers/
├── supabase-provider.tsx           # Manages Supabase client
├── user-provider.tsx               # User session/details context
├── modal-provider.tsx              # Modal mount point
├── logging-provider.tsx
└── providers.tsx                   # Central provider stack (wrapping NuqsAdapter, theme, tooltips)
```

**Pattern:** Providers wrap `app/layout.tsx`, providing global context. When using `nuqs`, wrap root children with `<NuqsAdapter>` inside the provider tree.

---

## `config/`

**Purpose:** Centralised application configuration, routes, environment variables, asset locations, and global constants  
**Structure:** `config/[name].ts`  
**Rules:**
- Application routes must be centralised under `./config` (e.g. `config/routes.ts`). Keep path definitions and dynamic route helpers here without mixing in auth or navigation logic. For detailed implementation patterns, refer to the `centralised-routes` skill.
- Environment variable validation (`env.ts`) must be centralised in `./config` (e.g. `config/env.ts`), validating client and server environment variables via Zod. Refer to the `typescript-environment-variables` skill for full details.
- Centralise static asset locations and paths (e.g. `config/assets.ts`) following a pattern similar to `ROUTES` in `centralised-routes`: define base path constants, group assets by entity/domain with object fields (e.g. `LOGO.DARK.path`, `LOGO.LIGHT.path`), and export as `as const`.
- Centralise global site metadata, branding, and app-wide configurations in `./config` (e.g. `config/site.ts`, `config/constants.ts`, `config/prompts.ts`, `config/languages.ts`). Always define the actual, distinct project name (e.g. "Personal Portfolio", "BeatPulse") rather than generic boilerplate like "Next App" or "Create Next App". Domain-specific error classes, exception hierarchies, and procedural utilities belong in `lib/` (e.g. `lib/errors.ts`) or `lib/[domain]/`.

```
config/
├── routes.ts                       # Centralized route definitions (see centralised-routes skill)
├── env.ts                          # Environment variable validation (see typescript-environment-variables skill)
├── site.ts                         # Site metadata, branding, and app info
├── ui.ts                           # UI layout dimensions, cookie keys, and keyboard shortcuts
├── assets.ts                       # Structured asset registry (e.g. ASSETS.LOGO.DARK.path)
└── [domain].ts                     # Feature/domain configurations (e.g. knowledgebase.ts, rag.ts, prompts.ts)
```

### Assets Registry Pattern (`config/assets.ts`)

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

