---
name: better-auth-nextjs
description: Use when building or modifying authentication in a Next.js App Router project with Better Auth — covers setup, email/password, OAuth, passkeys, 2FA, sessions, organizations, admin, and transactional emails.
---

# Better Auth + Next.js

Better Auth is a TypeScript-first authentication library. This skill covers its full feature surface in a **Next.js 15+ App Router** monolith: dual server/client configuration, all first-party plugins, database integration via Drizzle, and transactional email hooks.

All patterns are validated against a production codebase using Next.js 16, Better Auth 1.4.x, Drizzle ORM + PostgreSQL, and Postmark for email.

---

## Skill Map

| File | Covers |
|---|---|
| `core-setup.md` | Installation, env vars, `auth.ts`, `auth-client.ts`, API route, database, TypeScript types |
| `authentication.md` | Sign-up, sign-in, email verification, password reset, change password, OAuth, account linking |
| `two-factor-auth.md` | TOTP enrollment, QR code, backup codes, 2FA challenge flow |
| `passkeys.md` | WebAuthn registration, silent sign-in (Conditional UI), manual sign-in, passkey management |
| `session-management.md` | Session listing, per-session revocation, cookie cache strategies, server vs client access |
| `organizations.md` | Org CRUD, invitations, member management, `setActive`, org-scoped session, RBAC/AC |
| `admin.md` | User listing, role assignment, banning, impersonation, server-side permission checks |
| `email-hooks.md` | Email hook locations, provider-agnostic send pattern, all transactional email types |
| `server-client-patterns.md` | `auth.api.*` in Server Components, plugin endpoint casting, `getSession` guard pattern |

---

## Quick Start

- Install: `npm install better-auth` + `npm install @better-auth/passkey` (if using passkeys)
- Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`
- Create `lib/auth/auth.ts` (server config) and `lib/auth/auth-client.ts` (client config) — see `core-setup.md`
- Mount the catchall route at `app/api/auth/[...all]/route.ts`
- Run `npx auth@latest generate` to produce the Drizzle schema, then `npx drizzle-kit migrate`

---

## Key Concepts

### Server auth vs client auth

| | Server (`auth.api.*`) | Client (`authClient.*`) |
|---|---|---|
| **Used in** | `async` Server Components, Server Actions, Route Handlers | `"use client"` components |
| **Cookie forwarding** | Requires `headers: await headers()` | Automatic via browser cookies |
| **Returns** | Direct typed values | `{ data, error }` + React hooks |
| **Example** | `auth.api.getSession({ headers: await headers() })` | `authClient.useSession()` |

Use `auth.api.*` for all server-side guards and data fetches. Use `authClient.*` for mutations and reactive state in Client Components.

### Dual-config pattern

`auth.ts` (server) and `auth-client.ts` (client) are two separate instances that **must stay in sync**:

```
auth.ts plugins      →     auth-client.ts plugins
──────────────────────────────────────────────────
twoFactor()          →     twoFactorClient()
passkey()            →     passkeyClient()
admin()              →     adminClient()
organization()       →     organizationClient()
```

> **Warning:** Adding a plugin to only one side silently breaks those features — the client methods will be missing or the server won't accept the requests.

### Catchall route

All Better Auth HTTP endpoints are served from a single catchall route:

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

This handles `/api/auth/sign-in/email`, `/api/auth/callback/github`, `/api/auth/two-factor/verify-totp`, and every other Better Auth endpoint automatically.

---

## Plugin Registry

| Plugin | Package | Server import | Client import |
|---|---|---|---|
| `nextCookies` | `better-auth/next-js` | `import { nextCookies } from "better-auth/next-js"` | — (server only) |
| `twoFactor` | `better-auth/plugins/two-factor` | `import { twoFactor } from "better-auth/plugins/two-factor"` | `import { twoFactorClient } from "better-auth/client/plugins"` |
| `passkey` | `@better-auth/passkey` | `import { passkey } from "@better-auth/passkey"` | `import { passkeyClient } from "@better-auth/passkey/client"` |
| `admin` | `better-auth/plugins/admin` | `import { admin } from "better-auth/plugins/admin"` | `import { adminClient } from "better-auth/client/plugins"` |
| `organization` | `better-auth/plugins/organization` | `import { organization } from "better-auth/plugins/organization"` | `import { organizationClient } from "better-auth/client/plugins"` |
| `inferAdditionalFields` | `better-auth/client/plugins` | — | `import { inferAdditionalFields } from "better-auth/client/plugins"` |

---

## References

- [core-setup.md](core-setup.md) — Full installation and configuration templates
- [authentication.md](authentication.md) — Email/password and OAuth auth flows
- [two-factor-auth.md](two-factor-auth.md) — 2FA flows
- [passkeys.md](passkeys.md) — WebAuthn integration
- [session-management.md](session-management.md) — Session management
- [organizations.md](organizations.md) — Multi-tenant organization support
- [admin.md](admin.md) — Admin plugin and RBAC
- [email-hooks.md](email-hooks.md) — Transactional email hooks
- [server-client-patterns.md](server-client-patterns.md) — Server Component auth patterns
- Official docs: https://www.better-auth.com/docs
