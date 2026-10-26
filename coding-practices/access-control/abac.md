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

## UI Enforcement: Capability Checks vs Ownership Flags

Never gate UI actions or menu items with naive ownership comparisons:

```tsx
// ❌ ANTI-PATTERN: Prevents admins, moderators, or delegates from acting
const isOwner = user?.id === document.authorId;
{isOwner && <DeleteButton onClick={handleDelete} />}

// ✅ CORRECT: Capability check via access control facade
const canDelete = hasPermission(user, "documents", "delete", document);
{canDelete && <DeleteButton onClick={handleDelete} />}
```

Checking capability via `hasPermission` naturally handles global admins, moderators, and orphaned records without sprinkling `|| isAdmin` or `|| isModerator` across UI components.

### Preserving Attribution Integrity vs Administrative Capability

When elevating permissions for administrators, distinguish between **capabilities** (`canEdit`, `canDelete`, `canManageAdmins`) and **attribution** (`isOwner`, `creatorId`, `authorId`).

Never set `isOwner = true` or overwrite `authorId` to grant admin rights:
- **Authorship misattribution**: UI elements will mislabel the administrator as the author or hide the true creator.
- **Accidental privilege stripping**: In admin management interfaces, checks like `admin.id === resource.creatorId` ensure the original creator cannot be removed. If an admin is spoofed as the creator, the actual creator can be locked out.
- **Rule**: Elevate capabilities (`isAdmin: true`, `canManage: true`) via capability evaluation, but keep `isOwner` strictly `user.id === resource.authorId`.

### PEP Parity Across UI and Action Handlers

Ensure Policy Enforcement Points (PEPs) in action and mutation handlers (e.g. `createPost`, `castVote`, `deleteComment`) invoke the exact same PDP contract as the UI. Hardcoding ad-hoc membership checks in mutation handlers (`if (!isMember) throw Error`) creates capability drift where actions enabled in the UI fail when executed.

### Decoupling Global Authority from Entity Membership

In multi-tenant, community, or group-scoped systems, global administrators must often view, moderate, and interact with private or restricted scopes.

Never grant global access by synthetically injecting membership records (e.g. creating synthetic member records in every group on login):
- **State corruption**: Artificially inflates member counts, pollutes subscriber/member rosters, and corrupts counts when the admin joins or leaves.
- **Roster & query desync**: Fails for newly created groups until refreshed or re-injected.

Instead, authorize global authority directly in the Policy Decision Point (PDP):

```ts
export function canViewCommunity(user: User, community: Community, snippets: Membership[]): boolean {
  if (isGlobalAdmin(user.id)) return true;
  if (community.isPrivate) return snippets.some(s => s.communityId === community.id);
  return true;
}
```

This keeps membership strictly an authentic, opt-in relationship (with accurate member counts and correct "Join / Leave" button state) while granting full administrative authority.

## Scoping Admin Overrides & Personal Isolation

Global administrators should rarely have unconditional `true` grants across every resource. Distinguish between **shared / domain resources** and **personal / private resources**:

- **Shared / Domain Resources** (catalogue items, documents, public playlists): Admins can view, edit, or delete any record.
- **Personal / Isolated Resources** (private favorites, billing profiles, personal credentials): Admins must remain scoped to their own records:

```ts
playlists: {
  // Admin can view/edit any shared playlist, but personal favorites remain strictly private
  view:   (user, pl) => !pl.isPersonal || pl.userId === user.id,
  update: (user, pl) => !pl.isPersonal || pl.userId === user.id,
  delete: (_user, pl) => !pl.isPersonal,
}
```

> [!WARNING]
> Unconditional `true` for admins on personal collections causes queries expecting a single record (e.g. `SELECT ... WHERE is_personal = true LIMIT 1`) to fail with cardinality violations (such as PostgREST `PGRST116`) when executed as an admin.

## Defense-in-Depth: App Layer + Database RLS

When building database-backed applications (e.g. Supabase, PostgreSQL RLS), enforce rules at **both** layers without bypassing security via elevated service-role keys:

1. **Application layer (`hasPermission`)**: Instant in-memory evaluations for UI rendering and mutation pre-checks.
2. **Database layer (RLS policies)**: Authoritative boundary preventing unauthorized writes even if application logic has bugs or direct database clients are used.

### Critical Database RLS Considerations

- **Both `USING` and `WITH CHECK` on `UPDATE`**:
  A PostgreSQL `UPDATE` policy checks `USING` against the existing row and `WITH CHECK` against the updated row. Omitting the admin override from `WITH CHECK` causes admin updates on non-owned rows to fail:
  ```sql
  -- ❌ FAILS when admin updates another user's row (new row still has original author_id != auth.uid()):
  CREATE POLICY "Users or admin can update" ON documents
    FOR UPDATE USING (author_id = (SELECT auth.uid()) OR (SELECT is_admin()))
    WITH CHECK (author_id = (SELECT auth.uid()));

  -- ✅ CORRECT:
  CREATE POLICY "Users or admin can update" ON documents
    FOR UPDATE USING (author_id = (SELECT auth.uid()) OR (SELECT is_admin()))
    WITH CHECK (author_id = (SELECT auth.uid()) OR (SELECT is_admin()));
  ```
- **Performance Optimization via `STABLE` InitPlans**:
  Wrap role/admin helper functions in `(SELECT is_admin())` and declare them `STABLE SECURITY DEFINER`. PostgreSQL evaluates subquery expressions marked `STABLE` once per query as an `InitPlan` rather than executing the function per scanned row.
- **Orphaned Resources (`author_id IS NULL`)**:
  When a user is deleted and foreign keys are set to `NULL` (`ON DELETE SET NULL`), `author_id = auth.uid()` evaluates to `UNKNOWN` (falsy). Admin overrides (`OR (SELECT is_admin())`) ensure orphaned entities remain manageable.
- **Pre-mutation Row Existence Check for Silent 0-Row Mutations**:
  Many data APIs (like PostgREST) return `{ error: null }` when `.update()` or `.delete()` affects zero rows due to RLS filter mismatch. Fetch the record and evaluate `hasPermission()` in the mutation handler to return explicit, actionable errors.
