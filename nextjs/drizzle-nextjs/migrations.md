# Migrations: drizzle-kit workflow & gotchas

Code-first migrations: the TypeScript schema in `drizzle/schemas/` is the source of truth; drizzle-kit diffs it against snapshots and writes SQL.

## The workflow (do this every schema change)

```bash
npm run db:generate     # 1. diff schema vs meta/_snapshot.json → writes NNNN_name.sql + updates journal + snapshot
# 2. REVIEW the generated SQL — never apply blindly
npm run db:migrate      # 3. apply pending migrations (tracks applied ones in a __drizzle_migrations table)
```

1. **Edit** the schema file(s). New file → add its `export *` line to `drizzle/schema.ts`.
2. `db:generate` writes `<out>/<nextIdx>_<random>.sql` (e.g. `0034_greedy_elephant.sql`) and updates:
   - `meta/_journal.json` — ordered list of `{ idx, version: "7", tag: "0034_...", when, breakpoints }` entries
   - `meta/_snapshot.json` — full-schema snapshot used as the diff base for the NEXT generate (generate does not read the live DB)
3. **Review the SQL.** For custom/adhoc SQL (data backfills, `GENERATED ALWAYS AS` columns, extensions, indexes the builder can't emit), hand-edit the `.sql` AFTER generate. The journal/snapshot still record the change — hand edits are preserved because generate diffs schema vs snapshot, not vs SQL.
4. Optional project convention: rename the migration descriptively — rename the `.sql` file AND the matching `tag` in `_journal.json` together (`0034_add_tags_and_project_tags`). drizzle-kit `migrate` resolves files by tag, so **file name and journal tag must match**.
5. `db:migrate` applies. In CI/CD, run it as a deploy step (`drizzle-kit migrate`), or call `migrate()` from `drizzle-orm/node-postgres/migrator` at boot if you prefer runtime migrations.

> Serverless pool (Neon/Supabase + PgBouncer): set `pgBouncer: true` in `drizzle.config.ts` so generate/migrate omit session-only SQL; consider `strict: true` so `generate` fails rather than emitting unsafe statements.

## What generates what (Postgres)

- New table → `CREATE TABLE` + `ALTER TABLE ... ADD CONSTRAINT ..._fkey` + `CREATE INDEX` (from your index declarations).
- New column with default → `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` (+ `NOT NULL` where declared).
- `pgEnum` → `CREATE TYPE ... AS ENUM`. Adding an enum value later → `ALTER TYPE ... ADD VALUE` (note: cannot run inside a transaction block in older Postgres — drizzle-kit may split it).
- Changed/dropped columns → `ALTER TABLE ... DROP COLUMN` etc. **Data-loss statements require review** — generate prints them, don't `--force` blindly.

## `db:push` — when it's fine and when it bites

`drizzle-kit push` diffs the schema directly against the live DB and applies immediately, without SQL files. Good for prototyping, bad for anything with columns the builder can't round-trip:

- **Generated columns** (`GENERATED ALWAYS AS ... STORED` — added via hand-written migrations because Drizzle has no native API for them) get converted to regular columns by push. This is a documented footgun — the migration comment in real projects says exactly this ("db:push converts the generated column to a regular column, restore manually with ALTER TABLE").
- Extension-owned types/columns (pgvector `vector`, PostGIS) can be mis-diffed. Use `extensionsFilters: ["postgis"]` to make drizzle-kit ignore extension tables.
- Teams and prod: use generate + migrate. If you must push, `--explain` (dry-run) and `--verbose` first; `--force` auto-accepts data loss.

## `drizzle-kit studio`

`npm run db:studio` opens a browser UI on your database. Use it to inspect/verify data after migrations, not for schema changes.

## Troubleshooting

| Symptom                                                                  | Cause / fix                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generate creates a migration undoing your hand-edited SQL                | Snapshot drifted — the hand edit wasn't recorded because you edited SQL only; keep file + journal tag in sync and prefer editing SQL after generate (snapshot updates anyway), or hand-patch the snapshot for structural changes. |
| Duplicate journal tags / orphan `.sql` files not in the journal          | Someone renamed files or hand-added migrations. Harmless for `migrate` (it only applies journaled tags), but don't renumber; leave as-is or fix carefully.                                                                        |
| `migrate` says nothing to apply but DB is out of sync                    | `migrate` only runs journaled tags; if the DB was modified out-of-band (or `push` was used), journal and DB disagree — reconcile with a corrective migration.                                                                     |
| `ALTER TYPE ... ADD VALUE` error "cannot run inside a transaction block" | Postgres limitation; drizzle-kit handles it, but if you hand-write it, avoid wrapping in a transaction.                                                                                                                           |
| `Cannot find module` for schema import in drizzle.config.ts              | Config runs in Node — imports must be resolvable (paths, extensions). Keep `schema` path relative from project root.                                                                                                              |
| Duplicate tag/snapshot warnings after rename                             | You renamed the `.sql` but not the journal `tag` (or vice versa) — they must match.                                                                                                                                               |

## Schema-change checklist

- [ ] New file exported from `drizzle/schema.ts`
- [ ] `db:generate` run; generated SQL reviewed (data-loss statements flagged)
- [ ] FK columns have indexes; unique constraints/`uniqueIndex` where required
- [ ] Generated/extension columns hand-added in SQL if the builder can't emit them
- [ ] Migration renamed descriptively (file + journal tag) if that's the project convention
- [ ] `db:migrate` applied; `db:studio` spot-check

Official docs: [Migrations](https://orm.drizzle.team/docs/migrations) · [drizzle-kit push](https://orm.drizzle.team/docs/drizzle-kit-push) · [drizzle-kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate) · [drizzle-kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
