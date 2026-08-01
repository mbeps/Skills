# Authentication

> Prerequisite: read `SKILL.md` first.

## Session model

Cookie-based sessions — never localStorage on the server. The session cookie is named `sb-<project_ref>-auth-token` by default. The access token is a short-lived JWT (default ~1 hour); the refresh token is single-use and never expires. Both live in **non-HTTP-only** cookies so the browser client can refresh proactively; CSRF is mitigated by Next.js Same-Site handling.

The App Router default is the **PKCE flow** (implicit flow is the JS client-only default): the code in the URL is single-use, valid 5 minutes, and must be exchanged on the same browser that started the flow. Refresh-token reuse detection: reuse within a 10-second interval is tolerated (legit SSR server+client reuse); any other reuse revokes the whole session.

## Three clients for auth

One client per execution context (summarized in `conventions.md` §3; full factories below):

- **Browser client** — `createBrowserClient`, singleton, localStorage token persistence, `auth.experimental.passkey: true`.
- **Server client** — `createServerClient` with **`await cookies()`** (async in Next.js 15+); `getAll` reads, `setAll` writes wrapped in try/catch (Server Components cannot write cookies).
- **Proxy client** — `createServerClient` over `request.cookies` / `response.cookies`; the **only** client with full read+write cookie authority; refreshes expired tokens per request. (Next.js 16 renamed middleware → Proxy with file convention `proxy.ts`; `middleware.ts` is the equivalent on Next 15.)

### Browser client factory

```ts
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database.types"

export function createClient() {
  return createBrowserClient<Database, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { experimental: { passkey: true } } }
  )
}
```

### Server client factory

```ts
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database.types"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database, "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { experimental: { passkey: true } },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context: cookies are read-only. The Proxy refreshes sessions.
          }
        },
      },
    }
  )
}
```

### Proxy session refresh

```ts
// proxy.ts (Next 16; middleware.ts on Next 15)
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Validates the JWT locally (WebCrypto + cached JWKS) and refreshes expired tokens.
  await supabase.auth.getClaims()

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
```

Propagate the `Cache-Control`/`Expires`/`Pragma` headers the `setAll` callback receives onto the response so CDNs never cache a session — see the advanced server-side guide (ISR/CDN caveat).

## Email / password

Sign up — with confirmations enabled (default on hosted; `auth.email.enable_confirmations` in `config.toml` for local), `signUp` returns `user` with a **null session**; the user confirms via the emailed link:

```ts
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${origin}/auth/confirm`,
    data: { full_name: name },
  },
})
// data.session is null when email confirmation is on — show "check your email".
```

The confirmation link lands on `/auth/confirm`, which verifies the token hash:

```ts
// app/auth/confirm/route.ts
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: type as any, token_hash })
    if (!error) return NextResponse.redirect(`${origin}/`)
  }
  return NextResponse.redirect(`${origin}/error`)
}
```

Sign in, then `router.refresh()` from the client so Server Components re-render with the new session cookies:

```ts
const { error } = await supabase.auth.signInWithPassword({ email, password })
if (!error) router.refresh()
```

Confirmation emails from the built-in sender are rate-limited (2/hr) — set up custom SMTP for production.

## OAuth (Google, GitHub, …)

```ts
await supabase.auth.signInWithOAuth({
  provider: "google", // github, apple, discord, ...
  options: { redirectTo: `${origin}/auth/callback?redirect=${pathname}` },
})
```

PKCE is supported. `redirectTo` must be an allowed redirect URL in the Supabase dashboard. The callback route exchanges the code and preserves the pre-login destination:

```ts
// app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const redirect = requestUrl.searchParams.get("redirect") || "/"

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL(redirect, requestUrl.origin))
}
```

## Passkeys (WebAuthn)

Requires supabase-js ≥ 2.105.0 and explicit opt-in `auth: { experimental: { passkey: true } }` in **all three clients**. Enable in the Dashboard or `config.toml`:

```toml
[auth.passkey]
enabled = true

[auth.webauthn]
rp_display_name = "My App"
rp_id = "example.com"          # bare domain — changing RP ID invalidates all existing passkeys
rp_origins = ["https://example.com", "https://app.example.com"]   # ≤ 5
```

Enroll (requires a confirmed, non-anonymous, signed-in user) — full ceremony, or two-step `auth.passkey.startRegistration()` → `verifyRegistration({ challengeId, credential })`:

```ts
const { data, error } = await supabase.auth.registerPasskey()
```

Sign in — discoverable credentials, no email needed:

```ts
// Feature-detect before showing the button
const supported =
  typeof window !== "undefined" &&
  window.PublicKeyCredential !== undefined &&
  (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())

