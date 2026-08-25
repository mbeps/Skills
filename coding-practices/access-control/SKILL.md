---
name: access-control
description: Use when designing or implementing authorization/permissions in any language — role checks scattered across files, ownership rules like "users can only edit their own X", multi-role or multi-tenant requirements, choosing between RBAC and ABAC, or centralising hasPermission/can() logic
---

# Access Control (RBAC + ABAC)

## Overview

Centralise all authorization behind one facade function backed by a **declarative rule table**. Never hardcode role checks (`if (user.role === 'admin')`) in components, routes, or handlers.

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
- **Architecture (PEP/PDP), storage options, libraries**: [references.md](references.md).

## Common Mistakes

| Mistake | Fix |
|---|---|
| `if (user.role === 'admin')` scattered in code | One `hasPermission()` facade everywhere (`can()` is the same idea — pick one name per codebase) |
| Synthetic permissions for ownership (`delete:own_comments`) | Predicate rule: `(user, data) => data.authorId === user.id` |
| Allow-by-default when a rule is missing | Missing/null rule = deny; use partial maps so absence is explicit |
| Business logic embedded in the check function | Move conditionals into declarative predicates in the rule table |
| Roles cached in JWT go stale after revocation | Short token TTL + re-check critical permissions server-side |
| Checking permission but not filtering list queries | Filter DB queries with the same predicates, not just UI/API gates |

## When NOT to hand-roll

Multi-org sharing graphs, per-record sharing with inheritance, or compliance-driven audit trails → evaluate Casbin, Oso, SpiceDB/OpenFGA before writing your own engine (see references.md).
