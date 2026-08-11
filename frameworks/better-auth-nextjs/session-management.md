# Session Management — Better Auth + Next.js

## 1. Session Architecture

Better Auth stores sessions in the `session` database table. Each session record contains:

| Column                 | Type          | Notes                                            |
| ---------------------- | ------------- | ------------------------------------------------ |
| `id`                   | `text` PK     |                                                  |
| `token`                | `text` UNIQUE | Stored in the HTTP-only cookie; used for lookups |
| `userId`               | `text` FK     | Cascade delete on user removal                   |
| `expiresAt`            | `timestamp`   | Absolute expiry                                  |
| `ipAddress`            | `text`        | Captured from request                            |
| `userAgent`            | `text`        | Browser/device fingerprint                       |
| `impersonatedBy`       | `text`        | Admin plugin: admin's userId                     |
| `activeOrganizationId` | `text`        | Organization plugin: active org context          |

The cookie holds the **session token** (not the full session object). On each authenticated request Better Auth performs a DB lookup using this token, unless the cookie cache is enabled (see §3).

---

## 2. `nextCookies` Plugin (Required for Next.js)

```typescript
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  plugins: [
    nextCookies(), // required; position in array does not matter
    // ... other plugins ...
  ],
});
```

Next.js uses a different async cookies API (`cookies()` from `next/headers`) compared to the standard Express-style `req`/`res`. The `nextCookies` plugin bridges Better Auth's internal cookie management with Next.js's API, enabling session cookies to work correctly in Server Components and Server Actions.

**Without this plugin**: sessions will not persist correctly in Next.js App Router.

> **Note:** Better Auth imposes no ordering requirement on `nextCookies` within the plugins array. It is commonly placed first or last for readability, but any position works.

---

## 3. Session Configuration

### 3.1 Expiry and Refresh

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7,  // absolute TTL: 7 days
  updateAge: 60 * 60 * 24,       // rolling: extend expiry if session is within 1 day of expiry
  freshAge: 60 * 60 * 24,        // "fresh" window: session considered fresh if < 1 day old
},
```

- **`expiresIn`**: Hard expiry from creation time. After this, the session is invalid.
- **`updateAge`**: If the session's remaining lifetime is less than this value, Better Auth automatically extends it to `expiresIn` from now. This creates a rolling session for active users.
- **`freshAge`**: Some operations (e.g., sensitive account changes) may require a "fresh" session. A session is fresh if it was created within this window.

### 3.2 Cookie Cache (Performance)

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7,
  updateAge: 60 * 60 * 24,
  cookieCache: {
    enabled: true,
    maxAge: 60 * 60 * 24 * 7, // cache duration (should match expiresIn)
    strategy: "jwt",           // "compact" | "jwt" | "jwe"
    refreshCache: true,        // auto-refresh cache at 80% of maxAge
  },
},
```

**How it works:**
1. First request: DB lookup → result serialised and stored in a secondary cookie for `maxAge` seconds.
2. Subsequent requests within `maxAge`: session is read from the cookie directly — **no DB hit**.
3. After `maxAge` expires (or on `refreshCache` threshold): DB lookup triggers again.

**Cache strategies:**

| Strategy  | Cookie size | Security                | Use case                           |
| --------- | ----------- | ----------------------- | ---------------------------------- |
| `compact` | Smallest    | HMAC-SHA256 signed      | Default; minimal overhead          |
| `jwt`     | Medium      | HS256 signed            | JWT-compatible environments        |
| `jwe`     | Largest     | A256CBC-HS512 encrypted | When cookie content must be opaque |

**Trade-off**: Session state changes (revocation, role change, ban) take up to `maxAge` seconds to propagate to requests that hit the cache. For security-sensitive changes, force a fresh DB lookup:

```typescript
// Bypass the cookie cache for a one-time fetch
const { data: session } = await authClient.getSession({
  query: { disableCookieCache: true },
});
```

---

## 4. Getting the Current Session

### Server Components / Route Handlers

```typescript
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/login");

  return <div>Hello, {session.user.name}</div>;
}
```

`auth.api.getSession` performs a full validation (DB lookup or cache hit depending on config) and returns `null` for expired/invalid tokens.

### Client Components

```typescript
"use client";
import { authClient } from "@/lib/auth/auth-client";

export function UserInfo() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <Spinner />;
  if (!session) return <LoginPrompt />;
  return <div>{session.user.email}</div>;
}
```

`authClient.useSession()` is a reactive hook — it re-renders on session changes. For a one-shot fetch without reactivity:

```typescript
const { data: session } = await authClient.getSession();
```

---

## 5. Listing Active Sessions

### Server (fetches all sessions for the authenticated user)

```typescript
// In a Server Component — used in SessionsTab
const sessions = await auth.api.listSessions({ headers: await headers() });
```

### Client

```typescript
const { data: sessions } = await authClient.listSessions();
// Returns: Session[] — all active sessions for the current user
```

### Identifying the Current Session

Sessions are identified by `token`, not `id`. The current session's token is available from `session.session.token`. Compare it against the list to mark "Current":

```typescript
const { data: currentSession } = authClient.useSession();

sessions.filter((s) => s.token !== currentSession?.session.token); // other sessions
```

The codebase passes `currentSessionToken` down from the Server Component to avoid redundant client-side fetches:

