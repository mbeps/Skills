# Better Auth + Next.js — Core Setup

Complete installation and configuration reference for a Next.js App Router project.

---

## Installation

```bash
npm install better-auth

# Required for the passkey plugin (separate package):
npm install @better-auth/passkey
```

No other peer packages are required. Better Auth ships its own adapters, plugins, and React client in the main bundle.

---

## Environment Variables

All variables go in `.env.local` (never commit secrets).

```env
# ─── Required ───────────────────────────────────────────────────────────────
BETTER_AUTH_SECRET=                   # 32+ char random string — openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000  # Full base URL of your app (no trailing slash)

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/better_auth

# ─── OAuth Providers (add only providers you configure) ──────────────────────
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── Email Provider (Better Auth is provider-agnostic) ───────────────────────
# Examples: Postmark, Resend, Nodemailer — wire these into your sendEmail helper
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM_EMAIL=hello@example.com
```

**Generating `BETTER_AUTH_SECRET`:**

```bash
openssl rand -base64 32
```

> **Note:** `BETTER_AUTH_URL` must match the `Origin` header your app sends. In production, set it to `https://yourdomain.com`. It defaults to `http://localhost:3000` in development if omitted, but explicit is safer.

---

## Server Config (`lib/auth/auth.ts`)

This is the canonical server singleton. Import it directly in Server Components, Server Actions, and Route Handlers — never import it in client-side code.

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";
import { passkey } from "@better-auth/passkey";
import { admin as adminPlugin } from "better-auth/plugins/admin";
import { organization } from "better-auth/plugins/organization";
import { db } from "@/drizzle/db";
import { ac, roles } from "@/lib/auth/roles"; // RBAC access control — required for admin plugin

// ─── Email helpers — replace with your actual provider ───────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  // e.g. Postmark: await postmarkClient.sendEmail({ To: to, Subject: subject, HtmlBody: html })
  // e.g. Resend:   await resend.emails.send({ to, subject, html })
  console.log(`[Email] To: ${to} | Subject: ${subject}`);
}

export const auth = betterAuth({
  appName: "My App",  // used as TOTP issuer label

  // ─── Database ─────────────────────────────────────────────────────────────
  database: drizzleAdapter(db, {
    provider: "pg",  // "pg" | "mysql" | "sqlite"
    // Other ORMs: import { prismaAdapter } from "better-auth/adapters/prisma"
    //             import { kyselyAdapter } from "better-auth/adapters/kysely"
  }),

  // ─── User config ──────────────────────────────────────────────────────────
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, url, newEmail }) => {
        // url points to the new email address — send the link there
        void sendEmail(newEmail, "Confirm your new email address", url);
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }) => {
        void sendEmail(user.email, "Confirm account deletion", url);
      },
    },
    // Custom fields are stored as columns in the user table.
    // Run `npx auth@latest generate` after adding/changing fields.
    additionalFields: {
      // Example: favoriteNumber is required at sign-up
      favoriteNumber: {
        type: "number",
        required: true,
      },
      // Example: role is server-only — users cannot set it themselves
      // role: {
      //   type: "string",
      //   input: false,      // IMPORTANT: prevents users from writing this field
      //   defaultValue: "user",
      // },
    },
  },

  // ─── Email + password ─────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,  // blocks sign-in until email is verified
    sendResetPassword: async ({ user, url }) => {
      // url contains the reset token as a query param: ?token=...
      void sendEmail(user.email, "Reset your password", url);
    },
  },

  // ─── Email verification ───────────────────────────────────────────────────
  emailVerification: {
    sendOnSignUp: true,                   // send immediately after sign-up
    autoSignInAfterVerification: true,    // creates a session on verification click
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail(user.email, "Verify your email address", url);
    },
  },

  // ─── Social / OAuth providers ─────────────────────────────────────────────
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Map OAuth profile fields onto your user's additionalFields
      mapProfileToUser: (profile) => ({
        favoriteNumber: Number(profile.public_repos) || 0,
      }),
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      mapProfileToUser: () => ({ favoriteNumber: 0 }),
    },
    // google: {
    //   clientId: process.env.GOOGLE_CLIENT_ID!,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    // },
  },

  // ─── Session ──────────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7,   // absolute expiry: 7 days
    updateAge: 60 * 60 * 24,         // rolling: refresh session token every 24 h

    // Cookie cache avoids a DB round-trip on every useSession() call.
    // "jwt" strategy allows stateless validation (no DB hit on every request).
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7,     // 7-day cache
      strategy: "jwt",               // "compact" | "jwt" | "jwe"
      refreshCache: true,
    },
  },

  // ─── Plugins ──────────────────────────────────────────────────────────────
  plugins: [
    // Required for Next.js Server Actions to write auth cookies
    nextCookies(),

    // TOTP-based 2FA with backup codes
    twoFactor(),

    // WebAuthn passkeys (requires @better-auth/passkey)
    passkey(),

    // User management: roles, banning, impersonation
    // Pass ac and roles for RBAC — without this, permission checks are silently ignored
    adminPlugin({
      accessControl: ac,
      roles: roles,
    }),

    // Multi-tenant organizations with invitations
    organization({
      sendInvitationEmail: async ({ email, organization, inviter, invitation }) => {
        const inviteLink = `${process.env.BETTER_AUTH_URL}/organizations/invites/${invitation.id}`;
        void sendEmail(email, `You're invited to ${organization.name}`, inviteLink);
      },
    }),
  ],

  // ─── Lifecycle hooks ──────────────────────────────────────────────────────
  // Single before + single after middleware. Branch on ctx.path for multiple endpoints.
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up") && ctx.context.newSession != null) {
        // Fire-and-forget — do NOT await email sends in hooks to avoid blocking the response
        void sendEmail(
          ctx.context.newSession.user.email,
          "Welcome to My App",
          "Thanks for signing up!",
        );
      }
    }),
  },

  // ─── Database hooks ───────────────────────────────────────────────────────
  // Low-level model lifecycle. Runs inside the DB transaction.
  // databaseHooks: {
  //   session: {
  //     create: {
  //       before: async (session) => {
  //         // Pre-populate activeOrganizationId on every new session
  //         const org = await db.query.member.findFirst({
  //           where: eq(member.userId, session.userId),
  //           orderBy: desc(member.createdAt),
  //         });
  //         return { data: { ...session, activeOrganizationId: org?.organizationId } };
  //       },
  //     },
  //   },
  // },
});

