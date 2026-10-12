# Directory Structure Reference

Complete guide to folder organization in Next.js App Router projects with domain-based structure.

To keep documentation modular and focused, the directory structure guide is decomposed into the specialized reference documents below.

---

## Directory Reference Documents

| Document | Focus & Coverage |
| --- | --- |
| [Tooling & Library Standards](directory-structure/tooling-and-libraries.md) | Baseline required tools (Next.js, Biome, Tailwind, Zod, Nuqs, LogTape, Vitest, Docker, CI/CD) and default recommended tools (Shadcn/Base UI, Zustand, BlockNote, Drizzle/TypeORM/MongoDB, mcp-handler). |
| [Domain Application Layers](directory-structure/domain-layers.md) | Conventions and layout for `actions/`, `types/`, `enums/`, `components/`, `schemas/`, `hooks/`, and dedicated Zustand `stores/`. |
| [Infrastructure & Configuration](directory-structure/infrastructure-and-config.md) | Conventions for `lib/` (mappers, logger), `utils/` (database and cloud clients), `providers/` (Nuqs, themes), and `./config/` (routes, env, site, and Assets Registry pattern). |
| [App Routing & Special Files](directory-structure/app-routing.md) | Organization of `./app`, root special files (`not-found.tsx`, `loading.tsx`, `error.tsx`), dynamic route 404s, page-specific `_components/`, route groups, and API/MCP route handlers. |
| [Testing, DevOps & Root Conventions](directory-structure/testing-and-devops.md) | Root-level `__tests__/` mirroring, `docker/` containerization, root config files, cross-domain shared folders, special naming rules, and complete project tree hierarchy. |

---

## Folder Summary

| Folder | Purpose | Example |
| --- | --- | --- |
| `actions/[domain]/` | Server Actions only | `actions/comment/get-comments.ts` |
| `types/[domain]/` | TypeScript types/interfaces | `types/comment/comment-with-author.ts` |
| `enums/` or `enum/` | TypeScript enums (allowed folder) | `enums/car/car-status.ts`, `enum/role.ts` |
| `components/[domain]/` | Shared React components (centralised) | `components/comment/comment-list.tsx` |
| `app/path/_components/` | Page-specific components ONLY | `app/songs/[id]/_components/song-details.tsx` |
| `schemas/[domain]/` | Zod validation schemas | `schemas/comment/create-comment.schema.ts` |
| `config/` | Centralised routes, env, assets, app configurations & constants | `config/routes.ts`, `config/env.ts`, `config/prompts.ts`, `config/assets.ts` |
| `hooks/` | Custom React hooks (flat) | `hooks/use-player.ts` |
| `stores/` | Dedicated client state stores (Zustand) | `stores/player-store.ts` |
| `lib/` | Business logic, utilities, domain errors, logging | `lib/mappers/comment.ts`, `lib/errors.ts`, `lib/logger.ts` |
| `utils/` | Infrastructure clients | `utils/supabase/server.ts`, `utils/db/mongo.ts` |
| `providers/` | React Context providers | `providers/modal-provider.tsx`, `providers/providers.tsx` |
| `app/` | Routing + special files ONLY (must include root `not-found.tsx`, `loading.tsx`, `error.tsx`) | `app/songs/[id]/page.tsx`, `app/not-found.tsx` |
| `docker/` | Docker & container configurations for Next.js app and stack services | `docker/docker-compose.yml`, `docker/next/Dockerfile`, `docker/postgres/` |
| `__tests__/[category]/` | Tests (always at project root, mirrors structure) | `__tests__/actions/getComments.test.ts` |

