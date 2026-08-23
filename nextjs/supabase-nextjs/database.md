# Database

> Prerequisite: read `SKILL.md` first.

## Schema conventions

Default to official conventions: snake_case plural tables, `timestamptz default now()`, `uuid` primary keys (`gen_random_uuid()`), FK columns named `*_id`, ownership columns (`user_id` / `uploader_id`), junction tables with composite primary keys, and indexes on policy/filter columns (BTREE on FKs; trigram GIN for search).

Both audited projects deviate (PascalCase/camelCase quoted identifiers, `TEXT` PKs, UTC `timestamptz` + trigger-stamped `updated_at`) — **consistency beats fashion**. If you deviate, quote identifiers consistently and keep a trigger-stamped `updated_at` (pattern below).

**FK action decision table:**

| Action               | When                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `ON DELETE CASCADE`  | user-owned data meaningless without the owner (profiles, favorites)        |
| `ON DELETE SET NULL` | catalogue data that must survive the owner's deletion (products, comments) |
| `ON DELETE RESTRICT` | financial/audit rows, or where orphans are a bug                           |

## Row Level Security

**Enable RLS on every table in an exposed schema** (`public`), with least-privilege grants:

```sql
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.todos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO service_role;
```

Policies are implicit `WHERE` clauses: SELECT → `using`, INSERT → `with check`, UPDATE → both, DELETE → `using`. Always specify `TO authenticated`.

Public-read catalogue:

```sql
create policy "Todos are publicly readable"
on todos for select
using (true);
```

Ownership:

```sql
create policy "Users can update their own todos"
on todos for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

Junction tables — ownership via `EXISTS` subquery:

```sql
create policy "Playlist owner can manage songs"
on playlist_songs for all to authenticated
using (exists (
  select 1 from playlists
  where playlists.id = playlist_songs.playlist_id
    and playlists.user_id = (select auth.uid())
))
with check (exists (
  select 1 from playlists
  where playlists.id = playlist_songs.playlist_id
    and playlists.user_id = (select auth.uid())
));
```

Notes:
- `auth.uid()` is **null when unauthenticated** — write `auth.uid() IS NOT NULL AND ...` where that matters.
- `auth.jwt()` — prefer `raw_app_meta_data` over `raw_user_meta_data`; users can edit the latter via `auth.update()`.
- Role-based admin: store the role in an app table and expose it via a helper (next section), not in user-editable metadata.
- Views bypass RLS unless Postgres 15+ `with (security_invoker = true)`.
- Performance: index policy columns, wrap helpers in `(select auth.uid())` to cache per statement, add explicit `.eq()` in queries (duplicates the policy, improves plans).
- Service keys bypass RLS — never expose them to the browser.

## SECURITY DEFINER helpers

Use when a policy must read another RLS-protected table (recursion) or perform privileged work (e.g., storage cleanup). The function runs as its creator (bypasses RLS); pin `search_path`. Ideally these live in a **private schema** (`private.`) so the exposed surface stays minimal; in practice a `public.` helper like the one below is the pragmatic choice used by audited projects — keep it narrow and read-only:

```sql
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where users.supabase_auth_user_id = auth.uid()
      and users.role = 'ADMIN'
  )
$$;
```

Used in policies: `create policy "Admins can delete any todo" on todos for delete to authenticated using (public.is_admin());`

⚠️ SECURITY DEFINER bypasses RLS — keep functions narrow, pin `search_path`, and validate any app-layer inputs that flow into them.

### Calling RPCs

Grant `execute`, then call from an action (args must be JSON-serializable):

```sql
grant execute on function public.is_admin() to authenticated;
```

```ts
const { data, error } = await supabase.rpc("is_admin")
// with args: supabase.rpc("create_upload_slot", { bucket: "songs", size_bytes: 1024 })
```

RLS applies to the *caller*, but the body runs as the definer — validate inputs and never interpolate SQL. Scheduled jobs: [pg_cron](https://supabase.com/docs/guides/cron). Async HTTP calls from the DB (webhooks): [pg_net](https://supabase.com/docs/guides/database/webhooks).

## Grants

Run the per-table grant block above, or set default privileges once so future tables inherit:

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
```