// ─── Exported types ───────────────────────────────────────────────────────────
// Use these instead of writing inline types in Server Components.
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session["user"];
```

### Adapter alternatives

The Drizzle adapter shown above is the most common choice. Other adapters follow the same pattern:

```typescript
// Prisma
import { prismaAdapter } from "better-auth/adapters/prisma";
database: prismaAdapter(prisma, { provider: "postgresql" })

// Kysely
import { kyselyAdapter } from "better-auth/adapters/kysely";
database: kyselyAdapter(db, { type: "postgres" })

// MongoDB
import { mongodbAdapter } from "better-auth/adapters/mongodb";
database: mongodbAdapter(mongoClient.db())
```

---

## Client Config (`lib/auth/auth-client.ts`)

The client is used exclusively in `"use client"` components. Keep it in a separate file — it imports from `better-auth/react`, which is browser-only.

```typescript
import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  twoFactorClient,
  adminClient,
  organizationClient,
} from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import type { auth } from "./auth";  // type-only import — safe to import in client files
import { ROUTES } from "@/lib/routes";

export const authClient = createAuthClient({
  // baseURL is optional when client and server share the same domain.
  // Required for cross-origin setups (e.g. separate frontend/backend deployments).
  // baseURL: process.env.NEXT_PUBLIC_API_URL,

  plugins: [
    // Adds additionalFields (e.g. favoriteNumber, role) to TypeScript types on session.user.
    // Uses a type-only import of auth — zero runtime cost.
    inferAdditionalFields<typeof auth>(),

    passkeyClient(),

    twoFactorClient({
      // Called when a sign-in requires a 2FA challenge.
      // Use window.location.href (not router.push) to force a full page reload
      // and clear any in-flight state before the 2FA page mounts.
      onTwoFactorRedirect: () => {
        window.location.href = ROUTES.AUTH.TWO_FACTOR;
      },
    }),

    // Must match the ac object passed to adminPlugin() on the server
    adminClient({
      ac,
    }),

    organizationClient(),
  ],
});
```

> **CRITICAL — Plugin Symmetry:**  
> Every plugin added to the server config **must** have a matching client plugin, and vice versa.  
> 
> | Server (`auth.ts`) | Client (`auth-client.ts`) |
> |---|---|
> | `twoFactor()` | `twoFactorClient()` |
> | `passkey()` | `passkeyClient()` |
> | `adminPlugin()` | `adminClient()` |
> | `organization()` | `organizationClient()` |
>
> Mismatch silently drops client-side methods without a compile error.

---

## API Route (Next.js App Router)

Mount the catchall route once. All Better Auth endpoints (`/sign-in/email`, `/callback/github`, `/two-factor/verify-totp`, etc.) are served from here.

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

OAuth callback URLs follow the pattern: `{BETTER_AUTH_URL}/api/auth/callback/{provider}`

- GitHub: `http://localhost:3000/api/auth/callback/github`
- Discord: `http://localhost:3000/api/auth/callback/discord`

