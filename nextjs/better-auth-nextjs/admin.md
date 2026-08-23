# Better Auth — Admin Plugin (Next.js)

Reference for the `admin` plugin: user management, access control, impersonation, banning, and session revocation.

---

## 1. Plugin Setup

### Server — `lib/auth/auth.ts`

```typescript
import { admin as adminPlugin } from "better-auth/plugins/admin";
import { ac, admin, user } from "@/components/auth/utils/permissions";
import { GLOBAL_ROLES } from "@/lib/auth/roles";

export const auth = betterAuth({
  plugins: [
    adminPlugin({
      ac,
      roles: {
        [GLOBAL_ROLES.ADMIN]: admin,
        [GLOBAL_ROLES.USER]: user,
      },
      defaultBanReason: "Violation of terms of service",
      defaultBanExpiresIn: undefined,         // undefined = permanent ban
      impersonationSessionDuration: 60 * 60,  // 1 hour
    }),
  ],
});
```

### Client — `lib/auth/auth-client.ts`

```typescript
import { adminClient } from "better-auth/client/plugins";
import { ac, admin, user } from "@/components/auth/utils/permissions";
import { GLOBAL_ROLES } from "@/lib/auth/roles";

export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles: {
        [GLOBAL_ROLES.ADMIN]: admin,
        [GLOBAL_ROLES.USER]: user,
      },
    }),
  ],
});
```

> Both `ac` and `roles` **must match exactly** between server and client. A mismatch causes permission check failures at runtime.

---

## 2. Access Control Setup

### `components/auth/utils/permissions.ts`

```typescript
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, userAc, adminAc } from "better-auth/plugins/admin/access";

export const ac = createAccessControl(defaultStatements);

// User role: inherits built-in user permissions + "list"
export const user = ac.newRole({
  ...userAc.statements,
  user: [...userAc.statements.user, "list"],
});

// Admin role: all built-in admin permissions
export const admin = ac.newRole(adminAc.statements);
```

### Default admin permissions

The `adminAc` built-in grants:
- `user`: `["create", "list", "get", "update", "delete", "set-role", "set-password", "set-email", "ban", "impersonate"]`
- `session`: `["list", "revoke", "delete"]`

### `lib/auth/roles.ts` — role name constants

```typescript
export const GLOBAL_ROLES = {
  ADMIN: "admin",
  USER: "user",
} as const;
```

---

## 3. Database Schema Additions

The admin plugin adds these columns automatically (run `npm run auth:generate` + `npm run db:migrate`):

**`user` table:**
| Column       | Type             | Notes              |
| ------------ | ---------------- | ------------------ |
| `role`       | `string`         | Default `"user"`   |
| `banned`     | `boolean`        | Default `false`    |
| `banReason`  | `string \| null` | —                  |
| `banExpires` | `date \| null`   | `null` = permanent |

**`session` table:**
| Column           | Type             | Notes                               |
| ---------------- | ---------------- | ----------------------------------- |
| `impersonatedBy` | `string \| null` | Admin's `userId` when impersonating |

---

## 4. Assigning the Admin Role

Set `role: "admin"` directly in the database, or programmatically:

```typescript
// Server-side
await auth.api.setRole({ body: { userId: "user_123", role: "admin" } });

// Client-side (admin only)
await authClient.admin.setRole({ userId: "user_123", role: "admin" });
```

> **Security**: Never expose role assignment to untrusted input. The `role` field must have `input: false` in `additionalFields` if defined manually, so users cannot self-assign it at sign-up.

---

## 5. Protecting the Admin Page (Server Component)

```typescript
// app/admin/page.tsx
import { auth } from "@/lib/auth/auth";
import { admin, UserWithRole } from "better-auth/plugins/admin";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const adminApi = auth.api as typeof auth.api & ReturnType<typeof admin>["endpoints"];

  if (session == null) redirect("/auth/login");

  // Prefer permission check over raw role comparison — respects custom AC rules
  const hasAccess = await adminApi.userHasPermission({
    headers: await headers(),
    body: { permissions: { user: ["list"] } },
  });
  if (!hasAccess.success) redirect("/");

  const users = await adminApi.listUsers({
    headers: await headers(),
    query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
  });

  return <AdminDashboard users={users.users} total={users.total} />;
}
```

