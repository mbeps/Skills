# Setup: install, config, db client, scripts

Patterns verified against three Next.js + PostgreSQL projects (drizzle-orm 0.45.x, drizzle-kit 0.31.x); general Drizzle API facts beyond those projects are marked as such.

## Install

```bash
npm i drizzle-orm pg          # driver: node-postgres
npm i -D drizzle-kit @types/pg
```

Other Postgres drivers: `postgres` (postgres.js — prepared statements by default, may need opting out in some hosted environments) or `@neondatabase/serverless` (Neon serverless). All are wired the same way: `drizzle(url, { schema })` from the matching import path (`drizzle-orm/postgres-js`, `drizzle-orm/neon-http`, etc.).

## drizzle.config.ts

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",   // file or folder (glob); folder = all files recursively
  out: "./drizzle/migrations",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- `schema` may point at a barrel file or a directory — drizzle-kit imports every exported model. Everything you want migrated MUST be exported.
- Use `env.DATABASE_URL` from a Zod-validated env module (`lib/env.ts`) instead of raw `process.env` when the project has one, so config fails fast on missing vars.
- Filters: `tablesFilter`, `schemaFilter`, `extensionsFilters` (e.g. `["postgis"]`) tell drizzle-kit which tables to manage — needed when the DB has extension-owned tables.
- Serverless connection pools (Neon, Supabase, PgBouncer): add `pgBouncer: true` so generate/migrate drop session-only SQL; `strict: true` makes `generate` fail instead of emitting unsafe statements.
- Multiple configs: `drizzle-kit generate --config=drizzle-prod.config.ts`.

## db client (`drizzle/db.ts`)

```ts
// drizzle/db.ts
import { env } from "@/lib/env";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const db = drizzle(env.DATABASE_URL, { schema });
```

- **`{ schema }` is required for `db.query.*`** (relational query API) — and relation objects must be included in that same schema object for `with:` to work. Without schema, only `db.select/insert/update/delete` exist.
- `logger: true` in the config (`drizzle(url, { schema, logger: true })`) prints generated SQL to the server console — handy for debugging queries.
- node-postgres builds a connection pool internally from the URL; a single module-level `db` is the App Router pattern (no per-request client). No `pg.Pool` wrapper is needed unless you must pass custom pool options — then `drizzle({ client: pool })`.
- In serverless edge runtimes prefer a driver that works there (Neon HTTP, postgres.js); node-postgres is Node-only (route handlers + server actions are fine).
- Import `db` only from server code ("use server" actions, route handlers). Keep it out of client components.

## package.json scripts

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:push": "drizzle-kit push"
}
```

| Command                | What it does                                                                                     | When                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `drizzle-kit generate` | Diffs schema vs `meta/_snapshot.json`, writes `<out>/NNNN_name.sql` + updates journal + snapshot | Every schema change (code-first)                                       |
| `drizzle-kit migrate`  | Applies pending migrations from the journal to the DB (tracks applied ones)                      | After generate, before/at deploy                                       |
| `drizzle-kit push`     | Diffs schema directly against the live DB, applies without SQL files                             | Prototyping; NOT for schema evolution with generated/extension columns |
| `drizzle-kit studio`   | Browser UI for browsing/editing data                                                             | Ad-hoc inspection                                                      |

## Env validation

`DATABASE_URL` should be validated at module load. Pattern used in production apps: Zod schema in `lib/env.ts` (or `env.ts` at root), imported by both `drizzle.config.ts` and `drizzle/db.ts`.

```ts
// lib/env.ts
import { z } from "zod";
const envSchema = z.object({ DATABASE_URL: z.string().min(1) });
export const env = envSchema.parse(process.env);
```

**Next.js note:** only `NEXT_PUBLIC_*` vars reach the client — `DATABASE_URL` stays server-only. Never import `drizzle/db` (or anything importing it) into client components.

Official docs: [Get started PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) · [drizzle.config.ts](https://orm.drizzle.team/docs/drizzle-config-file) · [drizzle-kit push config](https://orm.drizzle.team/docs/drizzle-kit-push)
