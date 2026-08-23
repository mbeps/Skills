# Better Auth + Next.js: Server & Client Patterns

## 1. The Two-Config Pattern

Better Auth has TWO separate configs that must stay in sync:

- `lib/auth/auth.ts` — Server singleton: plugins, DB adapter, hooks, email callbacks
- `lib/auth/auth-client.ts` — Client: React hooks, browser-side calls

**Critical**: Client plugins must mirror server plugins exactly. A server plugin without the matching client plugin means its client-side methods and hooks won't exist on `authClient`.

```typescript
// lib/auth/auth.ts (server)
import { twoFactor } from "better-auth/plugins/two-factor";
import { organization } from "better-auth/plugins/organization";
export const auth = betterAuth({
  plugins: [nextCookies(), twoFactor(), passkey(), adminPlugin({ ac, roles }), organization(...)],
});

// lib/auth/auth-client.ts (client) — mirrors the server plugins
import { twoFactorClient, adminClient, organizationClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(), // types additionalFields on session.user
    passkeyClient(),
    twoFactorClient({ onTwoFactorRedirect: () => { window.location.href = "/auth/2fa"; } }),
    adminClient({ ac, roles }),
    organizationClient(),
  ],
});
```

`inferAdditionalFields<typeof auth>()` is required to type custom fields (e.g. `favoriteNumber`) on `session.user` in TypeScript.

---

## 2. Server-Side Auth (`auth.api.*`)

### When to use
- React Server Components (RSC) that need auth state
- Route Handlers doing auth operations
- Server Actions

### How to call

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

// In a Server Component — headers() is async in Next.js 15+, always await it
const session = await auth.api.getSession({ headers: await headers() });
```

### Available server methods

```typescript
auth.api.getSession({ headers })           // Get current session
auth.api.listSessions({ headers })         // All sessions for current user
auth.api.listUserAccounts({ headers })     // Linked OAuth accounts
auth.api.listPasskeys({ headers })         // User's passkeys
auth.api.listOrganizations({ headers })    // User's organizations
auth.api.signOut({ headers })              // Sign out server-side
```

### Plugin endpoints via type assertion

Plugin-added server endpoints aren't on the base `auth.api` type. Cast to access them:

```typescript
import { admin } from "better-auth/plugins/admin";

const adminApi = auth.api as typeof auth.api & ReturnType<typeof admin>["endpoints"];

const hasAccess = await adminApi.userHasPermission({
  headers: await headers(),
  body: { permissions: { user: ["list"] } },
});

const users = await adminApi.listUsers({
  headers: await headers(),
  query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
});
```

---

## 3. Client-Side Auth (`authClient.*`)

### When to use
- Client Components (`"use client"`) performing mutations
- React hooks (`useSession`, etc.) for reactive state
- Browser-based flows (OAuth redirects, WebAuthn passkeys)

```typescript
"use client";
import { authClient } from "@/lib/auth/auth-client";

// Reactive hooks
const { data: session, isPending } = authClient.useSession();
const { data: activeOrg } = authClient.useActiveOrganization();
const { data: orgs } = authClient.useListOrganizations();

// Mutations (return { data, error })
await authClient.signIn.email({ email, password });
await authClient.signIn.social({ provider: "github", callbackURL: "/" });
await authClient.signIn.passkey({ autoFill: true });
await authClient.signOut();
await authClient.updateUser({ name: "New Name" });
await authClient.changeEmail({ newEmail, callbackURL: "/" });
await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
await authClient.deleteUser({ callbackURL: "/" });
await authClient.linkSocial({ provider: "github", callbackURL: "/" });
await authClient.revokeOtherSessions();

// Two-factor (requires twoFactorClient plugin)
await authClient.twoFactor.enable({ password });       // returns { totpURI, backupCodes }
await authClient.twoFactor.disable({ password });
await authClient.twoFactor.verifyTotp({ code });
await authClient.twoFactor.verifyBackupCode({ code });

// Passkeys (requires passkeyClient plugin)
await authClient.passkey.addPasskey({ name });
await authClient.passkey.deletePasskey({ id });

// Organizations (requires organizationClient plugin)
await authClient.organization.create({ name, slug });
await authClient.organization.setActive({ organizationId });
await authClient.organization.inviteMember({ email, role });
await authClient.organization.acceptInvitation({ invitationId });
await authClient.organization.rejectInvitation({ invitationId });
await authClient.organization.cancelInvitation({ invitationId });
await authClient.organization.removeMember({ memberIdOrEmail });

