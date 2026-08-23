# Better Auth — Organization Plugin

> Covers: plugin setup, database schema, CRUD operations, invitation flow, member management, access control (RBAC), and session integration.
> Stack: Better Auth 1.4.x, Next.js App Router, Drizzle ORM (PostgreSQL).

---

## 1. Plugin Setup

### Server — `lib/auth/auth.ts`

```typescript
import { organization } from "better-auth/plugins/organization";
import { sendOrganizationInviteEmail } from "@/lib/emails/organization-invite-email";

export const auth = betterAuth({
  plugins: [
    organization({
      allowUserToCreateOrganization: true, // or async (user) => boolean
      organizationLimit: undefined,        // max orgs per user (undefined = unlimited)
      creatorRole: "owner",                // role assigned to org creator
      membershipLimit: 100,               // max members per org
      invitationExpiresIn: 48 * 60 * 60, // 48 hours in seconds
      sendInvitationEmail: async ({ email, organization, inviter, invitation }) => {
        await sendOrganizationInviteEmail({
          invitation,
          inviter: inviter.user,
          organization,
          email,
        });
      },
    }),
  ],
});
```

> The `sendInvitationEmail` callback receives: `invitation.id`, `email`, `organization` (`{ id, name, slug }`), `inviter` (`{ user: { name, email } }`).  
> Only fires when the invitee is **not** already a member of the organisation.

### Client — `lib/auth/auth-client.ts`

The client plugin **must** be registered to match the server. Omitting it means organisation hooks and type inference silently fail.

```typescript
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    // If using custom AC, pass ac and roles here:
    // organizationClient({ ac, roles: { owner, admin, member } })
  ],
});
```

---

## 2. Database Schema

Running `npx auth@latest generate` after enabling the plugin adds four tables and extends `session`.

### New Tables

| Table          | Key Columns                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `organization` | `id`, `name`, `slug` (unique), `logo?`, `metadata?`, `createdAt`                                                  |
| `member`       | `id`, `organizationId` (FK→org, cascade), `userId` (FK→user, cascade), `role`, `createdAt`                        |
| `invitation`   | `id`, `organizationId` (FK→org, cascade), `email`, `inviterId` (FK→user, cascade), `role?`, `status`, `expiresAt` |

### `session` Table Additions

| Column                 | Type    | Purpose                                           |
| ---------------------- | ------- | ------------------------------------------------- |
| `activeOrganizationId` | `text?` | Tracks which org the user is currently working in |

### Drizzle Schema (PostgreSQL)

```typescript
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(), // "pending"|"accepted"|"rejected"|"canceled"
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
```

### Invitation Status Constants

```typescript
export const INVITATION_STATUS = {
  PENDING:  "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELED: "canceled",
} as const;
```

---

## 3. Creating an Organisation

```typescript
import { createSlug } from "@/lib/create-slug"; // e.g. "Acme Corp" → "acme-corp"

const { data, error } = await authClient.organization.create({
  name: "Acme Corp",
  slug: createSlug("Acme Corp"), // required, globally unique
  logo: "https://...",           // optional
  metadata: { plan: "free" },   // optional, stored as JSON string
});
// Creator is automatically added as "owner"

if (!error) {
  await authClient.organization.setActive({ organizationId: data.id });
}
```

### Validation Schema

```typescript
import z from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  // slug derived from name before calling authClient; do not expose it in the form
});
```

---

## 4. Auto-Active Organisation on Session Create

When a new session is created, inject the user's most recent organisation membership so the active org is set automatically on first login:

```typescript
import { desc, eq } from "drizzle-orm";
import { member } from "@/drizzle/schema";

// lib/auth/auth.ts — inside betterAuth({ ... })
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

---

## 5. Listing User Organisations

### Client (React)

```typescript
const { data: organizations } = authClient.useListOrganizations();
// Reactive hook; updates when the user joins or leaves an org
```

### Client (imperative)

```typescript
const { data: organizations } = await authClient.organization.list();
// Returns only organisations the current user is a member of
```

### Server

```typescript
import { headers } from "next/headers";

const organizations = await auth.api.listOrganizations({
  headers: await headers(),
});
```

---

## 6. Switching the Active Organisation

```typescript
// Client — imperative
await authClient.organization.setActive({ organizationId: "org_123" });

// Client — with error handling
authClient.organization.setActive(
  { organizationId: "org_123" },
  {
    onError: (error) => toast.error(error.error.message ?? "Failed to switch"),
  }
);
```

Reading the active organisation:

```typescript
// React hook — reactive
const { data: activeOrganization } = authClient.useActiveOrganization();
// Returns full org object including .members and .invitations

// From session (client)
const { data: session } = authClient.useSession();
const activeOrgId = session?.session.activeOrganizationId;

