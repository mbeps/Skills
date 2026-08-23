# Better Auth + Next.js — Authentication Patterns

> Stack: Better Auth 1.4.x · Next.js 15+ (App Router) · Drizzle ORM · PostgreSQL
> All examples use TypeScript. Client methods are from `authClient` (`lib/auth/auth-client.ts`);
> server methods are from `auth` (`lib/auth/auth.ts`).

---

## Table of Contents

1. [Email & Password Authentication](#1-email--password-authentication)
2. [Social OAuth Authentication](#2-social-oauth-authentication)
3. [Reading Auth State](#3-reading-auth-state)
4. [Custom User Fields (additionalFields)](#4-custom-user-fields-additionalfields)
5. [Type Safety Patterns](#5-type-safety-patterns)

---

## 1. Email & Password Authentication

### Enable in server config

```typescript
// lib/auth/auth.ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: true,   // blocks sign-in until email is verified
  sendResetPassword: async ({ user, url }) => {
    await sendPasswordResetEmail({ user, url });
  },
},
emailVerification: {
  sendOnSignUp: true,                  // sends verification email automatically on sign-up
  autoSignInAfterVerification: true,   // creates a session immediately after the user clicks
  sendVerificationEmail: async ({ user, url }) => {
    await sendEmailVerificationEmail({ user, url });
  },
},
```

---

### 1.1 Sign-Up

```typescript
// Client Component
"use client";
import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function SignUpForm() {
  const router = useRouter();

  async function handleSignUp(data: {
    name: string;
    email: string;
    password: string;
    favoriteNumber: number; // any additionalFields go here
  }) {
    const res = await authClient.signUp.email(
      {
        name: data.name,
        email: data.email,
        password: data.password,
        favoriteNumber: data.favoriteNumber, // custom additionalField
        callbackURL: "/",                    // where to redirect after verification
      },
      {
        onError: (ctx) => toast.error(ctx.error.message),
      }
    );

    // requireEmailVerification: true means no session is created yet
    if (res.error == null && !res.data.user.emailVerified) {
      // Show "check your email" state — do not redirect to app
      showEmailVerificationPrompt(data.email);
    }
  }
}
```

> **Note:** When `requireEmailVerification: true`, sign-up succeeds but returns no session cookie.
> The user cannot sign in until they click the verification link.
> `sendOnSignUp: true` triggers the verification email automatically — you don't need to call
> `sendVerificationEmail` manually after sign-up.

---

### 1.2 Sign-In

```typescript
import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

async function handleSignIn(email: string, password: string) {
  await authClient.signIn.email(
    {
      email,
      password,
      rememberMe: true,    // false = session expires on browser close
      callbackURL: "/",
    },
    {
      onError: (ctx) => {
        if (ctx.error.code === "EMAIL_NOT_VERIFIED") {
          // Prompt user to check their inbox
          showEmailVerificationPrompt(email);
          return;
        }
        toast.error(ctx.error.message);
      },
      onSuccess: () => router.push("/"),
    }
  );
}
```

**2FA interception:** If the account has 2FA enabled, Better Auth intercepts the sign-in response
before `onSuccess` fires. The `twoFactorClient` plugin calls `onTwoFactorRedirect` instead:

```typescript
// lib/auth/auth-client.ts — twoFactorClient config
twoFactorClient({
  onTwoFactorRedirect: () => {
    window.location.href = "/auth/2fa";
  },
}),
```

The user lands on the 2FA challenge page automatically. No extra code needed at the sign-in call site.

---

### 1.3 Email Verification

#### Re-sending the verification email (client)

```typescript
await authClient.sendVerificationEmail({
  email: "user@example.com",
  callbackURL: "/",   // where user lands after clicking the link
});
```

#### What happens after the link is clicked

Better Auth handles the `/api/auth/verify-email?token=...` route automatically. With
`autoSignInAfterVerification: true`, it creates a session and redirects to `callbackURL`.

#### Server-side verification (advanced)

```typescript
// Called by the verification link handler internally; exposed if you need manual control
await auth.api.verifyEmail({ query: { token } });
```

---

### 1.4 Password Reset Flow

Two-step process: request → reset.

#### Step 1 — Request a reset email

```typescript
// Forgot password form
await authClient.requestPasswordReset(
  {
    email: "user@example.com",
    redirectTo: "https://app.example.com/auth/reset-password", // token appended as ?token=...
  },
  {
    onError: (ctx) => toast.error(ctx.error.message),
    onSuccess: () => toast.success("Password reset email sent"),
  }
);
```

The `sendResetPassword` hook in `emailAndPassword` config fires and delivers the email.

#### Step 2 — Submit the new password

```typescript
// app/auth/reset-password/_components/reset-password-form.tsx
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  async function handleReset(newPassword: string) {
    if (!token) {
      toast.error("Invalid or missing reset token");
      return;
    }

    await authClient.resetPassword(
      { newPassword, token },
      {
        onError: (ctx) => toast.error(ctx.error.message),
        onSuccess: () => {
          toast.success("Password reset successful");
          router.push("/auth/login");
        },
      }
    );
  }
}
```

> **Note:** If `token` is absent or the `error` query param is set on the callback URL, treat the
> link as invalid and show a "Back to Login" prompt rather than the reset form.

---

### 1.5 Email Change

The user must be signed in. Better Auth sends a confirmation link to the **new** email address.

```typescript
// Typically run alongside a profile update
const promises = [authClient.updateUser({ name: newName })];

if (newEmail !== currentEmail) {
  promises.push(
    authClient.changeEmail({
      newEmail,
      callbackURL: "/profile",  // where user lands after confirming
    })
  );
}

await Promise.all(promises);
```

Server config required — provide the `sendChangeEmailConfirmation` hook:

```typescript
user: {
  changeEmail: {
    enabled: true,
    sendChangeEmailConfirmation: async ({ user, url, newEmail }) => {
      // Send the verification link to newEmail, not user.email
      await sendEmailVerificationEmail({ user: { ...user, email: newEmail }, url });
    },
  },
},
```

The email change is **not applied** until the user clicks the confirmation link.

---

### 1.6 Password Change

```typescript
await authClient.changePassword(
  {
    currentPassword: "old-password",
    newPassword: "new-password",
    revokeOtherSessions: true, // logs out all other devices; recommended for security
  },
  {
    onError: (ctx) => toast.error(ctx.error.message),
    onSuccess: () => { toast.success("Password updated"); form.reset(); },
  }
);
```

---

## 2. Social OAuth Authentication

### 2.1 Server Configuration

```typescript
// lib/auth/auth.ts
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    // Required when additionalFields has required fields — OAuth users bypass the sign-up form
    mapProfileToUser: (profile: { public_repos?: number | string | null }) => ({
      favoriteNumber: Number(profile.public_repos) || 0,
    }),
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    mapProfileToUser: () => ({ favoriteNumber: 0 }),
  },
},
```

> **Note:** `mapProfileToUser` is required if your user table has `required` additional fields.
> Without it, OAuth sign-up will fail because the required field would be missing.

#### Environment variables

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

**OAuth App callback URL format:** `{BETTER_AUTH_URL}/api/auth/callback/{provider}`

- GitHub OAuth App: https://github.com/settings/developers
- Discord Application: https://discord.com/developers

---

### 2.2 Initiating OAuth Sign-In (client)

```typescript
// Redirects browser to GitHub, then back to callbackURL after auth
await authClient.signIn.social({
  provider: "github",
  callbackURL: "/",
});

// Discord
await authClient.signIn.social({
  provider: "discord",
  callbackURL: "/",
});
```

Better Auth handles the entire OAuth flow through the catch-all route. The user is upserted in
the `user` and `account` tables on the first sign-in (or if `overrideUserInfoOnSignIn: true`).

---

### 2.3 Linking OAuth Accounts to an Existing Account

The user must be authenticated.

```typescript
// Redirects browser to the provider and back; adds a new row to the `account` table
await authClient.linkSocial({
  provider: "github",
  callbackURL: "/profile",
});
```

Difference: `signIn.social` creates a session (or signs in); `linkSocial` attaches a provider to
the **already authenticated** user without touching the session.

---

### 2.4 Unlinking OAuth Accounts

```typescript
await authClient.unlinkAccount({ providerId: "github" });
```

> **Note:** Better Auth will refuse to unlink if it is the user's only authentication method
> (no password set and no other provider). Always show the list of linked accounts before offering
> an unlink button so users don't accidentally lock themselves out.

---

### 2.5 Listing Linked Accounts

#### Client (React Component)

```typescript
const { data: accounts } = await authClient.listAccounts();
// Each account: { providerId: "github" | "discord" | "credential", accountId: string, ... }

// Filter to show only OAuth providers in the UI
const oauthAccounts = accounts?.filter((a) => a.providerId !== "credential") ?? [];
```

#### Server (RSC / Server Action)

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

const accounts = await auth.api.listUserAccounts({ headers: await headers() });
const oauthAccounts = accounts.filter((a) => a.providerId !== "credential");
```

---

### 2.6 mapProfileToUser (Advanced)

Use `mapProfileToUser` to populate user fields from the OAuth profile. This runs once on first
sign-up (and on every sign-in if `overrideUserInfoOnSignIn: true`).

```typescript
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    mapProfileToUser: (profile) => ({
      // profile shape is provider-specific
      favoriteNumber: 0,
    }),
  },
},
```

Common use cases:
- Satisfy required `additionalFields` for OAuth users who skip the sign-up form.
- Pre-populate extra fields from provider-specific profile data (e.g. GitHub's `public_repos`).

---

## 3. Reading Auth State

### 3.1 Client-Side (React Hook)

```typescript
"use client";
import { authClient } from "@/lib/auth/auth-client";

function NavBar() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <Skeleton />;
  if (!session) return <SignInButton />;

  return <span>Hello, {session.user.name}</span>;
  // session.user     — full user object (including additionalFields)
  // session.session  — session metadata (token, expiresAt, ipAddress, …)
}
```

`useSession` is reactive — it updates automatically after sign-in, sign-out, or profile updates.

#### One-off session fetch (non-reactive)

```typescript
const { data: session } = await authClient.getSession();
```

---

### 3.2 Server-Side (React Server Components)

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Protected RSC
export default async function ProfilePage() {
  // headers() MUST be awaited in Next.js 15+
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/auth/login");

  return <ProfileContent user={session.user} />;
}
```

The `nextCookies()` plugin (in `lib/auth/auth.ts`) enables cookie-based session resolution in
Next.js server contexts. Sessions are validated using JWT without a database round-trip on every
request (see `cookieCache.strategy: "jwt"` in session config).

---

### 3.3 Sign-Out

#### Client

```typescript
await authClient.signOut({
  fetchOptions: {
    onSuccess: () => router.push("/auth/login"),
  },
});
```

#### Server Action

```typescript
"use server";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/auth/login");
}
```

---

### 3.4 Session Listing and Revocation

#### List all sessions for the current user

```typescript
// Server Component
const sessions = await auth.api.listSessions({ headers: await headers() });
// Returns Session[] — identify current session by matching session.token to cookie
```

#### Revoke a specific session

```typescript
await authClient.revokeSession({ token: session.token });
```

#### Revoke all other sessions (keep current)

```typescript
await authClient.revokeOtherSessions(undefined, {
  onSuccess: () => router.refresh(),
});
```

---

## 4. Custom User Fields (additionalFields)

### 4.1 Server Config

```typescript
// lib/auth/auth.ts
user: {
  additionalFields: {
    favoriteNumber: {
      type: "number",     // "string" | "number" | "boolean"
      required: true,     // must be provided on email sign-up
      // fieldName: "favoriteNumber", // defaults to the key name
    },
  },
},
```

> **Security note:** For server-only fields (e.g. `role`, `banned`), set `input: false` to
> prevent users from supplying the value during sign-up:
> ```typescript
> role: { type: "string", input: false, defaultValue: "user" }
> ```

After adding a field, regenerate the schema:

```bash
npm run auth:generate   # generates drizzle/schemas/new-auth-schema.ts
npm run db:generate     # creates migration SQL
npm run db:migrate      # applies migration
```

---

### 4.2 Providing Custom Fields at Sign-Up

```typescript
await authClient.signUp.email({
  name: "Alice",
  email: "alice@example.com",
  password: "hunter2",
  favoriteNumber: 42,   // additionalField — typed by inferAdditionalFields plugin
  callbackURL: "/",
});
```

---

### 4.3 Enabling TypeScript Inference on the Client

```typescript
// lib/auth/auth-client.ts
import { inferAdditionalFields } from "better-auth/client/plugins";
import { auth } from "./auth"; // import the server auth instance

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(), // infers favoriteNumber onto session.user
    // ...other plugins
  ],
});
```

After this, `session.user.favoriteNumber` is typed as `number` everywhere the session is consumed.

For a **separate project** (no shared `auth` import):

```typescript
inferAdditionalFields({
  user: {
    favoriteNumber: { type: "number" },
  },
}),
```

---

### 4.4 Updating Custom Fields

```typescript
await authClient.updateUser({
  name: "New Name",
  favoriteNumber: 99,  // typed — TypeScript will error if field is unknown
});
```

---

### 4.5 OAuth Users and additionalFields

OAuth users never fill out the sign-up form, so required additional fields must be populated
via `mapProfileToUser`:

```typescript
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    mapProfileToUser: (profile) => ({
      favoriteNumber: Number(profile.public_repos) || 0,
    }),
  },
  discord: {
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    mapProfileToUser: () => ({ favoriteNumber: 0 }),  // no relevant profile field
  },
},
```

Omitting `mapProfileToUser` when `required: true` is set will cause OAuth sign-up to fail with
a database constraint error.

---

## 5. Type Safety Patterns

### 5.1 Infer Session Types

```typescript
// From the server auth instance (most accurate — includes all plugins)
export type Session = typeof auth.$Infer.Session;
// Session = { session: { id, token, expiresAt, userId, ... }, user: { id, name, email, favoriteNumber, ... } }

export type User = Session["user"];
```

```typescript
// From the client (same shape when inferAdditionalFields is active)
export type ClientSession = typeof authClient.$Infer.Session;
```

---

### 5.2 Export Types from auth.ts

```typescript
// lib/auth/auth.ts — add at the bottom
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session["user"];
```

```typescript
// In any consuming file:
import type { Session, User } from "@/lib/auth/auth";
```

---

### 5.3 Type-Safe Server Component Pattern

```typescript
import { auth } from "@/lib/auth/auth";
import type { Session } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const session: Session | null = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/login");

  // session.user.favoriteNumber is typed as number
  return <div>Your favorite number: {session.user.favoriteNumber}</div>;
}
```

---

### 5.4 Plugin Type Augmentation

Plugins add fields to the session type automatically when `inferAdditionalFields` is configured.
The `adminPlugin` adds `session.user.role`, `session.user.banned`, `session.session.impersonatedBy`.
The `organization` plugin adds `session.session.activeOrganizationId`.

These are inferred from `typeof auth` — no manual type declaration needed.

---

### 5.5 tsconfig.json Requirement

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

`strict: true` (which enables `strictNullChecks`) is required for Better Auth's type inference to
work correctly. Without it, null-safety on `session` checks will silently pass.

> **Warning:** Do not combine `declaration: true` and `composite: true` in the same tsconfig that
> imports `better-auth` — it causes type inference overflow errors at compile time.

---

## References

- https://www.better-auth.com/docs/authentication/email-password
- https://www.better-auth.com/docs/concepts/oauth
- https://www.better-auth.com/docs/concepts/email-verification
- https://www.better-auth.com/docs/concepts/typescript