> Cast `auth.api` to include the admin endpoints type — the plugin extends the API surface but TypeScript does not merge it automatically without the cast.

---

## 6. Listing Users

### Server-side

```typescript
const users = await adminApi.listUsers({
  headers: await headers(),
  query: {
    limit: 100,
    offset: 0,
    sortBy: "createdAt",
    sortDirection: "desc",
  },
});
// users.users — UserWithRole[]
// users.total — number (for pagination)
```

### Client-side

```typescript
const { data } = await authClient.admin.listUsers({
  query: {
    limit: 10,
    offset: 0,
    searchField: "email",        // "name" | "email"
    searchValue: "user@",
    searchOperator: "contains",  // "contains" | "starts_with" | "ends_with"
    sortBy: "createdAt",
    sortDirection: "desc",       // "asc" | "desc"
    filterField: "role",
    filterValue: "admin",
    filterOperator: "eq",        // "eq" | "ne" | "contains" | "starts_with" | ...
  },
});
// data.users — UserWithRole[]
// data.total — number
```

### `UserWithRole` type

```typescript
import { UserWithRole } from "better-auth/plugins/admin";
// Extends the base user type with: role, banned, banReason, banExpires
```

---

## 7. Impersonation

### Start impersonation (client)

```typescript
authClient.admin.impersonateUser(
  { userId: "user_123" },
  {
    onSuccess: () => {
      refetch();           // update session cache
      router.push("/");    // navigate as the impersonated user
    },
    onError: (error) => toast.error(error.error.message),
  }
);
```

### Detecting an active impersonation session

```typescript
const { data: session } = authClient.useSession();
const isImpersonating = session?.session.impersonatedBy != null;
const adminId = session?.session.impersonatedBy; // the admin's userId
```

### Stop impersonation (client)

```typescript
authClient.admin.stopImpersonating(undefined, {
  onSuccess: () => {
    refetch();
    router.push("/admin");
  },
});
```

### Impersonation indicator — floating UI component

Always render this globally (e.g., in the root layout) so admins cannot forget they are impersonating:

```typescript
// components/auth/buttons/impersonation-indicator.tsx
"use client";

export function ImpersonationIndicator() {
  const router = useRouter();
  const { data: session, refetch } = authClient.useSession();

  if (session?.session.impersonatedBy == null) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Button
        variant="destructive"
        size="sm"
        onClick={() =>
          authClient.admin.stopImpersonating(undefined, {
            onSuccess: () => { router.push("/admin"); refetch(); },
          })
        }
      >
        <UserX className="size-4" />
        Stop Impersonating
      </Button>
    </div>
  );
}
```

> **Security**: Set `impersonationSessionDuration` to the shortest acceptable value (e.g., `60 * 60` = 1 hour). Without a duration limit, an impersonation session never expires.

---

## 8. Banning Users

```typescript
// Ban
authClient.admin.banUser(
  {
    userId: "user_123",
    banReason: "Spam",
    banExpiresIn: 60 * 60 * 24 * 7, // 7 days in seconds; undefined = permanent
  },
  {
    onSuccess: () => { toast.success("User banned"); router.refresh(); },
    onError: (error) => toast.error(error.error.message),
  }
);

// Unban
authClient.admin.unbanUser(
  { userId: "user_123" },
  {
    onSuccess: () => { toast.success("User unbanned"); router.refresh(); },
    onError: (error) => toast.error(error.error.message),
  }
);
```

Banned users attempting to sign in receive an error response from Better Auth — they are not silently dropped.

Read ban status from the session:
```typescript
session.user.banned      // boolean
session.user.banReason   // string | null
session.user.banExpires  // Date | null — null means permanent
```