// Server
const session = await auth.api.getSession({ headers: await headers() });
const activeOrgId = session?.session.activeOrganizationId;
```

### Organisation Switcher Component Pattern

```typescript
export function OrganizationSelect() {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: organizations } = authClient.useListOrganizations();

  if (!organizations?.length) return null;

  return (
    <select
      value={activeOrganization?.id ?? ""}
      onChange={(e) =>
        authClient.organization.setActive({ organizationId: e.target.value })
      }
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
    </select>
  );
}
```

---

## 7. Getting Full Organisation Details

```typescript
const { data: org } = await authClient.organization.getFullOrganization({
  query: {
    organizationId: "org_123",
    membersLimit: 100, // optional pagination
  },
});
// Returns: organization + members[] (each with .user) + invitations[]
```

> `useActiveOrganization()` already returns the full organisation object including `members` and `invitations`. For the active org, prefer the hook over calling `getFullOrganization` separately.

---

## 8. Inviting Members

```typescript
const { data, error } = await authClient.organization.inviteMember({
  email: "colleague@example.com",
  role: "member",      // "owner" | "admin" | "member"
  organizationId: "org_123",
  resend: true,        // resend if a pending invitation already exists
});
```

### Invite Form Validation Schema

```typescript
import { ORG_ROLES } from "@/lib/auth/roles";
import z from "zod";

export const createInviteSchema = z.object({
  email: z.email().min(1).trim(),
  role: z.enum([ORG_ROLES.MEMBER, ORG_ROLES.ADMIN]),
  // "owner" is intentionally excluded — promote via updateMemberRole after accepting
});
```

### Invite Email Helper

```typescript
// lib/emails/organization-invite-email.ts
export async function sendOrganizationInviteEmail({
  invitation,
  inviter,
  organization,
  email,
}: {
  invitation: { id: string };
  inviter: { name: string };
  organization: { name: string };
  email: string;
}) {
  const inviteUrl = `${process.env.BETTER_AUTH_URL}/organizations/invites/${invitation.id}`;
  await sendEmail({
    to: email,
    subject: `You're invited to join the ${organization.name} organization`,
    html: `<a href="${inviteUrl}">Manage Invitation</a>`,
  });
}
```

---

## 9. Invitation Accept / Reject Flow

### Step-by-step

1. Admin calls `authClient.organization.inviteMember()`.
2. Server triggers `sendInvitationEmail` hook.
3. Email is sent containing: `${BETTER_AUTH_URL}/organizations/invites/${invitation.id}`.
4. Recipient clicks link → navigates to `/organizations/invites/[id]`.
5. Page (server component) fetches invitation details via `auth.api.getInvitation`.
6. User clicks **Accept** or **Reject**.
7. On accept: user becomes a member; client sets active org and redirects to dashboard.
8. On reject: user is redirected home; invitation status set to `"rejected"`.

### Route Page — `/organizations/invites/[id]/page.tsx`

```typescript
import { auth } from "@/lib/auth/auth";
import { organization } from "better-auth/plugins/organization";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function InvitationPage({
  params,
}: PageProps<"/organizations/invites/[id]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session == null) return redirect("/auth/login");

  // Cast the API to include organisation endpoints
  const organizationApi = auth.api as typeof auth.api &
    ReturnType<typeof organization>["endpoints"];

  const { id } = await params;

  const invitation = await organizationApi
    .getInvitation({ headers: await headers(), query: { id } })
    .catch(() => redirect("/"));

  // Render invitation details and pass to client component for accept/reject
}
```

### Client Component — Accept and Reject

```typescript
"use client";

import { authClient } from "@/lib/auth/auth-client";
import { useRouter } from "next/navigation";

export function InviteInformation({
  invitation,
}: {
  invitation: { id: string; organizationId: string };
}) {
  const router = useRouter();

  function acceptInvite() {
    return authClient.organization.acceptInvitation(
      { invitationId: invitation.id },
      {
        onSuccess: async () => {
          await authClient.organization.setActive({
            organizationId: invitation.organizationId,
          });
          router.push("/organizations");
        },
      }
    );
  }

  function rejectInvite() {
    return authClient.organization.rejectInvitation(
      { invitationId: invitation.id },
      { onSuccess: () => router.push("/") }
    );
  }

  // Render Accept / Reject buttons backed by these handlers
}
```

### Fetching Invitation Details (standalone)

```typescript
const { data: invite } = await authClient.organization.getInvitation({
  query: { id: inviteId },
});
// Returns: organizationId, organizationName, role, expiresAt, status, inviterName
```

---

## 10. Cancelling an Invitation (Admin / Inviter)

```typescript
const { error } = await authClient.organization.cancelInvitation({
  invitationId: "inv_123",
});
// Sets invitation.status to "canceled"
```

Listing only pending invitations (filter client-side from `useActiveOrganization`):

```typescript
const { data: activeOrg } = authClient.useActiveOrganization();

