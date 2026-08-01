# Conventions: Supabase × Next.js

> Prerequisite: read `SKILL.md` first. These are the Supabase × Next.js overlap "house rules" — read this file for day-to-day code decisions.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` — required.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — client-safe. (`anon` keys are deprecated end of 2026; a legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback is optional.)
- `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` — server-only, optional. Never `NEXT_PUBLIC_`.
- `SUPABASE_REFERENCE_ID` — optional, used for image domains and storage URLs.

**Validate at module load** (Zod, split client/server schemas — preferred):

```ts
// lib/env.ts
import { z } from "zod"

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_MAX_SONG_SIZE_MB: z.coerce.number().default(20),
  NEXT_PUBLIC_MAX_AVATAR_SIZE_MB: z.coerce.number().default(5),
})

const serverSchema = clientSchema.extend({
  SUPABASE_REFERENCE_ID: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
})

const isServer = typeof window === "undefined"
const parsed = (isServer ? serverSchema : clientSchema).safeParse(process.env)
if (!parsed.success) throw new Error("Invalid environment variables")

export const env = parsed.data as z.infer<typeof serverSchema>

// Pre-compute byte limits from env — validated once, used everywhere
export const FILE_LIMITS = {
  SONG_MAX_BYTES: env.NEXT_PUBLIC_MAX_SONG_SIZE_MB * 1024 * 1024,
  AVATAR_MAX_BYTES: env.NEXT_PUBLIC_MAX_AVATAR_SIZE_MB * 1024 * 1024,
} as const
```

Fail-fast throw getters are an acceptable fallback. `NEXT_PUBLIC_` prefix **only** for client-safe values; the service-role/secret key must never reach the browser.

## Three client factories

| Factory | Module                                                  | Context                              | Cookie authority                               |
| ------- | ------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| Browser | `lib/supabase/client.ts`                                | Client Components                    | localStorage (no cookie writes)                |
| Server  | `lib/supabase/server.ts`                                | Server Components / Actions / Routes | read + write, writes silently discarded in RSC |
| Proxy   | `lib/supabase/middleware.ts` helper, used by `proxy.ts` | every request                        | **full read + write** — refreshes tokens       |

All three typed: `createBrowserClient<Database, "public">` / `createServerClient<Database, "public">`. One import site per side — server code imports the server factory, client code imports the browser factory. Full factories live in `authentication.md` §3. An optional fourth admin/service-role client exists only when RLS bypass is unavoidable — and never in browser code.

## Server actions as the data-access boundary

All reads and writes go through `"use server"` actions. No client `.from()` for data; no TanStack Query over Supabase. Template:

```ts
"use server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const inputSchema = z.object({ albumId: z.string().uuid() })

export async function deleteAlbum(raw: unknown): Promise<ActionResponse<null>> {
  // 1. validate input at the boundary
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: "invalid input" }

  const supabase = await createClient()

  // 2. auth guard — getUser(), never getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "unauthorized" }

  // 3. in-app ownership check (RLS is the backstop)
  const { data: album } = await supabase
    .from("albums").select("user_id").eq("id", parsed.data.albumId).maybeSingle()
  if (!album || album.user_id !== user.id) return { success: false, error: "forbidden" }

  // 4. mutate
  const { error } = await supabase.from("albums").delete().eq("id", parsed.data.albumId)
  if (error) return { success: false, error: error.message }

  // 5. best-effort storage cleanup (see storage.md), then:
  // 6. invalidate cached UI
  revalidatePath("/albums")
  return { success: true, data: null }
}
```

Share PostgREST select constants for nested joins; pure mapper functions convert rows → domain types.

## Result unions & error handling

Never throw across the boundary. Either a result union or neutral values (`null` / `false` / `[]` / `{ ok: false }`) — pick one per action and be consistent:

```ts
export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Handle Postgres errors without surfacing them raw: tolerate `PGRST116` (no rows), re-fetch on `23505` (unique race), log structured, surface `429` (rate limits) — detail in `database.md` §9. Client hooks wrap actions with loading/error state.

## Serialization to client components

DB rows → client-safe plain objects before passing props: parse `NUMERIC` strings to numbers, flatten nested relations, `Date` → ISO strings:

```ts
type DateToString<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K]
}

function mapAlbumRow(row: AlbumRow): DateToString<Album> {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at.toISOString(),   // Date → ISO string
    songCount: Number(row.song_count),         // NUMERIC string → number
  }
}
```

Pass primitives/serialized props from Server Components (`initialData` pattern). `revalidatePath` after every mutation that surfaces changed data — call sites: after create/update/delete actions that list or detail the changed resource.

## What NOT to do

- Service-role key in the browser.
- Trusting `getSession()` for server-side authorization (mirror of `authentication.md`: `getClaims()` = local verify for pages/data, `getUser()` = fresh record for action guards).
- Untyped clients (`SupabaseClient<any>`) or handwritten schema mirrors.
- Storing storage URLs instead of paths.
- Throwing across the action boundary.
- Client-side data queries for reads.
- Writing cookies from Server Components.
- Skipping `revalidatePath` after mutations.
- Zod-validating only client-side — validate at the action boundary.

## Testing (optional)

Vitest action tests with a chained mock of the Supabase client and env stubs. `vitest.config.ts`: set `NEXT_PUBLIC_SUPABASE_URL` to `http://localhost:54321` in `test.env`. Keep action tests focused on guards, validation, and RPC usage — not Postgres behavior.

## Common Mistakes

- Reading env as raw `process.env.X` at call sites instead of the validated module.
- Mixing client/server factory imports (server code using the browser client).
- One long-lived server client shared across requests — create per request.
- Forgetting async `cookies()` (Next.js 15+).
- Returning `Date` objects to client components → serialization errors.
- Mutating without `revalidatePath` → stale UI.

Official docs: [Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) · [Creating a client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) · [Advanced server-side](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
