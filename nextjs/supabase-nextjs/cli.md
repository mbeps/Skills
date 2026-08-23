# Supabase CLI & Local Development

> Prerequisite: read `SKILL.md` first.

## Install & init

```bash
npm install supabase --save-dev    # or: brew install supabase/tap/supabase
supabase init                      # creates supabase/config.toml
supabase login                     # access token → native store
supabase link --project-ref <project-ref>
```

For CI, use the `SUPABASE_ACCESS_TOKEN` env var instead of `supabase login`.

## Local stack

```bash
supabase start      # API 54321 · DB 54322 · Studio 54323 · Inbucket/Mailpit 54324
supabase status     # -o env exports JWT_SECRET / ANON_KEY / SERVICE_ROLE_KEY for local env
supabase stop       # keeps volumes; --no-backup wipes data
```

Needs ≥ 7GB RAM; exclude services with `-x` (e.g., `-x realtime`). Local emails land in the built-in email catcher — Inbucket/Mailpit (port 54324). `supabase status -o env` gives you the local keys to populate `.env.local`.

## Migrations workflow

```bash
supabase migration new add_profiles_table    # creates supabase/migrations/<ts>_add_profiles_table.sql
# edit the SQL, then:
supabase db reset                             # recreate local DB from migrations + seed (--no-seed skips seed)
supabase db push                              # push migrations to the linked remote
supabase db pull                              # capture remote state as a migration (needs Docker;
                                              # if supabase/migrations is empty it ignores --schema — pull twice)
supabase db diff --schema public -f pending   # generate a migration from pending schema changes
supabase migration list                       # compare local vs remote
supabase migration repair <ts> --status applied|reverted   # fix history drift
```

CI quality gates: `supabase db lint --fail-on error` (plpgsql_check) and `supabase test db` (pgTAP).

## Type generation

```bash
supabase gen types typescript --linked > database.types.ts    # from linked project
supabase gen types typescript --local > database.types.ts     # from local stack
supabase gen types typescript --project-id <ref> > database.types.ts
# flags: --lang typescript|go|swift|python, --schema a,b, --db-url <url>, --postgrest-v9-compat
```

Wire it into a script (`"types": "supabase gen types typescript --linked > database.types.ts"`) and **commit the output**. Regenerate on every schema change (see `database.md` §7).

## Seeds

`supabase/seed.sql` runs on `db start` / `db reset`. Keep inserts idempotent (`ON CONFLICT ... DO NOTHING`). Storage buckets can live in `config.toml` and be seeded with `supabase seed buckets`:

```toml
[storage.buckets.images]
public = false
file_size_limit = "50MiB"
allowed_mime_types = ["image/png", "image/jpeg"]
objects_path = "./images"
```

## config.toml

```toml
[auth.email]
enable_confirmations = true

[auth.external.github]
enabled = true
client_id = "env(SUPABASE_AUTH_GITHUB_CLIENT_ID)"      # resolved from local .env
client_secret = "env(SUPABASE_AUTH_GITHUB_CLIENT_SECRET)"

[auth.passkey]
enabled = true

[auth.webauthn]
rp_id = "example.com"
rp_origins = ["https://example.com"]
```

`env(...)` values are auto-substituted from your local `.env`. Restart the stack after config changes: `supabase stop && supabase start`. Passkey/webauthn blocks cross-ref `authentication.md`.

## CI / scripting

- Set `SUPABASE_ACCESS_TOKEN` in CI.
- Run `supabase db lint --fail-on error` before pushing migrations.
- Build-secrets pattern: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only, optional). ⚠️ Standardize key naming across environments — audited projects mix `ANON`/`PUBLISHABLE` legacy names; pick one scheme (see `conventions.md` §2).

## Common Mistakes

- Forgetting `supabase link` before `db push` → "project not linked" errors.
- `db reset` wiping local data when you meant to keep it (know `--no-seed` / backups).
- Generating types against the wrong environment (`--linked` vs `--local`).
- Running `db pull` without Docker.
- Putting secrets in `config.toml` instead of `env()` refs.
- Not committing `database.types.ts` / not regenerating on schema change.

Official docs: [Supabase CLI](https://supabase.com/docs/guides/cli) · [CLI reference](https://supabase.com/docs/reference/cli/introduction) · [Local development](https://supabase.com/docs/guides/cli/local-development)
