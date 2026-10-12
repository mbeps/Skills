# Tooling & Library Standards

Centralised tooling and library standards for Next.js App Router projects with domain-based structure.

## Required Tools & Libraries (Every Next.js Project)

Every Next.js project following these conventions must configure and include the following baseline tools and libraries:

1. **Next.js App Router (`next`)**: Core framework utilizing `app/` directory routing, Turbopack, and React Server Components (RSC).
2. **TypeScript (`typescript`)**: Configured with strict mode enabled (`"strict": true` in `tsconfig.json`) and `@/*` absolute path alias.
3. **Biome (`@biomejs/biome`)**: Required by default for linting, code formatting, and import sorting via `biome.json` (replaces legacy ESLint and Prettier).
4. **Tailwind CSS (`tailwindcss`, `postcss`, `autoprefixer`)**: Required utility-first styling engine across components, layouts, and data tables.
5. **Class Utilities (`clsx`, `tailwind-merge`)**: Required conditional class concatenation and conflict merging helper (`cn()` in `lib/utils.ts`).
6. **Zod (`zod`)**: Required schema validation engine for central environment validation (`config/env.ts`), domain validation schemas (`schemas/`), and Server Action inputs.
7. **Nuqs (`nuqs`)**: Required type-safe URL query parameter state manager. Wrap root layout/providers with `<NuqsAdapter>` and enforce `clearOnDefault: true`.
8. **LogTape (`@logtape/logtape`)**: Required structured telemetry logger configured in `lib/logger.ts` for non-blocking sinks and log level control (replaces raw `console.log`).
9. **Vitest & React Testing Library (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`)**: Required unit/integration testing suite located under the project root `__tests__/` directory (`vitest.config.ts`).
10. **Docker & Multi-Stage Containers (`docker/`)**: Required containerization assets (`docker/next/Dockerfile` multi-stage build, `docker/docker-compose.yml`).
11. **GitHub Actions CI/CD (`.github/workflows/merge.yml`)**: Required PR validation pipeline running Biome checks, Turbopack build, test coverage, and Docker compose smoke tests across latest 2 Node LTS versions (`24.x` and `26.x`).

---

## Default Recommended Tools & Libraries (When Needed)

These tools are not mandatory for every project, but serve as default recommendations whenever a project requires their respective capabilities:

- **Shadcn UI (with Base UI primitives):** Default React components and accessible headless primitives (located under `components/ui/`).
- **Zustand:** Default client-side dedicated state management solution (located under `stores/` or `hooks/`) when local React state or Context is insufficient.
- **BlockNote:** Default interactive block-based rich text / markdown editor (dynamically imported with `ssr: false` under `components/[domain]/`).
- **Drizzle, TypeORM, or MongoDB:** Default database persistence solutions depending on use case:
  - **Drizzle ORM:** Default for SQL/PostgreSQL projects requiring type-safe schema-first queries and lightweight migrations (`drizzle/` or `db/`).
  - **TypeORM:** Default enterprise Data Mapper ORM supporting SQL and document databases (`database/data-source.ts`).
  - **MongoDB:** Default document database (via Mongoose or TypeORM Mongo driver).
- **mcp-handler:** Default framework when exposing or creating an MCP (Model Context Protocol) server from a Next.js App Router application (`app/api/mcp/route.ts` with Streamable HTTP).

---

## Related Skills

- `centralised-routes` — Routes must be centralised under a `./config` folder (e.g., `config/routes.ts`).
- `typescript-environment-variables` — Environment variables and validation must be centralised under `./config` (e.g., `config/env.ts`).
- `logtape-nextjs` — Structured telemetry and logging setup (`lib/logger.ts`).
- `migrating-eslint-prettier-to-biome` — Biome is used by default for linting and formatting (replaces ESLint/Prettier).
- `drizzle-nextjs` — Drizzle ORM setup, schema definitions, and migrations.
- `typeorm-nextjs` — TypeORM DataSource singleton and entity conventions.
- `blocknote-nextjs` — BlockNote dynamic import (`ssr: false`) and custom editor setups.
- `mcp-nextjs` — Exposing MCP servers in Next.js using `mcp-handler` with Streamable HTTP.

