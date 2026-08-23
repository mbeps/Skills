# Edge Functions

> Prerequisite: read `SKILL.md` first.

## Overview

Edge Functions run on Deno/TypeScript in `supabase/functions/`. Use them for webhooks, heavy server-side work, and third-party integrations. **Prefer a Server Action for app data** — an edge function adds a hop and a deploy surface. Large client uploads (>6MB standard limit) belong on [TUS resumable uploads](https://supabase.com/docs/guides/storage/uploads), not an edge function.

## Scaffold & run locally

```bash
supabase functions new my-function    # scaffolds the withSupabase wrapper (see below)
supabase functions serve my-function  # needs Docker + `supabase start`
```

## Deploy

```bash
supabase functions deploy my-function            # one function
supabase functions deploy                        # all functions
supabase functions deploy my-function --use-api  # bundles server-side without Docker
supabase functions deploy my-function --no-verify-jwt   # opt out of gateway JWT verification
```

`supabase functions new --auth none|apikey|user` chooses the default auth mode.

## CORS & auth

`withSupabase` from `npm:@supabase/server@^1` handles CORS, OPTIONS preflight, and auth automatically. The **object form** below is what `functions new` scaffolds today (a bare `export default withSupabase(...)` also runs, but is the older form):

```ts
// supabase/functions/my-function/index.ts
import { withSupabase } from "npm:@supabase/server@^1"

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, { supabase }) => {
      // supabase is authenticated with the request's credentials
      const { data, error } = await supabase.from("todos").select("*")
      return new Response(JSON.stringify({ data, error }), {
        headers: { "Content-Type": "application/json" },
      })
    }
  ),
}
```

Manual fallback (supabase-js ≥ 2.95.0) — return `corsHeaders` on every response including OPTIONS:

```ts
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  return new Response(JSON.stringify({ hello: "world" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})
```

## Secrets

```bash
supabase secrets set MY_API_KEY=value
supabase secrets set --env-file .env.prod
supabase secrets list
supabase secrets unset MY_API_KEY
```

Read them as plain env vars inside the function (`Deno.env.get("MY_API_KEY")`). Never hardcode secrets.

## Invocation

From the client — the `apikey` header is automatic; `Authorization` carries the signed-in user's JWT:

```ts
const { data, error } = await supabase.functions.invoke("my-function", {
  body: { foo: "bar" },
})
```

From the server — plain `fetch` with the user's JWT (never the service-role key as `Authorization`):

```ts
const supabase = await createClient()
const { data: { session } } = await supabase.auth.getSession()

await fetch(`https://${ref}.supabase.co/functions/v1/my-function`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session?.access_token}`,
    apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ foo: "bar" }),
})
```

## Common Mistakes

- Missing CORS headers on non-`withSupabase` functions → browser invocations fail.
- Hardcoded secrets in the function source.
- Long-running/cold-start-unfriendly functions — keep them short and idempotent.
- Invoking with the service-role key in `Authorization` (masquerades as the user).
- Not pinning the `@supabase/server` version in the import URL.

Official docs: [Edge Functions](https://supabase.com/docs/guides/functions) · [Quickstart](https://supabase.com/docs/guides/functions/quickstart) · [CORS](https://supabase.com/docs/guides/functions/cors)
