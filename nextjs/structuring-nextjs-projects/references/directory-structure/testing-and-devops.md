# Testing, DevOps & Root Conventions Reference

Guide for tests layout, Docker containerization, root files, cross-domain code, and overall hierarchy.

## `__tests__/`

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

## `docker/`

**Purpose:** Dockerfiles, compose specifications, and container configuration for the Next.js app and stack services (databases, caches, proxies)  
**Structure:** Subdirectories per service (`docker/next/`, `docker/postgres/`, etc.) with root orchestration  
**Rule:** Keep all container assets centralised under `docker/` to avoid polluting the project root

```
docker/
├── README.md                       # High-level container architecture & usage commands
├── docker-compose.yml              # Multi-container orchestration (context: ..)
├── next/
│   ├── Dockerfile                  # Next.js multi-stage build (builder, release)
│   └── README.md                   # Next.js container documentation
└── [service]/                      # Additional stack services (e.g., postgres, redis)
    ├── Dockerfile                  # Service-specific build/configuration
    └── init.sql                    # Initial schemas or seeds
```

- Build context in `docker-compose.yml` points to the project root (`..`) so the Dockerfile has access to the full source tree while keeping the Docker assets organised.

---

## Root-Level Files

```
.
├── .github/
│   └── workflows/
│       └── merge.yml               # CI/CD pipeline (lint, build, test, docker, Node 24/26 matrix)
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
- `.github/workflows/merge.yml` — CI/CD pipeline triggered on PRs to `main`, validating linting/formatting, building, testing, and Docker Compose across the latest 2 Node LTS versions (currently Node 24 and Node 26).
- `biome.json` — By default, Biome is used for linting and formatting (replaces ESLint/Prettier; see `migrating-eslint-prettier-to-biome` skill).
- `config/routes.ts` — Single source of truth for all URLs (see `centralised-routes` skill).
- `config/env.ts` — Validates all env vars with Zod (see `typescript-environment-variables` skill).
- `lib/logger.ts` — Structured, non-blocking telemetry setup (see `logtape-nextjs` skill).
- `proxy.ts` — Next.js 16 uses this instead of `middleware.ts`.

---

## Cross-Domain Shared Code

### When to Create Cross-Domain Folders

Create `types/music/` or `lib/music/` when types/logic are used by 3+ domains.

**Example:**
- `types/music/song-with-album.ts` — Used by songs, playlists, player, queue
- `lib/music/duration-formatter.ts` — Used everywhere songs are displayed

**Don't create:** `types/shared/` or `lib/shared/` (too generic). Name by WHAT it handles, not WHERE it's used.

---

## Special Naming Conventions

| File | Pattern | Reason |
| --- | --- | --- |
| DB constants | `_db-selects.ts` | Underscore prefix = internal/helper |
| Page-specific components | `_components/` | Underscore = not routable in Next.js |
| Test helpers | `__tests__/helpers/` | Double underscore = test utilities |
| Supabase types | `types_db.ts` | Matches Supabase CLI output |

---

## Complete Example Hierarchy

```
project/
├── .github/
│   └── workflows/
│       └── merge.yml
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
│   ├── ui/                         # Shadcn UI primitives (Base UI + Tailwind CSS)
│   └── header.tsx
├── config/
│   ├── routes.ts
│   ├── env.ts
│   ├── assets.ts
│   └── constants.ts
├── docker/
│   ├── README.md
│   ├── docker-compose.yml
│   └── next/
│       └── Dockerfile
├── drizzle/                        # Drizzle ORM (when using Drizzle)
│   ├── db.ts
│   └── schemas/
├── hooks/
│   ├── use-player.ts
│   └── use-favourite.ts
├── stores/                         # Dedicated client state stores (Zustand)
│   └── player-store.ts
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
│   ├── db/
│   └── supabase/
├── __tests__/
│   ├── actions/
│   ├── components/
│   └── helpers/
├── biome.json
├── proxy.ts
└── instrumentation.ts
```

