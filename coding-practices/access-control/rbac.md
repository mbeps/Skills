# RBAC Reference

Role-Based Access Control: users → roles → permissions. Formalized by Ferraiolo & Kuhn (1992), standardized as ANSI INCITS 359-2004.

## NIST Levels

1. **Core RBAC** — many-to-many user↔role and role↔permission mappings. The baseline everyone should start with.
2. **Hierarchical RBAC** — role inheritance (admin subsumes moderator). Implement as explicit permission merging, or flatten permissions at definition time — implicit hierarchies are a common bug source.
3. **Constrained RBAC** — adds **separation of duties**: mutually exclusive roles (e.g., nobody can both create and approve an expense). Enforce at role-assignment time.

## Core Pattern

Permission format: `action:resource` strings. Roles map to permission arrays. One evaluator:

```ts
const ROLES = {
  admin:     ["view:comments", "create:comments", "update:comments", "delete:comments"],
  moderator: ["view:comments", "create:comments", "delete:comments"],
  user:      ["view:comments", "create:comments"],
} as const

function hasPermission(user: User, permission: Permission): boolean {
  return user.roles.some(role => ROLES[role].includes(permission))
}
```

Full typed version in [typescript-reference.md](typescript-reference.md).

Key properties:
- **Multi-role**: union semantics — granted if *any* of the user's roles has the permission.
- **Deny by default**: no match → `false`.
- **Single source of truth**: adding/changing what a role can do = edit one table.

## Multi-Tenancy

Roles scoped per organization: a user can be `admin` in Org A and `user` in Org B.

```ts
// Extends the Core Pattern User with org memberships:
type Membership = { orgId: string; roles: Role[] }
type User = { id: string; roles: Role[]; memberships: Membership[] }

function hasPermissionInOrg(user: User, orgId: string, permission: Permission) {
  const membership = user.memberships.find(m => m.orgId === orgId)
  return membership?.roles.some(role => ROLES[role].includes(permission)) ?? false
}
```

Always pass the org explicitly (from the request/URL), never from client input alone.

## Storage Options

| Medium                       | When                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| In-code constants            | Small apps; type-checked, zero latency                                                                                       |
| Config files (JSON/YAML/env) | Non-devs tweak permissions; no DB                                                                                            |
| Database tables              | Runtime role administration, large user bases                                                                                |
| JWT/session claims           | Avoids DB hit per request — but roles go stale until token refresh; keep TTL short and re-check critical actions server-side |

## Limits

RBAC cannot express conditions ("only *their own* drafts"). Forcing it produces synthetic permissions (`delete:own_comments`) that multiply combinatorially — this is known as **role explosion** (Elliott & Knight 2010). That's the signal to move to [ABAC](abac.md).