const pendingInvites = activeOrg?.invitations?.filter(
  (invite) => invite.status === "pending"
);
```

---

## 11. Managing Members

### Removing a Member

```typescript
const { error } = await authClient.organization.removeMember({
  memberIdOrEmail: memberId, // member.id or user email
  organizationId: "org_123",
});
```

> Guard against self-removal: compare `member.userId !== session?.user.id` before showing the remove button.

### Updating a Member's Role

```typescript
const { error } = await authClient.organization.updateMemberRole({
  memberId: "member_id",
  role: "admin",           // "owner" | "admin" | "member"
  organizationId: "org_123",
});
```

### Adding a Member Directly (Server Only — No Invitation)

```typescript
const data = await auth.api.addMember({
  body: {
    userId: "user_id",
    role: ["admin"],
    organizationId: "org_123",
  },
});
```

### Member Leaving an Organisation

```typescript
const { error } = await authClient.organization.leave({
  organizationId: "org_123",
});
```

### Getting the Current User's Active Membership

```typescript
const { data: member } = await authClient.organization.getActiveMember();
// Returns the member row for the current user in the active org

const { data: { role } } = await authClient.organization.getActiveMemberRole();
```

---

## 12. Roles and Permissions

### Default Roles

| Role     | Capabilities                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------ |
| `owner`  | Full control; can transfer ownership, delete the organisation, manage all members                |
| `admin`  | Can invite members, cancel invitations, remove members, update member roles, update org settings |
| `member` | Read-only access; cannot manage members or settings                                              |

### Role Constants

```typescript
// lib/auth/roles.ts
export const ORG_ROLES = {
  OWNER:  "owner",
  ADMIN:  "admin",
  MEMBER: "member",
} as const;
```

### Custom Roles with Access Control (RBAC)

```typescript
// components/auth/utils/permissions.ts
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

const member = ac.newRole({ project: ["create", "read"] });
const admin  = ac.newRole({ project: ["create", "read", "update"] });
const owner  = ac.newRole({ project: ["create", "read", "update", "delete"] });
```

Register on both server and client:

```typescript
// Server
organization({ ac, roles: { owner, admin, member } })

// Client
organizationClient({ ac, roles: { owner, admin, member } })
```

---

## 13. Checking Permissions

### Server

```typescript
import { headers } from "next/headers";

const result = await auth.api.hasPermission({
  headers: await headers(),
  body: { permissions: { project: ["create"] } },
});
// Returns { success: boolean }
```

### Client (async — makes server call)

```typescript
const canCreate = await authClient.organization.hasPermission({
  permissions: { project: ["create"] },
});
```

### Client (synchronous — no server call)

```typescript
const hasAccess = authClient.organization.checkRolePermission({
  permissions: { project: ["delete"] },
  role: "admin",
});
// Returns boolean; use for conditional UI rendering
```

---

## 14. Deleting an Organisation

```typescript
const { error } = await authClient.organization.delete({
  organizationId: "org_123",
});
// Only the owner can delete
// Cascades: removes all members and invitations via FK cascade
```

Disable deletion globally:

```typescript
organization({ disableOrganizationDeletion: true })
```

---

## 15. Updating an Organisation

```typescript
const { error } = await authClient.organization.update({
  organizationId: "org_123",
  data: {
    name: "New Name",
    slug: "new-slug",
    logo: "https://...",
    metadata: { plan: "pro" },
  },
});
```

---

## 16. Organisation Lifecycle Hooks

```typescript
organization({
  organizationHooks: {
    beforeCreateOrganization: async ({ organization, user }) => ({ data: organization }),
    afterCreateOrganization:  async ({ organization, member, user }) => {},
    beforeAddMember:          async ({ member, user, organization }) => ({ data: member }),
    afterAddMember:           async ({ member, user, organization }) => {},
    beforeRemoveMember:       async ({ member, user, organization }) => {},
    afterRemoveMember:        async ({ member, user, organization }) => {},
    beforeUpdateMemberRole:   async ({ member, newRole, user, organization }) => ({ data: { role: newRole } }),
    afterUpdateMemberRole:    async ({ member, previousRole, user, organization }) => {},
    beforeCreateInvitation:   async ({ invitation, inviter, organization }) => ({ data: invitation }),
    afterCreateInvitation:    async ({ invitation, inviter, organization }) => {},
    beforeAcceptInvitation:   async ({ invitation, user, organization }) => {},
    afterAcceptInvitation:    async ({ invitation, member, user, organization }) => {},
    beforeRejectInvitation:   async ({ invitation, user, organization }) => {},
    afterRejectInvitation:    async ({ invitation, user, organization }) => {},
    beforeCancelInvitation:   async ({ invitation, cancelledBy, organization }) => {},
    afterCancelInvitation:    async ({ invitation, cancelledBy, organization }) => {},
  },
})
```

> `before*` hooks can mutate the data by returning `{ data: modifiedPayload }` or block the operation by throwing.

---

## 17. Schema Generation After Config Changes

```bash
# After modifying the organization plugin config in lib/auth/auth.ts:
npx auth@latest generate        # regenerates schema
npm run db:generate             # creates Drizzle migration SQL
npm run db:migrate              # applies migration to the database

# Or push directly during development (skips migration files):
npm run db:push
```

---

## References

- https://www.better-auth.com/docs/plugins/organization