---

## 9. Revoking Sessions

```typescript
// Revoke ALL sessions for a user
authClient.admin.revokeUserSessions(
  { userId: "user_123" },
  {
    onSuccess: () => toast.success("Sessions revoked"),
    onError: (error) => toast.error(error.error.message),
  }
);

// Revoke a specific session by token
await authClient.admin.revokeUserSession({ sessionToken: "tok_..." });

// List a user's active sessions
const { data } = await authClient.admin.listUserSessions({ userId: "user_123" });
```

---

## 10. Deleting Users

```typescript
authClient.admin.removeUser(
  { userId: "user_123" },
  {
    onSuccess: () => { toast.success("User deleted"); router.refresh(); },
    onError: (error) => toast.error(error.error.message),
  }
);
```

> **Warning**: Hard delete — cascades to sessions, accounts, linked OAuth providers, and organisation memberships. Always require an explicit confirmation (e.g., `AlertDialog`) before calling.

---

## 11. Permission Checking

### Server (inside Server Components or Route Handlers)

```typescript
const hasAccess = await adminApi.userHasPermission({
  headers: await headers(),
  body: { permissions: { user: ["list"] } },
});
// hasAccess.success — boolean
```

### Client — async check

```typescript
const { data } = await authClient.admin.hasPermission({
  permissions: { user: ["delete"] },
});
// data.success — boolean
```

### Client — synchronous role check (no network call)

```typescript
const canDelete = authClient.admin.checkRolePermission({
  permissions: { user: ["delete"] },
  role: "admin",
});
// boolean — checks locally against the roles config passed to adminClient()
```

---

## 12. UserRow Pattern — Client Component

The `UserRow` component drives all per-user admin actions. Key points from the codebase:

- **`isSelf` guard**: actions are hidden when `user.id === selfId` to prevent self-destructive operations.
- **`router.refresh()`** after ban/unban/delete to revalidate the server-rendered list without a full page reload.
- **`refetch()`** after impersonation to update the React session cache before redirecting.
- Destructive actions (`deleteUser`) are wrapped in an `AlertDialog` for confirmation.
- Ban/unban are toggled based on `user.banned` — show "Ban" or "Unban" conditionally.

```typescript
const isSelf = user.id === selfId;

// Only render actions for other users
{!isSelf && (
  <DropdownMenu>
    <DropdownMenuItem onClick={() => handleImpersonateUser(user.id)}>Impersonate</DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleRevokeSessions(user.id)}>Revoke Sessions</DropdownMenuItem>
    {user.banned
      ? <DropdownMenuItem onClick={() => handleUnbanUser(user.id)}>Unban</DropdownMenuItem>
      : <DropdownMenuItem onClick={() => handleBanUser(user.id)}>Ban</DropdownMenuItem>
    }
    <AlertDialogTrigger asChild>
      <DropdownMenuItem variant="destructive">Delete User</DropdownMenuItem>
    </AlertDialogTrigger>
  </DropdownMenu>
)}
```

---

## 13. Common Gotchas

| Gotcha                                             | Fix                                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `auth.api.listUsers` not typed on `auth.api`       | Cast: `auth.api as typeof auth.api & ReturnType<typeof admin>["endpoints"]`                                    |
| Permission check fails despite having correct role | Ensure `ac` + `roles` are identical objects in both server and client configs                                  |
| Impersonation session never expires                | Set `impersonationSessionDuration` in the plugin config                                                        |
| `role` field writable by users at sign-up          | Add `input: false` to `additionalFields.role` if defined manually; the admin plugin handles this automatically |
| `removeUser` vs `deleteUser`                       | The client method is `removeUser({ userId })`; the docs sometimes show `deleteUser` — use `removeUser`         |
| `router.refresh()` not updating data               | The admin page is server-rendered; `router.refresh()` re-runs the server component and re-fetches users        |

---

## References

- https://www.better-auth.com/docs/plugins/admin
