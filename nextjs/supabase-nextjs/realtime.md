# Realtime

> Prerequisite: read `SKILL.md` first.

## Channel basics

```ts
const channel = supabase.channel("room-1")   // any name except "realtime"
channel.subscribe((status) => {
  if (status === "SUBSCRIBED") { /* ready to send */ }
})
```

Reuse the typed client from `conventions.md`. Wait for `SUBSCRIBED` before sending broadcast messages.

## Broadcast

```ts
// subscribe
channel
  .on("broadcast", { event: "cursor" }, (payload) => console.log(payload))
  .subscribe()

// send (after SUBSCRIBED)
channel.send({ type: "broadcast", event: "cursor", payload: { x: 1, y: 2 } })
```

Options: `broadcast: { self, ack, replay: { since, limit } }` — replay only works on private channels (DB-published), retention ~72h–4d.

## Presence

```ts
channel.on("presence", { event: "sync" }, () => {
  const state = channel.presenceState()   // keyed by presence key
})
channel.on("presence", { event: "join" }, ({ key, newPresences }) => {})
channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {})

channel.track({ user_id: userId })
```

## Postgres Changes

Realtime streams table changes via the `supabase_realtime` publication — **disabled by default for new projects**. Add tables explicitly:

```sql
alter publication supabase_realtime add table public.todos;
```

```ts
const channel = supabase
  .channel("todos-changes")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "todos", filter: `user_id=eq.${userId}` },
    (payload) => {
      // payload.new / payload.old
    }
  )
  .subscribe()
```

Filters: `eq neq lt lte gt gte in` (≤ 100 values) `like ilike match imatch is isdistinct` — comma-AND-combined (no OR), negate with `not.`. `select: ["id", "title"]` limits payload columns (requires explicit schema + table). supabase-js also ships a type-safe `postgresChangesFilter` builder.

## RLS enforcement

- `postgres_changes` **honors RLS** on the table ("RLS applies to realtime") — subscribers only receive rows their policies allow.
- **DELETE events are not RLS-filterable**; `old` records only carry the primary key unless you set `alter table public.todos replica identity full` — and with RLS enabled, `old` for DELETE still contains only the PK even with full replica identity. Protect sensitive tables accordingly.
- Non-public schemas need an explicit realtime grant: `grant select on "private"."t" to authenticated` (plus RLS policies).
- Scale: ~3k concurrent subscribers per event. Beyond that, stream via Broadcast (`realtime.broadcast_changes()` + `realtime.send()`).
- Custom JWTs: `realtime.setAuth(jwt)` — never the service key.

React cleanup — unsubscribe in effect teardown:

```tsx
useEffect(() => {
  const channel = supabase
    .channel("todos-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, () => {})
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [])
```

## Common Mistakes

- Table not added to the `supabase_realtime` publication → silent no-events.
- Forgetting RLS → subscription leaks rows the user shouldn't see.
- Relying on `old` values without `replica identity full`.
- Sending broadcast messages before `SUBSCRIBED`; naming a channel `"realtime"` (reserved).
- Subscribing with the service-role key.
- No `removeChannel`/`unsubscribe` in React effects → leaked connections.

Official docs: [Realtime](https://supabase.com/docs/guides/realtime) · [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) · [Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