Register these URLs in your OAuth app settings.

---

## Database Setup

### Drizzle client (`drizzle/db.ts`)

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export const db = drizzle(process.env.DATABASE_URL!, { schema });
```

### Schema integration (`drizzle/schema.ts`)

Better Auth generates table definitions from your config. Import the generated schema and re-export it so Drizzle's relational queries work across your app:

```typescript
// drizzle/schema.ts
// Re-export all tables for Drizzle relational queries
export * from "./schemas/auth-schema";
// export * from "./schemas/your-other-schema";
```

### Generating and applying the schema

```bash
# 1. Generate Drizzle schema from your auth.ts config
#    Output: drizzle/schemas/auth-schema.ts (or a location you specify)
npx auth@latest generate

# 2. Create a migration from the schema diff
npx drizzle-kit generate

# 3. Apply the migration to your database
npx drizzle-kit migrate

# Development shortcut — push schema without migration files:
npx drizzle-kit push
```

Re-run `npx auth@latest generate` any time you:
- Add or remove a plugin
- Add or modify `additionalFields`
- Change `user` or `session` configuration

### Tables added per plugin

| Plugin           | Tables added                                 | Columns added to existing tables                                                          |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Core             | `user`, `session`, `account`, `verification` | —                                                                                         |
| `twoFactor()`    | `twoFactor`                                  | `user.twoFactorEnabled`                                                                   |
| `passkey()`      | `passkey`                                    | —                                                                                         |
| `adminPlugin()`  | —                                            | `user.role`, `user.banned`, `user.banReason`, `user.banExpires`, `session.impersonatedBy` |
| `organization()` | `organization`, `member`, `invitation`       | `session.activeOrganizationId`                                                            |

---

## TypeScript Configuration

### Required tsconfig settings

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "target": "ES2022"
  }
}
```

`strict: true` is **required** — Better Auth's type inference depends on `strictNullChecks`.

> **Warning:** Do NOT enable `declaration: true` together with `composite: true` in the same `tsconfig.json` that imports Better Auth. This causes type inference to overflow. Use `composite` only in a separate build tsconfig.

### Inferring types from auth

```typescript
// From the server instance:
export type Session = typeof auth.$Infer.Session;
export type User   = typeof auth.$Infer.Session["user"];

// Session shape: { session: { id, token, userId, expiresAt, ... }, user: { id, name, email, ... } }
```

### Using types in Server Components

The server `auth.api.getSession()` return type includes your `additionalFields` automatically. However, when using the admin or passkey plugins, you need to cast `auth.api` to access plugin-specific endpoints:

```typescript
import { admin } from "better-auth/plugins/admin";
import { passkey } from "@better-auth/passkey";

// Access plugin-specific server endpoints
const adminApi  = auth.api as typeof auth.api & ReturnType<typeof admin>["endpoints"];
const passkeyApi = auth.api as typeof auth.api & ReturnType<typeof passkey>["endpoints"];

// Then call:
const users  = await adminApi.listUsers({ headers: await headers(), query: { limit: 100 } });
const keys   = await passkeyApi.listPasskeys({ headers: await headers() });
```

### `inferAdditionalFields` on the client

The `inferAdditionalFields<typeof auth>()` client plugin bridges the type gap for `additionalFields` and admin columns so `session.user.favoriteNumber`, `session.user.role`, etc. are typed correctly:

```typescript
// Without inferAdditionalFields: session.user.favoriteNumber → TypeScript error
// With inferAdditionalFields:    session.user.favoriteNumber → number ✓
const { data: session } = authClient.useSession();
console.log(session?.user.favoriteNumber);
```

---

## Server Guard Pattern

The standard pattern for protecting a Server Component:

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session == null) {
    redirect("/auth/login");
  }

  // session.user is fully typed including additionalFields
  return <div>Hello {session.user.name}</div>;
}
```

---

## Workflow Reference

```bash
# Initial setup
npm install better-auth @better-auth/passkey
npx auth@latest generate    # generates auth-schema.ts
npx drizzle-kit migrate     # applies schema to DB
npm run dev

# After modifying auth.ts (new plugin, new additionalField, etc.)
npx auth@latest generate    # regenerate schema
npx drizzle-kit generate    # new migration SQL
npx drizzle-kit migrate     # apply migration
```

---

## References

- https://www.better-auth.com/docs/installation
- https://www.better-auth.com/docs/concepts/typescript
- https://www.better-auth.com/docs/integrations/next-js
- https://www.better-auth.com/docs/adapters/drizzle
