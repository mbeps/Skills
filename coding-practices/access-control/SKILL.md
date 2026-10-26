---
name: access-control
description: Use when designing or implementing authorization/permissions in any language — role checks scattered across files, ownership rules like "users can only edit their own X", multi-role or multi-tenant requirements, choosing between RBAC and ABAC, or centralising hasPermission/can() logic
---

# Access Control (RBAC + ABAC)

## Overview

Centralise authorization behind one facade function backed by a **declarative rule table**. Never hardcode role checks (`if (user.role === 'admin')`) in components, routes, or handlers.

**Core principles:**
1. **Deny by default** — no matching rule means denied. Every model below enforces this implicitly.
2. **Declarative rules, imperative evaluation** — rules live in one data structure; one evaluator reads it.
3. **Permissions are `action:resource` strings** (`"delete:comments"`), never synthetic qualifiers like `"delete:own_comments"` — that's the first sign you've outgrown pure RBAC.

## Model Selection

```
Need roles only?                          → Flat RBAC        (rbac.md)
Ownership/status conditions on resources? → ABAC predicates  (abac.md)
Roles scoped per org/tenant?              → Multi-tenant     (rbac.md#multi-tenancy)
Sharing based on relationships/graphs?    → ReBAC            (references.md)
```

| Symptom | Upgrade to |
|---|---|
| Artificial permissions (`edit:own_comments`) | ABAC predicates |
| Same role means different things per tenant | Org-scoped roles |
| Role count exploding combinatorially | ABAC (NIST calls this "role explosion") |

## Quick Reference

- **Flat RBAC**: `hasPermission(user, "delete:comments")` over a role→permissions map. See [rbac.md](rbac.md).
- **ABAC**: nested role→resource→action matrix where each entry is `true` or `(user, data) => boolean`. See [abac.md](abac.md).
- **TypeScript reference implementations**: [typescript-reference.md](typescript-reference.md) — porting notes for other languages included.
- **Defense-in-depth (App ABAC + Database RLS)**: mirroring PDP rules to row-level security. See [abac.md#defense-in-depth-app-layer--database-rls](abac.md#defense-in-depth-app-layer--database-rls).
- **Architecture (PEP/PDP), storage options, libraries**: [references.md](references.md).

## Common Mistakes

| Mistake | Fix |
|---|---|
| `if (user.role === 'admin')` scattered in code | One `hasPermission()` facade everywhere (`can()` is the same idea — pick one name per codebase) |
| UI checking `user.id === resource.ownerId` instead of capability | Call `hasPermission(user, resource, action, data)` — hardcoded owner checks block admins and delegates |
| Synthetic permissions for ownership (`delete:own_comments`) | Predicate rule: `(user, data) => data.authorId === user.id` |
| Allow-by-default when a rule is missing | Missing/null rule = deny; use partial maps so absence is explicit |
| Business logic embedded in the check function | Move conditionals into declarative predicates in the rule table |
| Roles cached in JWT go stale after revocation | Short token TTL + re-check critical permissions server-side |
| Checking permission but not filtering list queries | Filter DB queries with the same predicates, not just UI/API gates |
| RLS `UPDATE` policies missing admin bypass in `WITH CHECK` | Include admin check in both `USING` (read/filter) and `WITH CHECK` (write validation); otherwise updating non-owned rows fails |
| Granting admins unconditional `true` on private resources | Use predicates to maintain personal isolation (e.g., private favourites, billing) even for admins |
| Conflating membership with global authority | Evaluate global authority in PDP independently of membership; injecting synthetic membership records inflates member counts and desyncs on leave |
| Spoofing ownership (`isOwner = true`) to elevate privileges | Elevate capability flags (`canManage`), never forge attribution (`authorId` / `creatorId`), which mislabels creators and corrupts immutability |
| Ad-hoc permission checks in mutation handlers | Use identical PDP facade in both UI and action hooks; drift causes buttons enabled in UI to fail when clicked |

## When NOT to hand-roll

Multi-org sharing graphs, per-record inheritance, or compliance audit trails → use Casbin, Oso, SpiceDB/OpenFGA instead of hand-rolling (see [references.md](references.md)).