// Admin (requires adminClient plugin)
await authClient.admin.hasPermission({ permissions: { user: ["list"] } });
await authClient.admin.impersonateUser({ userId });
await authClient.admin.stopImpersonating();
await authClient.admin.banUser({ userId });
await authClient.admin.unbanUser({ userId });
await authClient.admin.revokeUserSessions({ userId });
await authClient.admin.removeUser({ userId });
```

---

## 4. Decision Guide: Server vs Client

| Operation                    | Server (`auth.api.*`)          | Client (`authClient.*`)              |
| ---------------------------- | ------------------------------ | ------------------------------------ |
| Protect a page (redirect)    | ✅ RSC + `redirect()`           | ❌                                    |
| Display user info in RSC     | ✅ `auth.api.getSession`        | ❌                                    |
| Sign in / sign up form       | ❌                              | ✅ Client Component                   |
| OAuth redirect               | ❌                              | ✅ `authClient.signIn.social`         |
| WebAuthn / Passkeys          | ❌                              | ✅ Browser API required               |
| Reactive session state       | ❌                              | ✅ `useSession` hook                  |
| List sessions (read display) | ✅ Server Component             | ✅ Client Component                   |
| Revoke session (mutation)    | ❌                              | ✅ `authClient.revokeOtherSessions`   |
| RBAC permission check        | ✅ `adminApi.userHasPermission` | ✅ `authClient.admin.hasPermission`   |
| Impersonation                | ❌                              | ✅ `authClient.admin.impersonateUser` |

---

## 5. Protected Page Pattern (Server Component)

```typescript
// app/profile/page.tsx
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN);

  // Cast to include additionalFields not on the base type
  const user = session.user as typeof session.user & {
    favoriteNumber: number;
    role?: string;
    twoFactorEnabled?: boolean;
  };

  return <ProfileForm user={user} />;
}
```

### Permission-gated page (Admin example)

```typescript
// app/admin/page.tsx
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect(ROUTES.AUTH.LOGIN);

  const adminApi = auth.api as typeof auth.api & ReturnType<typeof admin>["endpoints"];

  const hasAccess = await adminApi.userHasPermission({
    headers: await headers(),
    body: { permissions: { user: ["list"] } },
  });
  if (!hasAccess.success) return redirect(ROUTES.HOME);

  const users = await adminApi.listUsers({
    headers: await headers(),
    query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
  });

  return <AdminTable users={users.users} />;
}
```

---

## 6. Passing Session Data to Client Components

Fetch in the Server Component, pass as props. The Client Component can also call `useSession()` for reactive updates.

```typescript
// Server Component (page.tsx)
const session = await auth.api.getSession({ headers: await headers() });
if (session == null) return redirect("/auth/login");

// Pass only what the client needs
return <ProfileUpdateForm user={session.user} />;
```

```typescript
// Client Component
"use client";
import { authClient } from "@/lib/auth/auth-client";

// Either accept server-fetched props OR use the reactive hook
const { data: session } = authClient.useSession();
```

---

## 7. The `useSession()` Hook

```typescript
"use client";
const { data: session, isPending, error } = authClient.useSession();
```

| Property    | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| `isPending` | `true` while fetching; show skeleton/spinner                    |
| `data`      | `null` if unauthenticated; `{ session, user }` if authenticated |
| `error`     | Fetch error, if any                                             |

- Automatically re-fetches when auth state changes (sign-in, sign-out)
- Cached across re-renders via SWR-like mechanism
- `session.user` includes `additionalFields` when `inferAdditionalFields<typeof auth>()` plugin is present

---

## 8. Middleware (Cookie Presence Heuristic)

Use for fast redirects without a DB hit. **Does not validate the session** — that happens in the Server Component.

```typescript
// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/profile", "/admin", "/organizations"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  if (isProtected) {
    // Cookie name is set by Better Auth — defaults to "better-auth.session_token"
    const sessionToken = request.cookies.get("better-auth.session_token");
    if (!sessionToken) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

> **Note**: Middleware only checks cookie presence — NOT validity. A tampered or expired cookie still passes middleware. Always validate with `auth.api.getSession()` inside the Server Component.

---

## 9. Error Handling Pattern

Better Auth client methods return `{ data, error }`:

```typescript
const { data, error } = await authClient.signIn.email({ email, password });

if (error) {
  // error.message — human readable
  // error.status  — HTTP status code (e.g. 401, 403)
  // error.code    — machine readable (e.g. "INVALID_PASSWORD", "EMAIL_NOT_VERIFIED")
  toast.error(error.message);
  return;
}
// data is available here
```

Handle unverified email specifically:

```typescript
await authClient.signIn.email(
  { email, password },
  {
    onError: (ctx) => {
      if (ctx.error.code === "EMAIL_NOT_VERIFIED") {
        // Prompt user to check inbox or resend
      }
    },
  },
);
```

---

## 10. TypeScript Types

Export inferred types from `auth.ts` for use across the app:

```typescript
// lib/auth/auth.ts
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session["user"];
```

Use in components:

```typescript
import type { User } from "@/lib/auth/auth";

function UserCard({ user }: { user: User }) { ... }
```

For additional fields that aren't on the base type, cast at the point of use (see section 5).

---

## References

- https://www.better-auth.com/docs/integrations/next-js
- https://www.better-auth.com/docs/concepts/session-management
