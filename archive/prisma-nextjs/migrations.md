# Migrations: workflow, db push vs migrate, baselining

## The workflow (every schema change)

1. Edit `prisma/schema.prisma`
2. Run `npx prisma generate` — Prisma 6 does this automatically on `migrate dev`; Prisma 7 does NOT, so run it explicitly
3. Run `npx prisma migrate dev --name <name>`
4. Review the generated SQL before it's applied

```bash
npx prisma migrate dev --name add-execution-status
```

`migrate dev` creates a migration file, applies it to the dev database, and (v6) regenerates the client. Dev-only — never run it against production.

## migrate dev vs db push

|                   | `migrate dev`                      | `db push`         |
| ----------------- | ---------------------------------- | ----------------- |
| Migration history | yes (files in `prisma/migrations`) | no                |
| Reviewable SQL    | yes                                | no                |
| Prod-safe         | no                                 | no                |
| Use for           | real schema evolution              | quick prototyping |

`db push` syncs the schema directly with no history. Fine for a scratch database, never on production.

## Production & CI (migrate deploy)

`prisma migrate deploy` applies pending migrations in order, non-interactively, without a shadow database. It does NOT run `prisma generate`.

CI/prod pipeline:

```bash
npx prisma generate && npx prisma migrate deploy && next build
```

## Baselining an existing database

When an existing database already has data (can't reset), mark its current state as the baseline:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/0_init/migration.sql
npx prisma migrate resolve --applied 0_init
```

- The `0_` prefix keeps the baseline first in lexicographic order
- `migrate resolve --applied` records the migration as applied WITHOUT executing it
- `migrate deploy` then skips the baseline and applies only newer migrations
- Repeat `resolve` on every existing environment (prod, staging); fresh environments just run `deploy` normally
- If the schema drifted from prod reality, align `schema.prisma` first (via `prisma db pull`), then baseline
- In Prisma 7, `migrate diff` uses `--from-config-datasource`/`--to-config-datasource` instead of `--from-url`/`--to-url`; `--schema`/`--url` flags are removed from `db execute`. The `--from-empty` workflow above works in both versions.
- `migrate diff --from-empty` needs no database connection, so baselining works in CI without `DATABASE_URL`

## Drift & resets

`migrate dev` detects drift between migration history and the database and offers a reset in dev. `migrate reset` drops the database — dev-only. Never reset or `db push` on production. To inspect drift on prod, use `migrate diff` before fixing.

## Troubleshooting

| Symptom                                   | Fix                                                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| v7 client types stale after schema change | run `prisma generate` explicitly (v7 never auto-runs it)                                           |
| P1000/P1001 can't reach database          | check `DATABASE_URL` host/port and that Postgres is up                                             |
| P1010 SSL error (self-signed certs, v7)   | `new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } })`                           |
| `env()` throws "missing variable" in CI   | use `process.env.DATABASE_URL!` for vars that aren't always set                                    |
| v7 query hangs instead of timing out      | pg default `connectionTimeoutMillis` is 0 (v6 used 5s) — pass `connectionTimeoutMillis` explicitly |

## Schema-change checklist

- [ ] `prisma generate` first (mandatory on v7)
- [ ] Review the generated SQL
- [ ] Apply with `migrate dev` locally
- [ ] `migrate deploy` in CI
- [ ] Never `db push` or `migrate reset` on production

## Official docs

- https://www.prisma.io/docs/orm/prisma-migrate
- Baselining: https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
