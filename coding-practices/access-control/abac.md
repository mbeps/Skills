# ABAC Reference

Attribute-Based Access Control: access decided by evaluating **attributes of Subject, Action, Resource, and Environment** (NIST SP 800-162). RBAC answers "what does this role allow?"; ABAC answers "given this user, this record, and this context — allowed right now?"

## The Four Attribute Types

| Type            | Examples                                          |
| --------------- | ------------------------------------------------- |
| **Subject**     | user id, roles, `blockedBy` list                  |
| **Action**      | view / create / update / delete                   |
| **Resource**    | `authorId`, `status`, `completed`, `invitedUsers` |
| **Environment** | org scope, IP, time of day, device                |

## Core Pattern: Rule Matrix with Predicates

Nest rules as role → resource → action. Each entry is either a static boolean or a predicate `(user, data) => boolean`:

```ts
const ROLES = {
  moderator: {
    comments: { view: true, create: true, update: true },
    todos: {
      view: true, create: true, update: true,
      delete: (user, todo) => todo.completed,          // resource attribute
    },
  },
  user: {
    comments: {
      view:   (user, c) => !user.blockedBy.includes(c.authorId),  // subject attribute
      create: true,
      update: (user, c) => c.authorId === user.id,                // ownership
    },
  },
} satisfies RolesWithPermissions
```

Full typed version in [typescript-reference.md](typescript-reference.md).

Key properties:
- **Boolean vs predicate duality**: `true` for coarse grants; predicates for ownership/status/blocking.
- **Deny by default**: missing entry → denied. Declare only what each role grants (partial maps).
- **Two query modes**: call without `data` to answer "can this user ever do X?" (hide UI); with `data` for "can they do X to *this* record?" Predicates must return `false` when data is absent.

## Adding Environment/Context

Extend the predicate signature with a context parameter:

```ts
type PermissionCheck<D> = boolean | ((user: User, data: D, ctx: Context) => boolean)
// e.g. delete: (user, doc, ctx) => ctx.ip.startsWith("10.") && isBusinessHours(ctx.now)
```

Thread context from the request through the facade; keep predicates pure so they're testable.

## Architecture Terms (XACML)

Useful vocabulary when scaling beyond one codebase:

- **PEP** (Policy Enforcement Point): your UI guards, route middleware, server checks — where decisions are *applied*.
- **PDP** (Policy Decision Point): your `can()` facade + rule table — where decisions are *made*.
- **PIP** (Policy Information Point): fetches external attributes (org membership, block lists).

Practitioner framing: the rule table acts as Strategy/Policy objects; predicates act as Specifications; the facade is a Facade over PDP.

This model is allow-only. If you need explicit deny rules or deny-overrides, you've outgrown hand-rolling — use Casbin or XACML (see [references.md](references.md)).

## Hybrid RBAC+ABAC

You don't choose one. Roles stay the coarse layer; predicates refine them per-resource. NIST explicitly recommends "adding attributes to role-based access control" (Kuhn, Coyne & Weil, 2010). The matrix above is exactly this hybrid.

Note: ownership checks via attributes are sometimes mislabeled ReBAC. True Relationship-Based Access Control (Zanzibar/OpenFGA style) requires relationship *traversal* ("viewer of parent folder can view children") — see [references.md](references.md).
