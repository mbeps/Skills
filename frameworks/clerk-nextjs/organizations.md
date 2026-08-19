# Organizations: Multi-Tenant Patterns

## Quick Reference

| Concept           | API                                | Use Case                             |
| ----------------- | ---------------------------------- | ------------------------------------ |
| Check membership  | `has()`                            | Guard routes/components by role/slug |
| Get org ID        | `auth().orgId` / `useAuth().orgId` | Pass to server queries               |
| Switch org        | `<OrganizationSwitcher />`         | UI for switching between orgs        |
| Create org        | `<CreateOrganization />`           | UI for creating new orgs             |
| Org details       | `useOrganization()`                | Display org name, slug, members      |
| Server-side check | `auth().sessionClaims?.org_roles`  | Protect server logic                 |

## Enable Organizations

Organizations must be enabled in the Clerk Dashboard → Settings → Organizations, or via CLI:

```bash
clerk enable orgs
```

## Client-Side Organization Checks

### `has()` Hook

Check if the current user has a specific role or slug in the active organization. Available from `useAuth()`, `useUser()`, and `useOrganization()` — not just `useAuth()`.

```tsx
'use client';

import { useOrganization } from '@clerk/nextjs';

export function AdminPanel() {
  const { isLoaded, organization } = useOrganization();

  if (!isLoaded) return <div>Loading...</div>;
  if (!organization) return <div>No organization selected</div>;

  return (
    <div>
      <h2>{organization.name} Admin Panel</h2>
    </div>
  );
}
```

### `useAuth()` Org Properties

```tsx
'use client';

import { useAuth } from '@clerk/nextjs';

export function RoleGuard() {
  const { isSignedIn, orgId, orgRole, orgSlug } = useAuth();

  if (!isSignedIn) return <SignInButton />;
  if (!orgId) return <div>Select an organization</div>;

  // Check role
  if (orgRole !== 'admin') return <div>Admins only</div>;

  return <AdminDashboard />;
}
```

Properties: `orgId` (current org ID), `orgRole` (user's role in org), `orgSlug` (slug of current org).

### `has()` Function

Check specific roles or slugs:

```tsx
'use client';

import { useAuth } from '@clerk/nextjs';

export function RestrictedContent() {
  const { has } = useAuth();

  // Check by role
  if (!has({ role: 'admin' })) return <Unauthorized />;

  // Check by slug
  if (!has({ slug: 'acme-corp' })) return <WrongOrg />;

  // Check multiple conditions
  if (!has({
    role: 'admin',
    slug: 'acme-corp'
  })) return <Unauthorized />;

  return <RestrictedContentInner />;
}
```

## Server-Side Organization Checks

```ts
import { auth } from '@clerk/nextjs/server';

export default async function Page() {
  const { userId, orgId, sessionClaims } = await auth();

  if (!userId) return <SignInButton />;
  if (!orgId) return <div>No organization selected</div>;

  // Check roles from session claims (org_roles, NOT org_permissions)
  // NOTE: System Permissions are NOT included in session claims per Clerk docs.
  // For role checks, use sessionClaims?.org_roles?.[orgId]?.role
  // For custom permissions, check sessionClaims?.org_permissions?.[orgId] (only custom perms)
  const roles = sessionClaims?.org_roles?.[orgId]?.role || [];

  if (!roles.includes('admin')) {
    return <div>Admins only</div>;
  }

  return <AdminPanel orgId={orgId} />;
}
```

## Prebuilt Organization Components

### `<OrganizationSwitcher />`

Dropdown for switching between organizations and joining invited ones.

```tsx
import { OrganizationSwitcher } from '@clerk/nextjs';

<OrganizationSwitcher
  afterCreateUrl="/organizations/new"
  afterSelectPersonalUrl="/dashboard"
  afterSelectOrganizationUrl="/organizations/:orgId/settings"
  afterLeaveOrganizationUrl="/dashboard"
  appearance={{
    elements: {
      rootBox: 'w-full',
      card: 'border rounded-lg shadow-sm',
    },
  }}
/>
```

### `<CreateOrganization />`

Form for creating new organizations.

```tsx
import { CreateOrganization } from '@clerk/nextjs';

<CreateOrganization
  afterCreateUrl="/organizations/:id/settings"
/>
```

### `<OrganizationProfile />`

Full org management UI (rename, leave, manage members).

```tsx
import { OrganizationProfile } from '@clerk/nextjs';

<OrganizationProfile
  routing="hash"
  afterLeaveOrganizationUrl="/dashboard"
/>
```

## Server-Side Org Data

```ts
import { auth } from '@clerk/nextjs/server';

export async function getOrgData() {
  const { orgId } = await auth();

  if (!orgId) return null;

  // Use Clerk Backend API to fetch org details
  // Note: requires server-side only code
  // const org = await clerk.organizations.getOrganization({ organizationId: orgId });

  return { orgId };
}
```

## Common Pitfalls

- **Never assume an org exists:** Always check `orgId` before accessing org data. Users may not be in any organization.
- **`has()` checks the active org:** It checks against the currently selected organization, not all orgs the user belongs to.
- **Server-side roles come from session claims:** Read `sessionClaims.org_roles` or `sessionClaims.org_permissions`, not from your database.
- **Don't mix client and server org checks:** Be consistent — use `has()` on client, `sessionClaims` on server.
- **Enable organizations first:** Must be enabled in Dashboard or via `clerk enable orgs` before using any org features.