```typescript
// SessionsTab (Server Component)
export async function SessionsTab({ currentSessionToken }: { currentSessionToken: string }) {
  const sessions = await auth.api.listSessions({ headers: await headers() });
  return <SessionManagement sessions={sessions} currentSessionToken={currentSessionToken} />;
}

// SessionManagement (Client Component)
const otherSessions = sessions.filter((s) => s.token !== currentSessionToken);
const currentSession = sessions.find((s) => s.token === currentSessionToken);
```

---

## 6. Revoking Sessions

### Revoke a Specific Session (by token)

```typescript
await authClient.revokeSession(
  { token: session.token },
  { onSuccess: () => router.refresh() },
);
```

Users can only revoke their own sessions. Passing another user's token will fail silently or return an error.

### Revoke All Other Sessions (keep current)

```typescript
await authClient.revokeOtherSessions(undefined, {
  onSuccess: () => router.refresh(),
});
```

Use this for "Sign out all other devices" functionality.

### Revoke All Sessions (sign out everywhere)

```typescript
await authClient.revokeSessions();
```

### Sign Out (invalidate current session)

```typescript
await authClient.signOut();
// Clears the session cookie and removes the DB record.
```

### Admin: Revoke Sessions for Another User

```typescript
// Revoke a specific session
await authClient.admin.revokeUserSession({ sessionToken: "token" });

// Revoke ALL sessions for a user
await authClient.admin.revokeUserSessions({ userId: "user_id" });
```

---

## 7. Device Fingerprinting in the UI

Better Auth captures `ipAddress` and `userAgent` automatically from request headers. Use a UA parser to render human-readable device info:

```typescript
import { UAParser } from "ua-parser-js";

function getDeviceLabel(userAgent?: string | null): string {
  if (!userAgent) return "Unknown Device";
  const { browser, os } = UAParser(userAgent);
  if (!browser.name && !os.name) return "Unknown Device";
  if (!browser.name) return os.name!;
  if (!os.name) return browser.name;
  return `${browser.name}, ${os.name}`;
}

// Usage in session list
sessions.map((s) => ({
  label: getDeviceLabel(s.userAgent),
  ip: s.ipAddress,
  createdAt: new Date(s.createdAt),
  isCurrent: s.token === currentSessionToken,
}));
```

---

## 8. Session Hooks — Pre-populating Fields on Create

Use `databaseHooks.session.create.before` to enrich new sessions before they are written to the DB. The codebase uses this to auto-set `activeOrganizationId`:

```typescript
databaseHooks: {
  session: {
    create: {
      before: async (userSession) => {
        const membership = await db.query.member.findFirst({
          where: eq(member.userId, userSession.userId),
          orderBy: desc(member.createdAt),
          columns: { organizationId: true },
        });
        return {
          data: { ...userSession, activeOrganizationId: membership?.organizationId },
        };
      },
    },
  },
},
```

**Always spread `userSession`** — returning only the new fields will drop required columns.

---

## 9. Active Organization in Session

When using the Organization plugin, sessions track which org is currently active:

```typescript
session.session.activeOrganizationId // string | undefined
```

Switch the active org (updates the session record):

```typescript
await authClient.organization.setActive({ organizationId: "org_123" });
```

Read it reactively via `useSession()` — no separate hook needed. The codebase pre-populates `activeOrganizationId` on session creation (§8) so users land in their most recently joined org.

---

## 10. Impersonation Sessions

When an admin impersonates a user via `authClient.admin.impersonateUser({ userId })`:

- A new session is created for the target user.
- `session.session.impersonatedBy` is set to the admin's `userId`.
- The impersonation session expires after `impersonationSessionDuration` (default: 1 hour).

Detect impersonation in the UI:

```typescript
const { data: session } = authClient.useSession();
const isImpersonating = !!session?.session.impersonatedBy;

// End impersonation
await authClient.admin.stopImpersonating();
```

---

## 11. Route Protection

Better Auth does not ship middleware. The recommended pattern is page-level protection in Server Components:

```typescript
// app/dashboard/page.tsx
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/login");
  // Proceed with session.user
}
```

### Optional: Middleware for Early Redirects

Cookie presence is a heuristic — it does not validate the token. Full validation only happens in Server Components via `auth.api.getSession()`.

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("better-auth.session_token");
  if (!sessionToken && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*"],
};
```

Use middleware for UX-only early redirects (avoids a flash of protected content). Never rely on it as the sole security gate.

---

## 12. Customising the Session Response

Use the `customSession` plugin to augment what `getSession` returns — useful for joining extra data from the DB without repeating the fetch in every component:

```typescript
import { customSession } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    customSession(async ({ user, session }) => {
      const permissions = await getPermissionsForUser(user.id);
      return {
        user: { ...user, permissions },
        session,
      };
    }),
    nextCookies(),
  ],
});
```

Add the matching client plugin to infer the extended type:

```typescript
import { customSessionClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [customSessionClient<typeof auth>()],
});
```

---

## 13. Full Session Type Reference

```typescript
type Session = {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    ipAddress?: string;
    userAgent?: string;
    // Admin plugin
    impersonatedBy?: string;
    // Organization plugin
    activeOrganizationId?: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string;
    createdAt: Date;
    updatedAt: Date;
    // Admin plugin
    role?: string;
    banned?: boolean;
    banReason?: string;
    banExpires?: Date;
    // Two-factor plugin
    twoFactorEnabled?: boolean;
    // Custom additionalFields (project-specific)
    favoriteNumber?: number;
  };
};
```

---

## References

- https://www.better-auth.com/docs/concepts/session-management
- https://www.better-auth.com/docs/integrations/next-js