const { data, error } = await supabase.auth.signInWithPasskey()
// two-step alternative: startAuthentication() → verifyAuthentication(...)
```

Manage passkeys via server actions (metadata lives in the `auth` schema, never `public`):

```ts
"use server"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function renamePasskey(passkeyId: string, friendlyName: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.passkey.update({ passkeyId, friendlyName })
  if (error) return { ok: false }
  revalidatePath("/account")
  return { ok: true }
}

export async function listPasskeys() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.passkey.list()
  return error ? [] : data
}
```

Admin API: `supabase.auth.admin.passkey.listPasskeys({ userId })`. Limitations: SSO and anonymous users cannot register. Error codes: `passkey_disabled`, `too_many_passkeys`, `webauthn_*`.

## Password reset

```ts
// Request (server action)
"use server"
import { createClient } from "@/lib/supabase/server"

export async function requestPasswordReset(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

Change-password action on the `/update-password` page, guarded by `getUser()`:

```ts
"use server"
import { createClient } from "@/lib/supabase/server"

export async function updatePassword(password: string, currentPassword?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }   // not signed in — session expired

  const { error } = await supabase.auth.updateUser({
    password,
    ...(currentPassword ? { current_password: currentPassword } : {}),
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

`current_password` requires supabase-js ≥ 2.102.0. OAuth-only accounts: `updateUser({ password })` fails unless the user re-authenticates first (`signInWithPassword` with the current password) — derive that capability from `user.identities`.

## Sign out

`signOut()` defaults to scope `'global'` — it signs out **all devices**. Pass `{ scope: "local" }` for a normal button, then `router.refresh()`. The JWT stays valid until it expires.

```ts
await supabase.auth.signOut({ scope: "local" })
router.refresh()
```

Server-side revocation (ban/impersonation flows): `supabase.auth.api.signOut(userJwt)`.

## Server-side authorization

Rules:
- **`getClaims()`** — validates the JWT locally (WebCrypto + cached JWKS; falls back to a server call with symmetric keys). Use to protect pages and data.
- **`getUser()`** — network call to Auth for the freshest user record. Use for per-action guards.
- **`getSession()`** — raw session, **not re-validated**; the embedded user object must not be trusted when storage is shared. **Never use it for authorization.**

Reconciliation: refresh tokens in the proxy with `getClaims()`; guard mutating actions with `getUser()`. Two-step identity pattern: `getUser()` → look up the profile row by the auth user id → check role/ownership. Repeat the guard in **every** mutating action — RLS is the backstop, the check is defense in depth.

```ts
"use server"
import { createClient } from "@/lib/supabase/server"

export async function deleteAlbum(albumId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const { data: album } = await supabase
    .from("albums")
    .select("user_id")
    .eq("id", albumId)
    .maybeSingle()
  if (!album || album.user_id !== user.id) return { ok: false }   // ownership guard

  const { error } = await supabase.from("albums").delete().eq("id", albumId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/albums")
  return { ok: true }
}
```

## Route protection

- **Hard gate** — server component: `getUser()` → `redirect()`. Force dynamic rendering so the gate cannot be cached:

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export const revalidate = 0

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/sign-in?redirect=/account")
  return <Account user={user} />
}
```

- **Soft gate** — client-side check; open an auth modal in place (no navigation).
- **Proxy-level redirects** — protected paths → `/login?next=<path>`; redirect authenticated users away from sign-in/sign-up. Extend the §3 proxy factory with a gate (`proxy.ts` on Next 16, `middleware.ts` on Next 15):

```ts
// proxy.ts (Next 16; middleware.ts on Next 15)
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const protectedPaths = ["/account", "/settings"]
const loginPath = "/login"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Validates identity (and refreshes expired tokens) before the gate.
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Unauthenticated → protected path: bounce to /login, preserving the destination.
  if (!user && protectedPaths.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = loginPath
    url.searchParams.set("next", pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  // Authenticated → login/signup page: back home.
  if (user && pathname.startsWith(loginPath)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

`getUser()` here is one network call per request — fine for a redirect gate; `getClaims()` is the cheaper local check when the proxy only refreshes (see §3). Path/param naming is app-specific (the hard gate above uses `/sign-in?redirect=`).

## Additional auth flows

**Magic links / email OTP** — `signInWithOtp` emails a link or code; the callback verifies through the same `/auth/confirm` route as sign-up (`token_hash` + `type`, where `type` is `magiclink`, `signup`, `recovery`, …):

```ts
await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${origin}/auth/confirm` },
})
// callback: supabase.auth.verifyOtp({ email, token, type: "magiclink" })
```

OTP sends are rate-limited (30/hr project-wide, 60s window per user) — surface 429s, don't loop.

**MFA (TOTP / phone)** — enroll, then challenge + verify at sign-in:

```ts
// enroll (confirmed, signed-in user)
const { data: factor } = await supabase.auth.mfa.enroll({ factorType: "totp" })
// show factor.totp.qr_code; after the user enters a code:
const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: factor.id })
await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code })
// sign-in flow: signInWithPassword → mfa.challenge({ factorId }) → mfa.verify(...)
```

Manage with `mfa.listFactors()` / `mfa.unenroll({ factorId })`. MFA does not change RLS — the session is the gate. Docs: [MFA](https://supabase.com/docs/guides/auth/auth-mfa).

**Anonymous sign-in** — "try before sign-up":

```ts
const { data } = await supabase.auth.signInAnonymously()
// convert to a permanent account (fails if the email/provider was already used):
await supabase.auth.linkIdentity({ provider: "google" })
await supabase.auth.signUp({ email, password, options: { data: { is_anonymous: true } } })
```

Anonymous users can't sign back in, and their rows linger — clean them up with scheduled jobs (see `database.md`). Docs: [Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous).

**CAPTCHA (hCaptcha / Turnstile)** — enable in Dashboard → Auth → Bot and Abuse Protection, then pass the widget token on auth calls:

```ts
await supabase.auth.signUp({ email, password, options: { captchaToken } })
// also accepted by: signInWithPassword, signInWithOtp, resetPasswordForEmail, signInAnonymously
```

Reset the widget after every attempt. Docs: [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha).

**Sensitive updates — `reauthenticate()` + `nonce`** — require a fresh confirmation before password/email changes:

```ts
await supabase.auth.reauthenticate()                     // emails a code
await supabase.auth.verifyOtp({ email, token: code, type: "reauthentication" })
await supabase.auth.updateUser({ password }, { nonce: "1234567890" })   // nonce: 6-12 alphanumeric chars
```

**Rate limits** — Auth is token-bucket per IP: `/auth/v1/token` 1,800/hr, `/auth/v1/verify` 360/hr, MFA 15/hr, anonymous sign-ins 30/hr, OTP sends 30/hr (project-wide). Surface 429s and back off. For server-side/proxy limiting, forward the client IP via the `Sb-Forwarded-For` header — requires a **secret** key and `security_sb_forwarded_for_enabled = true`:

```ts
createServerClient(url, secretKey, {
  global: { headers: { "sb-forwarded-for": request.headers.get("x-forwarded-for") ?? "" } },
})
```

Docs: [Rate limits](https://supabase.com/docs/guides/auth/rate-limits) · [Sessions](https://supabase.com/docs/guides/auth/sessions).

## Debugging SSR auth

`SupabaseAuthMissingError` (missing or unreadable session) is the classic SSR failure — in order of likelihood:
- `cookies()` not awaited (Next.js 15+): `const cookieStore = await cookies()`.
- `setAll` not wrapped in try/catch in Server Components — the read-only cookie store throws and the auth call dies.
- No proxy/middleware refresh — expired tokens never refresh server-side, so `getUser()` returns null after ~1h.
- Wrong factory for the context (browser client in a server component, or vice-versa), or `NEXT_PUBLIC_*` unset in that environment.

## Common Mistakes

- Trusting `getSession()` server-side — it is not re-validated; use `getClaims()` for pages/data and `getUser()` for action guards.
- Writing cookies from a Server Component — read-only context; refresh sessions in the Proxy and wrap `setAll` in try/catch. Never persist auth state in localStorage on the server.
- Missing `/auth/confirm` (PKCE) or `/auth/callback` routes — codes expire after 5 minutes; wire both before enabling the flows.
- OAuth `redirectTo` not allow-listed in the dashboard — the redirect silently fails.
- Forgetting `router.refresh()` after sign-in/out, or `signOut()` defaulting to `global` scope — refresh to re-render server components; pass `{ scope: "local" }` for a plain button.
- Passkey pitfalls — calling passkey APIs without `experimental.passkey: true` in every client, or changing the WebAuthn RP ID (invalidates all registered passkeys).

Official docs: [Auth](https://supabase.com/docs/guides/auth) · [Passwords](https://supabase.com/docs/guides/auth/passwords) · [Sessions](https://supabase.com/docs/guides/auth/sessions) · [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow) · [Passkeys](https://supabase.com/docs/guides/auth/passkeys) · [Creating a client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) · [Advanced server-side](https://supabase.com/docs/guides/auth/server-side/advanced-guide) · [Captcha](https://supabase.com/docs/guides/auth/auth-captcha) · [Rate limits](https://supabase.com/docs/guides/auth/rate-limits) · [Google social login](https://supabase.com/docs/guides/auth/social-login/auth-google)
