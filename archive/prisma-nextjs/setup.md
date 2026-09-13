# Setup: install, config, db client, scripts

## Install

Prisma 6 (classic):

```bash
npm i -D prisma
npm i @prisma/client
```

Prisma 7 additionally needs the Postgres driver adapter and dotenv:

```bash
npm i -D prisma
npm i @prisma/client @prisma/adapter-pg
npm i dotenv
```

With the new `prisma-client` generator, `@prisma/client` is only needed at generate time — it can live in `devDependencies` (the generated client is self-contained).

Prisma 7 also requires `"type": "module"` in `package.json`, Node 20.19+, and TypeScript 5.4+.

## prisma.config.ts

Prisma 7 only — required at the project root. The CLI does NOT auto-load `.env`, so import `dotenv/config` first:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

- `env()` throws when the variable is missing — this breaks `prisma generate` in CI that has no `DATABASE_URL`. For optional vars use `process.env.DATABASE_URL!` directly.
- `migrations.path` is the migration directory. `migrations.seed` can point at a seed script, since seeding no longer auto-runs after `migrate dev`/`reset` in v7 — run `prisma db seed`.
- Prisma 6 needs no config file: it reads `url = env("DATABASE_URL")` from the schema and auto-loads `.env`.

## Schema generator & datasource

Prisma 6:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Prisma 7:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/generated/prisma" // REQUIRED in v7
}

datasource db {
  provider = "postgresql"
}
```

The v7 `output` path is where you import the client from (`@/lib/generated/prisma/client`). `directUrl` is removed from the datasource — set `datasource.url` in `prisma.config.ts` for migrations instead. `prisma-client-js` will be removed in a future release.

## db client (lib/db.ts)

Prisma 6 style:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

Prisma 7 style (driver adapter required):

```ts
import { PrismaClient } from "@/lib/generated/prisma/client"; // /client subpath is required in v7
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

The generated folder also emits `browser.ts` and `enums.ts` — use those for Edge/frontend type imports; `client.ts` is Node-only.

v7 `PrismaPg` uses `pg` pool defaults: max 10, no idle timeout, and no connection timeout (0), vs Prisma 6's 5s — a dead DB hangs queries instead of failing fast. Restore v6 behavior with `new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 })`.

The globalThis cache stops Next.js dev HMR from opening a new connection pool per module reload. Import this singleton in Server Components, Server Actions, and Route Handlers only.

## package.json scripts

```json
{
  "postinstall": "prisma generate",
  "build": "prisma generate && next build",
  "db:generate": "prisma generate",
  "db:push": "prisma db push",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio"
}
```

On Prisma 7 the `generate` in `build`/`postinstall` is mandatory — neither `migrate dev` nor `db push` runs it automatically.

## Env validation

Optional but recommended: validate `DATABASE_URL` at startup with zod (as in ai-workflow-automations `lib/env.ts`):

```ts
import { z } from "zod";

export const env = z
  .object({
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]),
  })
  .parse(process.env);
```

Note the split: the Prisma 7 CLI reads `.env` only through `dotenv/config` in `prisma.config.ts`; the Next.js runtime loads `.env` itself.

## Official docs

- https://www.prisma.io/docs/orm/reference/prisma-config-reference
- Upgrade guide: https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