Storage grants live in the `storage` schema (dashboard-managed unless you own the SQL file).

## Migrations

Canonical CLI workflow (full detail in `cli.md`):

```bash
supabase init
supabase migration new add_profiles_table   # edit supabase/migrations/<ts>_add_profiles_table.sql
supabase db reset                           # recreate local DB from migrations + seed
supabase link --project-ref <project-ref>
supabase db push                            # deploy to remote
supabase db pull                            # capture remote as a migration (needs Docker)
supabase db diff --schema public -f pending # show pending schema changes
```

`supabase_migrations.schema_migrations` tracks applied migrations; `supabase migration list` compares local vs remote; `migration repair <ts> --status applied|reverted` fixes history. Plain SQL scripts with `create table if not exists` are acceptable for small apps, but the CLI flow is the standard.

## Generated TypeScript types

Generate — treat the output as the **source of truth**:

```bash
supabase gen types typescript --linked > database.types.ts   # linked project
supabase gen types typescript --local > database.types.ts     # local stack
supabase gen types typescript --project-id <project-ref> > database.types.ts
```

Then type the clients:

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

const supabase = createClient<Database>(url, key)
// with @supabase/ssr:
createServerClient<Database, "public">(url, key, { cookies: { ... } })
```

The generated file provides `Row`/`Insert`/`Update` per table, `Tables<'name'>` / `Enums<'name'>` shorthands, and `QueryData`/`QueryResult`/`QueryError` helpers. **Antipattern:** hand-mirroring the schema in handwritten interfaces (e.g., `SupabaseClient<any>` or a committed `@ts-nocheck` copy) — it drifts; regenerate on every schema change.

## Seed data

`supabase/seed.sql` runs on `db start` / `db reset` (`--no-seed` skips). Keep it **idempotent**:

```sql
insert into public.makes (slug, name)
values ('toyota', 'Toyota'), ('honda', 'Honda')
on conflict (slug) do nothing;
```

Storage buckets can be seeded from `config.toml` (`supabase seed buckets`) — see `cli.md`.

## Error handling

- **PGRST116** ("no rows") — `.single()` throws it. Use `.maybeSingle()` for optional rows; where `.single()` is required, tolerate `code === "PGRST116"` explicitly.
- **23505** (unique violation) — parallel inserts racing. Re-fetch the existing row instead of failing:

```ts
// ensureProfile: PGRST116/23505-tolerant insert-or-fetch
const { data: existing } = await supabase
  .from("profiles").select("*").eq("id", userId).maybeSingle()
if (existing) return existing

const { data: created, error } = await supabase
  .from("profiles").insert({ id: userId, ...meta }).select().single()
if (error && error.code === "23505") {
  // lost the race — fetch the row another request created
  return (await supabase.from("profiles").select("*").eq("id", userId).single()).data
}
return created
```

- **429** — rate limited (auth flows, storage). Surface it; don't retry blindly (see `cli.md` and the auth rate-limits guide).
- Log structured errors and return neutral values — never throw across the boundary (cross-ref `conventions.md` §5).

## Common Mistakes

- Missing `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` — table is world-readable/writable; missing grants → anonymous 401s.
- Trusting `raw_user_meta_data` (or `getSession()` user data) for authorization — users can edit it.
- Policy recursion without a SECURITY DEFINER helper; `auth.uid()` compared without the unauthenticated-null check.
- Handwritten types drifting from the real schema, or `SupabaseClient<any>`.
- Non-idempotent seeds failing on re-run.
- Ignoring PGRST116/23505 instead of handling them explicitly.

Official docs: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) · [gen types](https://supabase.com/docs/reference/cli/supabase-gen-types) · [Generating types](https://supabase.com/docs/reference/javascript/installing#generating-types) · [Local development (migrations)](https://supabase.com/docs/guides/cli/local-development)
